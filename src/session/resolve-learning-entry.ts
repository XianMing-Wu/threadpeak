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
      message: '没有可进入的学习内容。请从路线里选择一个概念。',
    }
  }
  if (!conceptId) {
    return {
      kind: 'unavailable',
      reason: 'missing-concept',
      title: '未选择学习概念',
      message: '这条路线还没有指定概念。请从路线里进入一个概念。',
    }
  }
  if (!input.conceptIds || !input.conceptIds.includes(conceptId)) {
    return {
      kind: 'unavailable',
      reason: 'concept-not-on-route',
      title: '概念不属于这条路线',
      message: '当前概念不在这条路线里。请重新选择。',
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
      message: '没有可进入的学习内容。请从路线进入。',
    }
  }
  if (input.route.owner === 'mine') {
    return {
      kind: 'unavailable',
      reason: 'missing-canonical-answer',
      title: '还没有第一段讲解',
      message: '这次学习还没准备好第一段讲解。请先从路线进入学习。',
    }
  }
  if (!input.catalogLesson) {
    return {
      kind: 'unavailable',
      reason: 'missing-example-lesson',
      title: '无法准备这次学习',
      message: '这次示例讲解还没准备好。请换一条路线试试。',
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
  hasRoot?: boolean
}

export type GraphMutation =
  | { kind: 'allow-example' }
  | { kind: 'allow-incremental' }
  | { kind: 'reject'; reason: 'missing-route' | 'missing-canonical-answer' }

export function resolveGraphMutation(input: GraphMutationInput): GraphMutation {
  const routeId = input.routeId.trim()
  if (!routeId) return { kind: 'reject', reason: 'missing-route' }
  if (input.owner === 'example') return { kind: 'allow-example' }
  if (input.owner === 'mine' && input.hasRoot === true) return { kind: 'allow-incremental' }
  return { kind: 'reject', reason: 'missing-canonical-answer' }
}
