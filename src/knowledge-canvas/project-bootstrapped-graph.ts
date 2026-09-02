import type { CanvasEdge, CanvasNode } from './content'
import type { GraphSnapshot } from '../session/request-graph-bootstrap'

export function projectBootstrappedGraph(graph: GraphSnapshot, accent = '#158f81'): {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
} {
  const root: CanvasNode = {
    id: graph.root.nodeId,
    accent,
    title: graph.root.title,
    role: 'flow',
    turns: [{
      question: `「${graph.root.title}」的概念根节点`,
      replyKind: 'summary',
      paragraphs: [
        '这个根节点由 GraphSurgeon 在首次回复 settle 之后创建，只作为结构锚点，不是从首次回复抽取的知识草稿。',
        `绑定的首次回复 content hash：${graph.root.canonicalContentHash}`,
      ],
    }],
  }
  return { nodes: [root], edges: [] }
}
