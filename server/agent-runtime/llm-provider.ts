import type { ProviderConfig } from '../config.ts'
import type { HttpPort } from '../ports.ts'
import type { LlmCompleteInput, LlmCompleteResult, LlmProvider } from './types.ts'

const MAX_RESPONSE_CHARS = 1_000_000
function record(v: unknown): Record<string, any> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {} }
function failure(code: string, retryable: boolean): LlmCompleteResult {
  return { kind: 'failed', code, retryable, message: code === 'AUTH_INVALID' ? '模型连接需要检查配置。' : code === 'CANCELLED' ? '已停止。' : '连接暂时未完成。' }
}
/** A draft is never a completion. Only an explicit provider stop commits a response. */
export async function readCompletionStream(stream: ReadableStream<Uint8Array>, input: LlmCompleteInput) {
  const reader = stream.getReader(), decoder = new TextDecoder()
  let buffer = '', content = '', reasoning = '', finish: string|undefined, ended = false
  function consume(event: string) {
    const data = event.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n').trim()
    if (!data) return
    if (data === '[DONE]') { ended = true; return }
    const payload = record(JSON.parse(data))
    if (payload.error) throw new Error('STREAM_ERROR')
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
    if (finish !== 'stop' || !ended || !content.trim()) throw new Error(finish === 'length' ? 'OUTPUT_TRUNCATED' : 'STREAM_INCOMPLETE')
    return { content, reasoning }
  } finally { input.signal?.removeEventListener('abort', abort); reader.releaseLock() }
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
            max_tokens: input.maxTokens ?? 8192, temperature: input.json ? 0 : 0.2,
            thinking: { type: input.thinkingDepth === 'deep' ? 'enabled' : 'disabled' },
            ...(input.json ? { response_format: { type: 'json_object' } } : {}), ...(stream ? { stream: true } : {}) }),
        })
        if (!response.ok) return failure(response.status===401 || response.status===403 ? 'AUTH_INVALID' : response.status===429 ? 'RATE_LIMITED' : `HTTP_${response.status}`, response.status===429 || response.status>=500)
        if (stream && response.body) {
          const result = await readCompletionStream(response.body, input)
          return { kind: 'completed', text: result.content, reasoning: result.reasoning }
        }
        const raw = await response.text()
        if (raw.length > MAX_RESPONSE_CHARS) return failure('OUTPUT_LIMIT', false)
        const payload = record(JSON.parse(raw)), choice = record(payload.choices?.[0]), message = record(choice.message)
        if (choice.finish_reason !== 'stop') return failure(choice.finish_reason==='length'?'OUTPUT_TRUNCATED':'OUTPUT_INCOMPLETE', true)
        if (typeof message.content !== 'string' || !message.content.trim()) return failure('OUTPUT_EMPTY', true)
        input.signal?.throwIfAborted()
        input.onText?.(message.content)
        return { kind: 'completed', text: message.content }
      } catch (error) {
        if (input.signal?.aborted) return failure('CANCELLED', false)
        const code = error instanceof Error && /^(STREAM_|OUTPUT_)/.test(error.message) ? error.message : 'NETWORK_UNAVAILABLE'
        return failure(code, code !== 'OUTPUT_LIMIT')
      }
    },
  }
}
