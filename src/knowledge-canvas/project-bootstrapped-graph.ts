import { lessonFromCanonical } from '../session/request-canonical-answer.ts'
import type { GraphSnapshot } from '../session/request-graph-bootstrap.ts'
import type { CanvasEdge, CanvasNode } from './content'

export type CanonicalRootBody = {
  text: string
  contentHash: string
}

export type BootstrappedGraphView =
  | { kind: 'ready'; nodes: CanvasNode[]; edges: CanvasEdge[] }
  | { kind: 'unavailable'; title: string; message: string }

export function projectBootstrappedGraph(
  graph: GraphSnapshot,
  canonical: CanonicalRootBody,
  accent = '#158f81',
): BootstrappedGraphView {
  if (
    !canonical.text.trim()
    || canonical.contentHash !== graph.canonicalContentHash
    || canonical.contentHash !== graph.root.canonicalContentHash
  ) {
    return {
      kind: 'unavailable',
      title: graph.root.title,
      message: '已提交的知识脉络根节点必须绑定同一份首次回复，不能用结构占位或另一份正文代替。',
    }
  }
  const lesson = lessonFromCanonical(graph.root.title, canonical.text)
  return {
    kind: 'ready',
    nodes: [{
      id: graph.root.nodeId,
      accent,
      title: graph.root.title,
      role: 'flow',
      turns: [{
        question: `「${graph.root.title}」的首次回复`,
        replyKind: 'summary',
        paragraphs: lesson.paragraphs,
      }],
    }],
    edges: [],
  }
}
