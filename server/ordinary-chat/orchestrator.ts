import type {
  AgentFailureCode,
  TextInvokeResult,
  ThinkingDepth,
} from '../agent-runtime/types.ts'

export type OrdinaryChatTurn = {
  messageId: string
  role: 'user' | 'assistant' | 'system_event'
  kind: 'text' | 'question_set' | 'route_published'
  content: unknown
}

export type OrdinaryChatAttachment = {
  sourceId: string
  fileName: string
  content: string
}

export type OrdinaryChatResult =
  | { kind: 'completed'; text: string; compressed: boolean }
  | { kind: 'failed'; code: AgentFailureCode; message: string }

export type OrdinaryChatInvokeText = (
  agentId: 'R5',
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth },
) => Promise<TextInvokeResult>

const ROLES = new Set(['user', 'assistant', 'system_event'])
const KINDS = new Set(['text', 'question_set', 'route_published'])

function asTurn(value: unknown): OrdinaryChatTurn | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.messageId !== 'string' || !record.messageId.trim()) return undefined
  if (typeof record.role !== 'string' || !ROLES.has(record.role)) return undefined
  if (typeof record.kind !== 'string' || !KINDS.has(record.kind)) return undefined
  if (record.content === undefined) return undefined
  return {
    messageId: record.messageId,
    role: record.role as OrdinaryChatTurn['role'],
    kind: record.kind as OrdinaryChatTurn['kind'],
    content: record.content,
  }
}

function asAttachment(value: unknown): OrdinaryChatAttachment | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.sourceId !== 'string' || !record.sourceId.trim()) return undefined
  if (typeof record.fileName !== 'string' || !record.fileName.trim()) return undefined
  if (typeof record.content !== 'string') return undefined
  return {
    sourceId: record.sourceId,
    fileName: record.fileName,
    content: record.content,
  }
}

export function createOrdinaryChatOrchestrator(ports: {
  invokeText: OrdinaryChatInvokeText
}) {
  return {
    async reply(input: {
      currentMessage: string
      conversation?: unknown
      attachments?: unknown
      thinkingDepth?: ThinkingDepth
    }): Promise<OrdinaryChatResult> {
      const currentMessage = input.currentMessage.trim()
      if (!currentMessage) {
        return { kind: 'failed', code: 'PROVIDER_INVALID', message: '消息不能为空。' }
      }
      const conversation = Array.isArray(input.conversation)
        ? input.conversation.flatMap((item) => {
          const turn = asTurn(item)
          return turn ? [turn] : []
        })
        : []
      const attachments = Array.isArray(input.attachments)
        ? input.attachments.flatMap((item) => {
          const attachment = asAttachment(item)
          return attachment ? [attachment] : []
        })
        : []
      const thinkingDepth = input.thinkingDepth === 'deep' ? 'deep' : 'fast'
      const answered = await ports.invokeText('R5', {
        conversation,
        currentMessage,
        attachments,
      }, { thinkingDepth })
      if (answered.kind === 'failed') {
        return { kind: 'failed', code: answered.code, message: answered.message }
      }
      return { kind: 'completed', text: answered.text, compressed: answered.compressed }
    },
  }
}

export type OrdinaryChatOrchestrator = ReturnType<typeof createOrdinaryChatOrchestrator>
