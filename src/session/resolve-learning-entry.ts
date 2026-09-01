export type LearningEntryInput = {
  routeId: string
  conceptId: string
  route?: { id: string } | undefined
}

export type LearningEntry =
  | {
      kind: 'ready'
      routeId: string
      conceptId: string
    }
  | {
      kind: 'unavailable'
      reason: 'missing-route' | 'missing-concept'
      title: string
      message: string
    }

export function resolveLearningEntry(input: LearningEntryInput): LearningEntry {
  const routeId = input.routeId.trim()
  const conceptId = input.conceptId.trim()
  if (!routeId || !input.route) {
    return {
      kind: 'unavailable',
      reason: 'missing-route',
      title: '未选择学习概念',
      message: '没有可进入的学习概念。请从已打开的路线进入；不能默认打开线性代数示例，也不能发明首段讲解。',
    }
  }
  if (!conceptId) {
    return {
      kind: 'unavailable',
      reason: 'missing-concept',
      title: '未选择学习概念',
      message: '这条路线还没有指定概念。请从 3D 路线进入一个概念；不能默认打开“线性变换”。',
    }
  }
  return { kind: 'ready', routeId, conceptId }
}
