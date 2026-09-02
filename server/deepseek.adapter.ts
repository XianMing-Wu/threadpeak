import { allowedOrigin, type ProviderConfig } from './config.ts'
import type {
  AnswerModelProvider,
  AuthorRelevanceReviewProvider,
  HttpPort,
  ModelResult,
  ReviewPickResult,
} from './ports.ts'

const CHAT_PATH = '/chat/completions'
const MAX_OUTPUT = 4000

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function contentOf(payload: unknown): string {
  const root = asRecord(payload)
  const choices = root?.choices
  const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
  const message = asRecord(first?.message)
  return asText(message?.content).slice(0, MAX_OUTPUT)
}

function assertAllowed(url: string, origin: string) {
  if (new URL(url).origin !== origin) throw new Error('ssrf')
}

async function complete(
  ports: { config: ProviderConfig; http: HttpPort },
  messages: readonly { role: 'system' | 'user'; content: string }[],
  signal?: AbortSignal,
): Promise<ModelResult> {
  const url = new URL(CHAT_PATH, `${ports.config.deepseekBaseUrl}/`)
  try {
    assertAllowed(url.toString(), allowedOrigin(ports.config.deepseekBaseUrl))
    const response = await ports.http(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ports.config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ports.config.deepseekModelName,
        temperature: 0.2,
        messages,
      }),
      signal,
    })
    const text = await response.text()
    if (!response.ok) return { kind: 'failed', message: 'DeepSeek returned a non-success status.' }
    let payload: unknown
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      return { kind: 'failed', message: 'DeepSeek returned invalid JSON.' }
    }
    const content = contentOf(payload)
    if (!content) return { kind: 'failed', message: 'DeepSeek returned an empty completion.' }
    return { kind: 'completed', text: content }
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: 'DeepSeek request was aborted.' }
    return { kind: 'failed', message: 'DeepSeek is unavailable.' }
  }
}

export function createDeepSeekAnswerAdapter(ports: {
  config: ProviderConfig
  http: HttpPort
}): AnswerModelProvider {
  return {
    async answer(input, signal) {
      const evidence = input.evidence
        .slice(0, 8)
        .map((item, index) => `${index + 1}. ${item.title}\n${item.url}\n${item.excerpt}`)
        .join('\n\n')
      return complete(ports, [
        {
          role: 'system',
          content: '你是刘看山。只根据给定的公开知乎证据回答。不要虚构作者、链接或未出现的公式。证据不足就明确说不知道。不要输出密钥、内部 URL 或 HTML。',
        },
        {
          role: 'user',
          content: [
            input.topic ? `概念：${input.topic}` : '',
            input.quote ? `引用：${input.quote}` : '',
            `问题：${input.question}`,
            evidence ? `证据：\n${evidence}` : '证据：无',
          ].filter(Boolean).join('\n'),
        },
      ], signal)
    },
  }
}

export function createDeepSeekReviewAdapter(ports: {
  config: ProviderConfig
  http: HttpPort
}): AuthorRelevanceReviewProvider {
  return {
    async pick(input, signal): Promise<ReviewPickResult> {
      const allowed = new Set(input.candidates.map((item) => item.authorKey))
      const listing = input.candidates.map((item) => ({
        authorKey: item.authorKey,
        displayName: item.displayName,
        profileUrl: item.profileUrl,
        evidenceIds: item.evidence.map((hit) => hit.url),
      }))
      const completed = await complete(ports, [
        {
          role: 'system',
          content: `只从给定 authorKey 中挑选最多 ${input.limit} 个相关作者。禁止新增、合并或改写身份。输出 JSON：{"authorKeys":[],"reasons":{}}。零相关就返回空数组。`,
        },
        {
          role: 'user',
          content: `问题：${input.question}\n候选：${JSON.stringify(listing)}`,
        },
      ], signal)
      if (completed.kind === 'failed') return completed
      const match = completed.text.match(/\{[\s\S]*\}/)
      if (!match) return { kind: 'failed', message: 'Author review returned no JSON object.' }
      let parsed: unknown
      try {
        parsed = JSON.parse(match[0]) as unknown
      } catch {
        return { kind: 'failed', message: 'Author review JSON was invalid.' }
      }
      const record = asRecord(parsed)
      const rawKeys = record?.authorKeys
      if (!Array.isArray(rawKeys)) return { kind: 'failed', message: 'Author review omitted authorKeys.' }
      const reasonsRecord = asRecord(record?.reasons) ?? {}
      const authorKeys: string[] = []
      const reasons: Record<string, string> = {}
      for (const key of rawKeys) {
        if (typeof key !== 'string' || !allowed.has(key) || authorKeys.includes(key)) continue
        authorKeys.push(key)
        const reason = asText(reasonsRecord[key])
        if (reason) reasons[key] = reason.slice(0, 200)
        if (authorKeys.length >= input.limit) break
      }
      return authorKeys.length > 0 ? { kind: 'selected', authorKeys, reasons } : { kind: 'none' }
    },
  }
}
