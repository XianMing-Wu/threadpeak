import type { G1Output } from '../agent-runtime/schemas.ts'
import type {
  AgentFailureCode,
  StructuredAgentId,
  StructuredInvokeResult,
  TextInvokeResult,
  ThinkingDepth,
} from '../agent-runtime/types.ts'

export type FollowUpAnnotation = {
  annotationId: string
  type: 'author_comment' | 'liu_kanshan_direct'
  content: string
  authorId: string | null
  evidenceIds?: string[]
}

export type FollowUpGraphNode = {
  nodeId: string
  title: string
  content: string
  annotations: FollowUpAnnotation[]
}

export type FollowUpGraphEdge = {
  edgeId: string
  fromNodeId: string
  toNodeId: string
  explanation: string
}

export type FollowUpMessage = {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  annotations?: FollowUpAnnotation[]
}

export type FollowUpGrow = {
  relation: 'predecessor' | 'successor' | 'parallel'
  title: string
  edgeExplanation: string
}

export type FollowUpResult =
  | {
    kind: 'completed'
    text: string
    hostNodeId: string
    grow: FollowUpGrow | null
  }
  | { kind: 'failed'; code: AgentFailureCode; message: string }

export type FollowUpInvokeStructured = <T>(
  agentId: StructuredAgentId,
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth },
) => Promise<StructuredInvokeResult<T>>

export type FollowUpInvokeText = (
  agentId: 'G2',
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth },
) => Promise<TextInvokeResult>

function asNode(value: FollowUpGraphNode | undefined): FollowUpGraphNode | undefined {
  if (!value || typeof value.nodeId !== 'string' || !value.nodeId.trim()) return undefined
  if (typeof value.title !== 'string' || typeof value.content !== 'string') return undefined
  return {
    nodeId: value.nodeId,
    title: value.title,
    content: value.content,
    annotations: Array.isArray(value.annotations) ? value.annotations : [],
  }
}

export function createFollowUpOrchestrator(ports: {
  invokeStructured: FollowUpInvokeStructured
  invokeText: FollowUpInvokeText
}) {
  const ask = async (input: {
    routeId: string
    conceptId: string
    conversationId: string
    question: string
    hostNodeId?: string
    quote?: { nodeId?: string | null; text?: string | null; messageId?: string | null }
    neighborhood?: {
      host?: FollowUpGraphNode
      siblings?: FollowUpGraphNode[]
      predecessors?: FollowUpGraphNode[]
      successors?: FollowUpGraphNode[]
      edges?: FollowUpGraphEdge[]
    }
    messages?: FollowUpMessage[]
    thinkingDepth?: ThinkingDepth
    onText?: (text: string) => void
  }): Promise<FollowUpResult> => {
    const question = input.question.trim()
    const conversationId = input.conversationId.trim()
    const conceptId = input.conceptId.trim()
    if (!question) {
      return { kind: 'failed', code: 'PROVIDER_INVALID', message: '学习追问必须先写下问题。' }
    }
    if (!input.routeId.trim() || !conceptId || !conversationId) {
      return { kind: 'failed', code: 'PROVIDER_INVALID', message: '学习追问需要明确的路线、概念和当前对话。' }
    }
    const host = asNode(input.neighborhood?.host)
    if (!host) {
      return { kind: 'failed', code: 'PROVIDER_INVALID', message: '没有可挂载的宿主卡片，不能发送这次追问。' }
    }
    const hostNodeId = (input.hostNodeId?.trim() || host.nodeId)
    if (hostNodeId !== host.nodeId) {
      return { kind: 'failed', code: 'PROVIDER_INVALID', message: '宿主卡片必须是邻域里真实存在的节点。' }
    }
    const thinkingDepth = input.thinkingDepth === 'deep' ? 'deep' : 'fast'
    const quoteNodeId = input.quote?.nodeId ?? null
    const quoteText = input.quote?.text ?? null
    const quoteMessageId = input.quote?.messageId ?? null
    const g1Context = {
      host,
      siblings: input.neighborhood?.siblings ?? [],
      predecessors: input.neighborhood?.predecessors ?? [],
      successors: input.neighborhood?.successors ?? [],
      edges: input.neighborhood?.edges ?? [],
      question: {
        text: question,
        quote: {
          nodeId: quoteNodeId,
          text: quoteText,
        },
      },
    }
    const g2Context = {
      conceptId,
      conversationId,
      messages: input.messages ?? [],
      currentQuestion: question,
      quote: {
        messageId: quoteMessageId,
        text: quoteText,
      },
    }

    const g1Promise = ports.invokeStructured<G1Output>('G1', g1Context, { thinkingDepth })
    const g2Promise = ports.invokeText('G2', g2Context, { thinkingDepth })
    const g2 = await g2Promise
    if (g2.kind === 'failed') {
      await g1Promise.catch(() => undefined)
      return { kind: 'failed', code: g2.code, message: g2.message }
    }
    input.onText?.(g2.text)
    const g1 = await g1Promise
    return {
      kind: 'completed',
      text: g2.text,
      hostNodeId,
      grow: g1.kind === 'completed' ? g1.value : null,
    }
  }

  return { ask }
}

export type FollowUpOrchestrator = ReturnType<typeof createFollowUpOrchestrator>
