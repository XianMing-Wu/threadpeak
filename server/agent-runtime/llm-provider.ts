import { allowedOrigin, type ProviderConfig } from '../config.ts'
import type { HttpPort } from '../ports.ts'
import type { LlmCompleteInput, LlmCompleteResult, LlmProvider } from './types.ts'

const CHAT_PATH = '/chat/completions'
const OUTPUT_LIMIT = 200_000

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function contentOf(payload: unknown, json: boolean): string {
  const root = asRecord(payload)
  const choices = root?.choices
  const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
  const message = asRecord(first?.message)
  const content = asText(message?.content) || asText(root?.output_text)
  if (content || json) return content.slice(0, OUTPUT_LIMIT)
  return asText(message?.reasoning_content).slice(0, OUTPUT_LIMIT)
}

function assertAllowed(url: string, origin: string) {
  if (new URL(url).origin !== origin) throw new Error('ssrf')
}

export function createAgentLlmProvider(ports: {
  config: ProviderConfig
  http: HttpPort
}): LlmProvider {
  const origin = allowedOrigin(ports.config.deepseekBaseUrl)
  return {
    async complete(input: LlmCompleteInput): Promise<LlmCompleteResult> {
      const url = new URL(CHAT_PATH, `${ports.config.deepseekBaseUrl}/`)
      try {
        assertAllowed(url.toString(), origin)
        const response = await ports.http(url.toString(), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ports.config.deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ports.config.deepseekModelName,
            temperature: input.json ? 0 : 0.2,
            max_tokens: input.thinkingDepth === 'deep'
              ? Math.max(8192, (input.maxTokens ?? 0) + 4096)
              : (input.maxTokens ?? 8192),
            thinking: { type: input.thinkingDepth === 'deep' ? 'enabled' : 'disabled' },
            ...(input.json ? { response_format: { type: 'json_object' } } : {}),
            messages: input.messages,
          }),
          signal: input.signal,
        })
        const text = await response.text()
        if (!response.ok) {
          if (response.status === 429) return { kind: 'failed', message: '模型服务限流。' }
          if (response.status === 401 || response.status === 403) return { kind: 'failed', message: '模型服务鉴权失败。' }
          return { kind: 'failed', message: `模型服务不可用（HTTP ${response.status}）。` }
        }
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          return { kind: 'failed', message: '模型服务返回了无法解析的响应。' }
        }
        const content = contentOf(payload, input.json)
        if (!content) return { kind: 'failed', message: '模型服务返回了空内容。' }
        return { kind: 'completed', text: content }
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') {
          return { kind: 'failed', message: '模型请求已中止。' }
        }
        return { kind: 'failed', message: '模型服务不可用。' }
      }
    },
  }
}
