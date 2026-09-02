import { allowedOrigin, type ProviderConfig } from './config.ts'
import type {
  AnswerModelProvider,
  AuthorRelevanceReviewProvider,
  HttpPort,
  ModelResult,
  ModelStreamEvent,
  ReviewPickResult,
} from './ports.ts'

const CHAT_PATH = '/chat/completions'
const ANSWER_OUTPUT_LIMIT = 200_000
const CLASSIFY_OUTPUT_LIMIT = 2_000
const REVIEW_OUTPUT_LIMIT = 4_000

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function contentOf(payload: unknown, limit = ANSWER_OUTPUT_LIMIT): string {
  const root = asRecord(payload)
  const choices = root?.choices
  const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
  const message = asRecord(first?.message)
  return (asText(message?.content) || asText(message?.reasoning_content)).slice(0, limit)
}

function deltaText(delta: Record<string, unknown> | undefined): string {
  return asText(delta?.content) || asText(delta?.reasoning_content)
}

function chatBody(
  ports: { config: ProviderConfig },
  messages: readonly { role: 'system' | 'user'; content: string }[],
  options?: { json?: boolean; maxTokens?: number; stream?: boolean },
) {
  return {
    model: ports.config.deepseekModelName,
    temperature: options?.json ? 0 : 0.2,
    max_tokens: options?.maxTokens ?? 8192,
    thinking: { type: 'disabled' },
    ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
    ...(options?.stream ? { stream: true } : {}),
    messages,
  }
}

function assertAllowed(url: string, origin: string) {
  if (new URL(url).origin !== origin) throw new Error('ssrf')
}

async function complete(
  ports: { config: ProviderConfig; http: HttpPort },
  messages: readonly { role: 'system' | 'user'; content: string }[],
  signal?: AbortSignal,
  options?: { json?: boolean; maxOutput?: number; maxTokens?: number },
): Promise<ModelResult> {
  const url = new URL(CHAT_PATH, `${ports.config.deepseekBaseUrl}/`)
  const maxOutput = options?.maxOutput ?? ANSWER_OUTPUT_LIMIT
  try {
    assertAllowed(url.toString(), allowedOrigin(ports.config.deepseekBaseUrl))
    const response = await ports.http(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ports.config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatBody(ports, messages, { json: options?.json, maxTokens: options?.maxTokens })),
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
    const content = contentOf(payload, maxOutput)
    if (!content) return { kind: 'failed', message: 'DeepSeek returned an empty completion.' }
    return { kind: 'completed', text: content }
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') return { kind: 'failed', message: 'DeepSeek request was aborted.' }
    return { kind: 'failed', message: 'DeepSeek is unavailable.' }
  }
}

async function* completeStream(
  ports: { config: ProviderConfig; http: HttpPort },
  messages: readonly { role: 'system' | 'user'; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<ModelStreamEvent> {
  const url = new URL(CHAT_PATH, `${ports.config.deepseekBaseUrl}/`)
  try {
    assertAllowed(url.toString(), allowedOrigin(ports.config.deepseekBaseUrl))
    const response = await ports.http(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ports.config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatBody(ports, messages, { stream: true })),
      signal,
    })
    if (!response.ok) {
      yield { kind: 'failed', message: 'DeepSeek returned a non-success status.' }
      return
    }
    if (!response.body) {
      const fallback = await complete(ports, messages, signal)
      yield fallback
      return
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (!data || data === '[DONE]') continue
        let payload: unknown
        try {
          payload = JSON.parse(data) as unknown
        } catch {
          continue
        }
        const root = asRecord(payload)
        const choices = root?.choices
        const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined
        const delta = asRecord(first?.delta)
        const chunk = deltaText(delta)
        if (!chunk) continue
        full += chunk
        yield { kind: 'delta', text: chunk }
      }
    }
    const completed = full.trim().slice(0, ANSWER_OUTPUT_LIMIT)
    if (!completed) {
      yield { kind: 'failed', message: 'DeepSeek returned an empty completion.' }
      return
    }
    yield { kind: 'completed', text: completed }
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      yield { kind: 'failed', message: 'DeepSeek request was aborted.' }
      return
    }
    yield { kind: 'failed', message: 'DeepSeek is unavailable.' }
  }
}

function answerMessages(input: {
  question: string
  topic?: string
  quote?: string
  evidence: readonly { title: string; url: string; excerpt: string }[]
  graphContext?: string
  hostTitle?: string
}) {
  const evidence = input.evidence
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.title}\n${item.url}\n${item.excerpt}`)
    .join('\n\n')
  return [
    {
      role: 'system' as const,
      content: '你是刘看山。只根据给定的公开知乎证据和知识脉络上下文回答。回答必须对准当前针对的节点卡片，不要虚构作者、链接或未出现的公式。证据不足就明确说不知道。不要输出密钥、内部 URL 或 HTML。单次回答不要超过必要篇幅。',
    },
    {
      role: 'user' as const,
      content: [
        input.topic ? `概念：${input.topic}` : '',
        input.hostTitle ? `针对节点：${input.hostTitle}` : '',
        input.graphContext ? `知识脉络：\n${input.graphContext}` : '',
        input.quote ? `引用：${input.quote}` : '',
        `问题：${input.question}`,
        evidence ? `证据：\n${evidence}` : '证据：无',
      ].filter(Boolean).join('\n'),
    },
  ]
}

const CLASSIFY_SYSTEM = `你是知识脉络的结构编辑。只输出 JSON，不要 Markdown。
字段必须是：
{"kind":"pred|succ|par","title":"不超过13字的卡片标题","reason":"一句话逻辑说明","mergeNodeId":null或候选id}

kind 含义：
- pred：进入当前宿主节点之前必须先理解的前提
- succ：从当前宿主节点继续往下追问的下一步
- par：对当前宿主节点的另一种问法、举例、换表述、同一层理解。只要是并列，mergeNodeId 必须是候选里 kind=par 的虚线卡 id；没有并列卡则 null。

前置/后置：若与候选里同类型节点的问题相似，mergeNodeId 填该 id，合并进已有卡片；否则 null，引出新节点。
禁止发明不在候选里的 id。`

export function createDeepSeekAnswerAdapter(ports: {
  config: ProviderConfig
  http: HttpPort
}): AnswerModelProvider {
  return {
    async answer(input, signal) {
      return complete(ports, answerMessages(input), signal, { maxOutput: ANSWER_OUTPUT_LIMIT, maxTokens: 8192 })
    },
    answerStream(input, signal) {
      return completeStream(ports, answerMessages(input), signal)
    },
    async classifyGrow(input, signal) {
      const pal = input.candidates.find((item) => item.kind === 'par')
      return complete(ports, [
        { role: 'system', content: CLASSIFY_SYSTEM },
        {
          role: 'user',
          content: [
            input.topic ? `概念：${input.topic}` : '',
            input.hostTitle ? `宿主节点：${input.hostTitle}` : '',
            pal ? `并列虚线卡：${pal.id}「${pal.title}」` : '并列虚线卡：无',
            `候选：${JSON.stringify(input.candidates)}`,
            input.graphContext ? `脉络结构：\n${input.graphContext.slice(0, 12_000)}` : '',
            input.quote ? `引用：${input.quote}` : '',
            `问题：${input.question || input.quote || ''}`,
          ].filter(Boolean).join('\n'),
        },
      ], signal, { json: true, maxOutput: CLASSIFY_OUTPUT_LIMIT, maxTokens: 512 })
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
      ], signal, { maxOutput: REVIEW_OUTPUT_LIMIT, maxTokens: 800 })
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
