import { CARD_H, MAX_CARD_H } from './layout'

export type NodeTurn = {
  title?: string
  question: string
  replyKind: 'full' | 'summary'
  paragraphs: readonly string[]
  figure?: { caption: string }
}

export type CanvasNode = {
  id: string
  accent: string
  title: string
  role: 'flow' | 'parallel'
  hostId?: string
  conversationId?: string
  grow?: 'pred' | 'succ' | 'par'
  turns: readonly NodeTurn[]
}

export type CanvasEdge = {
  id: string
  from: string
  to: string
  kind: 'flow' | 'parallel'
  grow?: 'pred' | 'succ' | 'par'
  label?: string
  reason: string
}

export const canvasNodes: CanvasNode[] = [
  {
    id: 'root',
    accent: '#158f81',
    title: '线性变换',
    role: 'flow',
    turns: [{
      question: '为什么矩阵不只是数字表格？',
      replyKind: 'full',
      paragraphs: [
        '如果只把矩阵当成一张数字表，它很容易变成机械计算。更有用的视角是：矩阵描述一个规则，这个规则把空间里的每个向量送到另一个位置。',
        '二维矩阵的两列，分别记录两个基向量 e₁ 与 e₂ 经过变换后的去向。因为线性变换保持加法和数乘，知道基向量怎么走，就知道整个平面怎么走。',
        '矩阵不是变换本身，而是某个基下对变换的坐标描述。',
      ],
      figure: { caption: '基向量经过线性变换后的去向' },
    }],
  },
  {
    id: 'n1',
    accent: '#158f81',
    title: '矩阵与基向量',
    role: 'flow',
    turns: [{
      question: '矩阵的每一列代表什么？',
      replyKind: 'full',
      paragraphs: [
        '矩阵每一列记录一个基向量经过变换后的去向。任意向量先写成基的线性组合，再按同样的系数组合这些“去向”，就得到变换结果。',
        '所以读矩阵时，不要先盯住单个数字，而要先问：第一列把 e₁ 送到了哪里，第二列把 e₂ 送到了哪里。',
      ],
      figure: { caption: '两列分别是两个基向量的像' },
    }],
  },
  {
    id: 'n1p',
    accent: '#6b7280',
    title: '列空间的另一问法',
    role: 'parallel',
    hostId: 'n1',
    turns: [
      {
        question: '如果先问列空间而不是基向量，会漏掉什么？',
        replyKind: 'full',
        paragraphs: [
          '列空间回答“变换能走到哪些地方”，但还没有说明每一列具体推着哪一条基方向走。',
          '并列这条支线，是为了保留另一种提问方式，而不打断主干从基向量走到特征方向。',
        ],
        figure: { caption: '列空间描述能到达的位置，不描述每一列的动作' },
      },
      {
        title: '要不要并进主干',
        question: '那这个问题要不要并进主干？',
        replyKind: 'full',
        paragraphs: [
          '不必。主干继续沿基向量推进；列空间这条并列问法仍挂在同一张虚线卡里，需要时再展开。',
          '一个主干节点只对应一张并列卡。新的并列问题写进这张卡，并给这一问单独标题。',
        ],
      },
    ],
  },
  {
    id: 'n2',
    accent: '#c28a2e',
    title: '核、像与秩',
    role: 'flow',
    turns: [{
      question: '变换压缩了哪些方向？',
      replyKind: 'full',
      paragraphs: [
        '核描述被压到零的方向，像描述变换后还能到达的空间。秩把两者和自由度联系起来：被压缩掉的维度，就是无法保留的信息。',
        '先看见压缩，再谈降维，PCA 才不是一套突然出现的公式。',
      ],
    }],
  },
  {
    id: 'n3',
    accent: '#158f81',
    title: '特征方向',
    role: 'flow',
    turns: [{
      question: '哪些方向在变换后保持不变？',
      replyKind: 'full',
      paragraphs: [
        '特征向量在变换后只发生缩放，不转向。特征值就是这条方向上的伸缩倍数。',
        '找到这些方向，等于把复杂动作分解成一组独立的拉伸或压缩。',
      ],
    }],
  },
  {
    id: 'n4',
    accent: '#c28a2e',
    title: '通向 PCA',
    role: 'flow',
    turns: [{
      question: '怎样选出信息保留最多的方向？',
      replyKind: 'full',
      paragraphs: [
        '协方差矩阵的特征方向给出数据变化最大的主轴。按特征值从大到小排列，就是按信息量排序。',
        '于是核、像与秩里建立的“压缩直觉”，在这里变成可计算的保留标准。',
      ],
    }],
  },
]

export const canvasEdges: CanvasEdge[] = [
  { id: 'e1', from: 'root', to: 'n1', kind: 'flow', label: '1', reason: '先建立矩阵与基向量的几何对应，避免把线性变换停留在数值运算层。' },
  { id: 'e2', from: 'root', to: 'n2', kind: 'flow', label: '2', reason: '同一父节点的第二条后置分叉，转向结构性质，解释信息如何被压缩或保留。' },
  { id: 'e3', from: 'n1', to: 'n3', kind: 'flow', label: '1', reason: '理解基向量去向后，自然追问是否存在保持方向不变的特殊向量。' },
  { id: 'e4', from: 'n2', to: 'n4', kind: 'flow', label: '1', reason: '核、像与秩建立降维直觉后，再连接到 PCA 的信息保留标准。' },
  { id: 'ep1', from: 'n1', to: 'n1p', kind: 'parallel', reason: '同一节点上的并列问法：不进入后置主干，只用虚线挂在当前节点下方。' },
]

export function estimateNodeHeight(node: CanvasNode): number {
  let height = 48
  for (const turn of node.turns) {
    if (turn.title) height += 28
    height += 26
    for (const paragraph of turn.paragraphs) height += Math.max(1, Math.ceil(paragraph.length / 22)) * 20
    if (turn.figure) height += 132
    height += turn.replyKind === 'summary' ? 10 : 14
  }
  return Math.min(MAX_CARD_H, Math.max(CARD_H, Math.round(height)))
}

export function flowBranchLabel(
  edges: readonly CanvasEdge[],
  edge: CanvasEdge,
): string {
  if (edge.kind !== 'flow') return ''
  const siblings = edges.filter((item) => item.kind === 'flow' && item.from === edge.from)
  return String(siblings.findIndex((item) => item.id === edge.id) + 1)
}
