import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import type { PathCarrierSpec } from './workspace/types'

export function buildPathDocument(spec: {
  id: string
  title: string
  description: string
  goalTitle: string
  goalSummary: string
  startSummary?: string
  carriers: readonly PathCarrierSpec[]
}): LearningPathDocument {
  const carriers = spec.carriers
  const cards: LearningPathDocument['data']['cards'] = [
    ...carriers.flatMap((carrier) => [
      { id: `card-${carrier.id}`, eyebrow: '载体', title: carrier.title, summary: carrier.summary, tags: ['知乎精选', '学习载体'] },
      ...carrier.concepts.map(([id, title, summary]) => ({
        id: `card-${id}`,
        eyebrow: '最终概念',
        title,
        summary,
        body: `${summary}。本段知识脉络包含 1–4 篇知乎内容，并可包含你上传的 PDF。`,
        tags: ['知乎', 'PDF'],
      })),
    ]),
    { id: 'card-start', eyebrow: '路线起点', title: '从这里出发', summary: spec.startSummary ?? '刘看山会陪你沿着必要概念抵达目标。', tags: ['开始'] },
    { id: 'card-goal', eyebrow: '学习目标', title: spec.goalTitle, summary: spec.goalSummary, tags: ['路线终点'] },
  ]
  return {
    protocol: 'learning-path',
    version: '1.0',
    id: spec.id,
    metadata: { title: spec.title, description: spec.description, locale: 'zh-CN' },
    structure: {
      entrySubjectId: 'route-start',
      goalSubjectIds: ['goal-understanding'],
      subjects: [
        { id: 'route-start', cardRef: 'card-start', orderHint: 0 },
        ...carriers.map((carrier, index) => ({ id: carrier.id, cardRef: `card-${carrier.id}`, orderHint: index + 1 })),
        { id: 'goal-understanding', cardRef: 'card-goal', orderHint: carriers.length + 1 },
      ],
      concepts: carriers.flatMap((carrier) => carrier.concepts.map(([id], index) => ({
        id,
        subjectId: carrier.id,
        cardRef: `card-${id}`,
        actionRef: `action-${id}`,
        orderHint: index + 1,
      }))),
      flow: [
        { id: 'flow-start', fromSubjectId: 'route-start', toSubjectId: carriers[0]!.id },
        ...carriers.slice(1).map((carrier, index) => ({ id: `flow-${index + 1}`, fromSubjectId: carriers[index]!.id, toSubjectId: carrier.id })),
        { id: 'flow-goal', fromSubjectId: carriers.at(-1)!.id, toSubjectId: 'goal-understanding' },
      ],
      flowGroups: [],
    },
    data: {
      cards,
      resources: carriers.flatMap((carrier) => carrier.concepts.map(([id]) => ({ id: `resource-${id}`, href: '#session-learning' }))),
      actions: carriers.flatMap((carrier) => carrier.concepts.map(([id]) => ({
        id: `action-${id}`,
        kind: 'open-resource' as const,
        label: '进入学习',
        resourceId: `resource-${id}`,
        target: 'self' as const,
      }))),
    },
    presentation: { layout: { direction: 'top-to-bottom', subjectGap: 3.75, layerGap: 3.5, conceptGap: 3.75, conceptColumnGap: 4.4 } },
  }
}

const carriers = [
  {id:'carrier-foundation',title:'数学基础',summary:'用向量、基与矩阵建立统一语言。',concepts:[['vector-space','向量空间','线性组合、张成、基与维数'],['linear-map','线性变换','把矩阵看作空间中的动作']]},
  {id:'carrier-structure',title:'变换结构',summary:'理解线性变换中稳定与被压缩的结构。',concepts:[['kernel-image','核、像与秩','描述消失方向与可达空间'],['eigen','特征值与特征向量','寻找变换中保持方向的轴']]},
  {id:'carrier-probability',title:'数据视角',summary:'从统计分布理解数据的主要变化方向。',concepts:[['variance','方差与协方差','度量变化强度与变量联动'],['covariance-matrix','协方差矩阵','把多维变量关系写成矩阵']]},
  {id:'carrier-application',title:'机器学习应用',summary:'把前面的概念汇入可解释的降维方法。',concepts:[['pca','主成分分析 PCA','选择信息保留最多的投影轴'],['projection','二维数据投影','把 PCA 用到一次真实降维中']]},
] as const

export const threadPeakPathDocument = buildPathDocument({
  id: 'threadpeak-linear-algebra-v1',
  title: '从线性代数走向机器学习',
  description: '四段学习内容，串起八个核心概念。',
  goalTitle: '理解的高峰',
  goalSummary: '能够用几何语言解释 PCA，并完成一次二维数据降维。',
  startSummary: '刘看山会陪你沿着必要概念抵达目标。',
  carriers,
})
