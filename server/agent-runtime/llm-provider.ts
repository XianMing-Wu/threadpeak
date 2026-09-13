import type { ProviderConfig } from '../config.ts'
import type { HttpPort } from '../ports.ts'
import type { LlmCompleteInput, LlmCompleteResult, LlmProvider,ProviderMetadata } from './types.ts'
import { readUsage,providerDiagnostic,parseProviderError,classifyProviderError } from './provider-metadata.ts'
import { thinkingParameters } from './thinking-policy.ts'

const MAX_RESPONSE_CHARS = 1_000_000
class CompletionStreamError extends Error {
  metadata:ProviderMetadata
  constructor(code:string,metadata:ProviderMetadata){super(code);this.metadata=metadata}
}
function record(v: unknown): Record<string, any> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {} }
function failure(code: string, retryable: boolean): LlmCompleteResult {
  return { kind: 'failed', code, retryable, message: code === 'AUTH_INVALID' ? '模型连接需要检查配置。' : code === 'CANCELLED' ? '已停止。' : '连接暂时未完成。' }
}
/** A draft is never a completion. Only an explicit provider stop commits a response. */
export async function readCompletionStream(stream: ReadableStream<Uint8Array>, input: LlmCompleteInput) {
  const reader = stream.getReader(), decoder = new TextDecoder()
  let buffer = '', content = '', reasoning = '', finish: string|undefined, ended = false
  let usage:ReturnType<typeof readUsage>,diagnostic:ReturnType<typeof providerDiagnostic>|undefined
  function consume(event: string) {
    const data = event.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n').trim()
    if (!data) return
    if (data === '[DONE]') { ended = true; return }
    const payload = record(JSON.parse(data))
    usage=readUsage(payload.usage)??usage
    diagnostic=providerDiagnostic(200,payload)
    if (payload.error) throw new Error(classifyProviderError(200,diagnostic.upstreamCode).code)
    const choice = record(payload.choices?.[0]), delta = record(choice.delta)
    if (typeof choice.finish_reason === 'string') finish = choice.finish_reason
    if (typeof delta.content === 'string') { content += delta.content; input.onText?.(content) }
    if (typeof delta.reasoning_content === 'string') { reasoning += delta.reasoning_content; input.onReasoning?.(reasoning) }
    if (content.length+reasoning.length > MAX_RESPONSE_CHARS) throw new Error('OUTPUT_LIMIT')
  }
  const abort = () => { void reader.cancel().catch(() => {}) }
  input.signal?.addEventListener('abort', abort, { once: true })
  try {
    for (;;) {
      input.signal?.throwIfAborted()
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r/g, '')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) { consume(buffer.slice(0, boundary)); buffer = buffer.slice(boundary+2) }
      if (buffer.length > MAX_RESPONSE_CHARS) throw new Error('OUTPUT_LIMIT')
    }
    buffer += decoder.decode()
    if (buffer.trim()) consume(buffer)
    input.signal?.throwIfAborted()
    const hasBody = content.trim()
    if (finish !== 'stop' || !ended || !hasBody) throw new Error(finish === 'length' ? 'OUTPUT_TRUNCATED' : finish==='insufficient_system_resource'?'PROVIDER_BUSY':'STREAM_INCOMPLETE')
    return { content, reasoning,usage,diagnostic }
  } catch(error) {
    const code=error instanceof Error&&/^(?:(?:STREAM_|OUTPUT_)[A-Z_]+|PROVIDER_BUSY|RATE_LIMITED|MODEL_QUOTA_EXCEEDED|AUTH_INVALID|HTTP_\d+)$/.test(error.message)?error.message:'STREAM_INVALID_RESPONSE'
    throw new CompletionStreamError(code,{usage,diagnostic})
  } finally { input.signal?.removeEventListener('abort', abort); await reader.cancel().catch(()=>{});reader.releaseLock() }
}
export function createAgentLlmProvider(ports: { config: ProviderConfig; http: HttpPort }): LlmProvider {
  return {
    async complete(input): Promise<LlmCompleteResult> {
      if (input.signal?.aborted) return failure('CANCELLED', false)
      const url = `${ports.config.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`
      const stream = Boolean(input.onText || input.onReasoning)
      try {
        const response = await ports.http(url, {
          method: 'POST', signal: input.signal, timeoutMs: input.thinkingDepth === 'deep' ? 480_000 : 240_000,
          headers: { Authorization: `Bearer ${ports.config.deepseekApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ports.config.deepseekModelName, messages: input.messages,
            ...(input.cacheUserId&&new URL(url).hostname==='api.deepseek.com'?{user_id:input.cacheUserId}:{}),
            max_tokens: input.maxTokens ?? 8192,
            ...thinkingParameters(input),
            ...(input.json ? { response_format: { type: 'json_object' } } : {}), ...(stream ? { stream: true,stream_options:{include_usage:true} } : {}) }),
        })
        if (!response.ok) {
          const diagnostic=providerDiagnostic(response.status,parseProviderError(await response.text()),response.headers),error=classifyProviderError(response.status,diagnostic.upstreamCode)
          return {...failure(error.code,error.retryable),diagnostic}
        }
        if (stream && response.body) {
          // Preserve the complete formal body. Domain parsers own recovery; choosing
          // a parseable inner object here silently drops sections and topology.
          const result = await readCompletionStream(response.body, input)
          if (!result.content.trim()) return {...failure('OUTPUT_EMPTY', true),usage:result.usage,diagnostic:result.diagnostic}
          return { kind: 'completed', text: result.content, reasoning: result.reasoning,usage:result.usage,diagnostic:result.diagnostic }
        }
        const raw = await response.text()
        if (raw.length > MAX_RESPONSE_CHARS) return failure('OUTPUT_LIMIT', false)
        const payload = record(JSON.parse(raw)), choice = record(payload.choices?.[0]), message = record(choice.message)
        const metadata={usage:readUsage(payload.usage),diagnostic:providerDiagnostic(response.status,payload,response.headers)}
        if (choice.finish_reason !== 'stop') return {...failure(choice.finish_reason==='length'?'OUTPUT_TRUNCATED':choice.finish_reason==='insufficient_system_resource'?'PROVIDER_BUSY':'OUTPUT_INCOMPLETE', true),...metadata}
        const content = typeof message.content === 'string' ? message.content : ''
        const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content : typeof message.reasoning === 'string' ? message.reasoning : ''
        if (reasoning) input.onReasoning?.(reasoning)
        if (!content.trim()) return {...failure('OUTPUT_EMPTY', true),...metadata}
        input.signal?.throwIfAborted()
        input.onText?.(content)
        return { kind: 'completed', text: content, reasoning,...metadata }
      } catch (error) {
        if (input.signal?.aborted) return failure('CANCELLED', false)
        if(error instanceof CompletionStreamError)return {...failure(error.message,!/QUOTA|AUTH_INVALID|OUTPUT_LIMIT/.test(error.message)),...error.metadata}
        const code = error instanceof Error && /^(STREAM_|OUTPUT_)/.test(error.message) ? error.message : 'NETWORK_UNAVAILABLE'
        return failure(code, code !== 'OUTPUT_LIMIT')
      }
    },
  }
}
