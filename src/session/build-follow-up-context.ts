import type { CanvasEdge, CanvasNode } from '../knowledge-canvas/content'
import type { AskAuthorsAnnotation } from './ask-authors'
import { isLiuKanshanDirect } from './ask-authors'
import type { LearningTurn } from '../workspace/types'
import type { FollowUpHostResolution } from './resolve-follow-up-host'

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

function annotationOf(item: AskAuthorsAnnotation): FollowUpAnnotation {
  const direct = isLiuKanshanDirect(item.reply)
  return {
    annotationId: item.id,
    type: direct ? 'liu_kanshan_direct' : 'author_comment',
    content: item.reply?.text || item.error || item.question,
    authorId: direct ? null : (item.reply?.url || null),
  }
}

function nodeContent(node: CanvasNode) {
  const body = node.turns.flatMap((turn) => turn.paragraphs).join('\n\n').trim()
  if (body) return body
  return node.turns.map((turn) => turn.question).filter(Boolean).join('\n') || node.title
}

function asGraphNode(node: CanvasNode, annotations: readonly AskAuthorsAnnotation[]): FollowUpGraphNode {
  return {
    nodeId: node.id,
    title: node.title,
    content: nodeContent(node),
    annotations: annotations.filter((item) => item.nodeId === node.id && item.status === 'ready').map(annotationOf),
  }
}

export function buildFollowUpNeighborhood(input: {
  nodes: readonly CanvasNode[]
  edges: readonly CanvasEdge[]
  hostNodeId: string
  annotations?: readonly AskAuthorsAnnotation[]
}): {
  host: FollowUpGraphNode
  siblings: FollowUpGraphNode[]
  predecessors: FollowUpGraphNode[]
  successors: FollowUpGraphNode[]
  edges: FollowUpGraphEdge[]
} | undefined {
  const host = input.nodes.find((node) => node.id === input.hostNodeId)
  if (!host) return undefined
  const annotations = input.annotations ?? []
  const flowHostId = host.role === 'parallel' ? (host.hostId || host.id) : host.id
  const siblingIds = new Set(
    input.nodes
      .filter((node) => node.role === 'parallel' && node.hostId === flowHostId && node.id !== host.id)
      .map((node) => node.id),
  )
  const predecessorIds = new Set(
    input.edges.filter((edge) => edge.to === host.id && edge.kind === 'flow').map((edge) => edge.from),
  )
  const successorIds = new Set(
    input.edges.filter((edge) => edge.from === host.id && edge.kind === 'flow').map((edge) => edge.to),
  )
  const neighborhoodIds = new Set([host.id, ...siblingIds, ...predecessorIds, ...successorIds])
  const byId = new Map(input.nodes.map((node) => [node.id, node]))
  const pick = (ids: Set<string>) => [...ids].flatMap((id) => {
    const node = byId.get(id)
    return node ? [asGraphNode(node, annotations)] : []
  })
  return {
    host: asGraphNode(host, annotations),
    siblings: pick(siblingIds),
    predecessors: pick(predecessorIds),
    successors: pick(successorIds),
    edges: input.edges
      .filter((edge) => neighborhoodIds.has(edge.from) && neighborhoodIds.has(edge.to))
      .map((edge) => ({
        edgeId: edge.id,
        fromNodeId: edge.from,
        toNodeId: edge.to,
        explanation: edge.reason,
      })),
  }
}

export function buildFollowUpMessages(input: {
  lessonText: string
  turns: readonly LearningTurn[]
  annotations?: readonly AskAuthorsAnnotation[]
}): Array<{
  messageId: string
  role: 'user' | 'assistant'
  content: string
  annotations: FollowUpAnnotation[]
}> {
  const annotations = input.annotations ?? []
  const messages: Array<{
    messageId: string
    role: 'user' | 'assistant'
    content: string
    annotations: FollowUpAnnotation[]
  }> = [{
    messageId: 'm-root',
    role: 'assistant',
    content: input.lessonText,
    annotations: annotations.filter((item) => item.nodeId === 'root' && item.status === 'ready').map(annotationOf),
  }]
  input.turns.forEach((turn, index) => {
    if (turn.role !== 'user' && turn.role !== 'assistant') return
    messages.push({
      messageId: `m-${index + 1}`,
      role: turn.role,
      content: turn.text,
      annotations: annotations.filter((item) => item.nodeId && item.nodeId === turn.nodeId && item.status === 'ready').map(annotationOf),
    })
  })
  return messages
}

export function followUpQuoteForG2(
  host: FollowUpHostResolution,
  messages: readonly { messageId: string; role: string; content: string }[],
): { messageId: string | null; text: string | null } {
  if (host.ok !== true) return { messageId: null, text: null }
  const text = host.quote.text
  if (!text) return { messageId: null, text: null }
  const match = [...messages].reverse().find((item) => item.role === 'assistant' && item.content === text)
    ?? [...messages].reverse().find((item) => item.role === 'assistant' && item.content.includes(text))
  return { messageId: match?.messageId ?? 'm-root', text }
}
