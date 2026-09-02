export type LearningEntryInput = {
  routeId: string
  conceptId: string
  route?: { id: string } | undefined
  conceptIds?: readonly string[]
}

export type LearningEntry =
  | {
      kind: 'ready'
      routeId: string
      conceptId: string
    }
  | {
      kind: 'unavailable'
      reason: 'missing-route' | 'missing-concept' | 'concept-not-on-route'
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
  if (!input.conceptIds || !input.conceptIds.includes(conceptId)) {
    return {
      kind: 'unavailable',
      reason: 'concept-not-on-route',
      title: '概念不属于这条路线',
      message: '当前概念不在这条路线里。不能把另一条路线的概念接到这次学习会话。',
    }
  }
  return { kind: 'ready', routeId, conceptId }
}

export function resolveOpenLearningTarget(routeId: string, conceptId?: string) {
  return {
    routeId: routeId.trim(),
    conceptId: conceptId?.trim() ?? '',
  }
}

export type FirstLessonInput = {
  routeId: string
  conceptId: string
  route?: { id: string; owner: 'mine' | 'example' }
  catalogLesson?: {
    heading: string
    paragraphs: string[]
    placeholder: string
    quote?: string
    figureCaption?: string
  }
}

export type FirstLessonResolution =
  | {
      kind: 'ready'
      source: 'example-catalog'
      routeId: string
      conceptId: string
    }
  | {
      kind: 'unavailable'
      reason: 'missing-route' | 'missing-canonical-answer' | 'missing-example-lesson'
      title: string
      message: string
    }

export function resolveFirstLesson(input: FirstLessonInput): FirstLessonResolution {
  const routeId = input.routeId.trim()
  const conceptId = input.conceptId.trim()
  if (!routeId || !input.route) {
    return {
      kind: 'unavailable',
      reason: 'missing-route',
      title: '无法准备这次学习',
      message: '没有可进入的学习概念。不能发明首段讲解，也不能因此创建知识脉络。',
    }
  }
  if (input.route.owner === 'mine') {
    return {
      kind: 'unavailable',
      reason: 'missing-canonical-answer',
      title: '还没有这次概念的首次回复',
      message: '这条用户路线还没有已 settle 的首次回复。不能用草稿发明一课，也不能在首次回复之前创建知识脉络。',
    }
  }
  if (!input.catalogLesson) {
    return {
      kind: 'unavailable',
      reason: 'missing-example-lesson',
      title: '无法准备这次学习',
      message: '这条示例路线没有已标记的概念讲解，不能用草稿发明一课。',
    }
  }
  return { kind: 'ready', source: 'example-catalog', routeId, conceptId }
}

export type KnowledgeMigrationInput = {
  owner?: 'mine' | 'example'
  routeId: string
  hasExampleBlueprint?: boolean
}

export type KnowledgeMigration =
  | { kind: 'rewrite-example' }
  | { kind: 'keep'; reason: 'mine-route' | 'unknown-route' }

export function resolveKnowledgeMigration(input: KnowledgeMigrationInput): KnowledgeMigration {
  const routeId = input.routeId.trim()
  if (!routeId) return { kind: 'keep', reason: 'unknown-route' }
  if (input.owner === 'mine') return { kind: 'keep', reason: 'mine-route' }
  if (input.owner === 'example' && input.hasExampleBlueprint) return { kind: 'rewrite-example' }
  return { kind: 'keep', reason: 'unknown-route' }
}

export type GraphMutationInput = {
  routeId: string
  owner?: 'mine' | 'example'
}

export type GraphMutation =
  | { kind: 'allow-example' }
  | { kind: 'reject'; reason: 'missing-route' | 'missing-canonical-answer' }

export function resolveGraphMutation(input: GraphMutationInput): GraphMutation {
  const routeId = input.routeId.trim()
  if (!routeId) return { kind: 'reject', reason: 'missing-route' }
  if (input.owner === 'example') return { kind: 'allow-example' }
  return { kind: 'reject', reason: 'missing-canonical-answer' }
}
