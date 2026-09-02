import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'

type JsonRecord = Record<string, unknown>

export type RendererValidation =
  | { ok: true; document: LearningPathDocument }
  | { ok: false; issues: readonly string[] }

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string'
    && value.length >= minimum
    && value.length <= maximum
    && value.trim() === value
}

function isIdentifier(value: unknown): value is string {
  return isBoundedText(value, 1, 64) && /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/.test(value)
}

function isSafeResourceHref(value: unknown): value is string {
  if (!isBoundedText(value, 1, 2048)) return false
  if (value.startsWith('#')) return /^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)
  if (value.startsWith('/') && !value.startsWith('//')) {
    return !value.includes('\\') && !value.split(/[?#]/u, 1)[0]?.split('/').includes('..')
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function uniqueIds(values: readonly unknown[]): boolean {
  const ids = values.map((value) => isRecord(value) ? value.id : undefined)
  return ids.every(isIdentifier) && new Set(ids).size === ids.length
}

function isFlowGroup(value: unknown): boolean {
  if (!isRecord(value) || !isIdentifier(value.id) || !isIdentifier(value.anchorSubjectId)) return false
  if (value.type === 'split') return value.policy === 'parallel'
  if (value.type === 'join') return value.policy === 'all-required'
  return false
}

export function validateRendererDocument(value: unknown): RendererValidation {
  const raw: unknown = value
  const issues: string[] = []
  if (!isRecord(value) || value.protocol !== 'learning-path' || value.version !== '1.0' || !isIdentifier(value.id)) {
    return { ok: false, issues: ['document.protocol'] }
  }
  if (!isRecord(value.metadata)
    || !isBoundedText(value.metadata.title, 1, 160)
    || (value.metadata.description !== undefined && !isBoundedText(value.metadata.description, 1, 500))
    || !isBoundedText(value.metadata.locale, 2, 16)) {
    issues.push('document.metadata')
  }
  if (!isRecord(value.structure) || !isRecord(value.data) || !isRecord(value.presentation)) {
    return { ok: false, issues: ['document.sections'] }
  }
  const subjects = value.structure.subjects
  const concepts = value.structure.concepts
  const flow = value.structure.flow
  const flowGroups = value.structure.flowGroups
  const cards = value.data.cards
  const resources = value.data.resources
  const actions = value.data.actions
  if (!Array.isArray(subjects) || subjects.length < 1 || subjects.length > 128 || !uniqueIds(subjects)) issues.push('structure.subjects')
  if (!Array.isArray(concepts) || concepts.length > 1024 || !uniqueIds(concepts)) issues.push('structure.concepts')
  if (!Array.isArray(flow) || flow.length > 2048 || !uniqueIds(flow)) issues.push('structure.flow')
  if (!Array.isArray(flowGroups) || flowGroups.length > 256 || !uniqueIds(flowGroups)) issues.push('structure.flowGroups')
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 1152 || !uniqueIds(cards)) issues.push('data.cards')
  if (!Array.isArray(resources) || resources.length > 1024 || !uniqueIds(resources)) issues.push('data.resources')
  if (!Array.isArray(actions) || actions.length > 1024 || !uniqueIds(actions)) issues.push('data.actions')
  if (issues.length > 0) return { ok: false, issues }

  const subjectItems = subjects as readonly unknown[]
  const conceptItems = concepts as readonly unknown[]
  const flowItems = flow as readonly unknown[]
  const flowGroupItems = flowGroups as readonly unknown[]
  const cardItems = cards as readonly unknown[]
  const resourceItems = resources as readonly unknown[]
  const actionItems = actions as readonly unknown[]
  const subjectIds = new Set(subjectItems.map((subject) => (subject as JsonRecord).id as string))
  const cardIds = new Set(cardItems.map((card) => (card as JsonRecord).id as string))
  const resourceIds = new Set(resourceItems.map((resource) => (resource as JsonRecord).id as string))
  const actionIds = new Set(actionItems.map((action) => (action as JsonRecord).id as string))
  if (!isIdentifier(value.structure.entrySubjectId) || !subjectIds.has(value.structure.entrySubjectId)) issues.push('structure.entrySubjectId')
  if (!Array.isArray(value.structure.goalSubjectIds)
    || value.structure.goalSubjectIds.length < 1
    || !value.structure.goalSubjectIds.every((id) => isIdentifier(id) && subjectIds.has(id))) {
    issues.push('structure.goalSubjectIds')
  }
  if (!subjectItems.every((subject) => isRecord(subject) && isIdentifier(subject.id) && isIdentifier(subject.cardRef) && cardIds.has(subject.cardRef))) {
    issues.push('structure.subjects.cardRef')
  }
  if (!flowGroupItems.every((group) => isFlowGroup(group) && isRecord(group) && subjectIds.has(String(group.anchorSubjectId)))) {
    issues.push('structure.flowGroups.fields')
  }
  if (!cardItems.every((card) => isRecord(card)
    && isIdentifier(card.id)
    && isBoundedText(card.title, 1, 160)
    && isBoundedText(card.summary, 1, 500)
    && (card.tags === undefined || (Array.isArray(card.tags) && card.tags.length <= 12 && card.tags.every((tag) => isBoundedText(tag, 1, 40)))))) {
    issues.push('data.cards.fields')
  }
  if (!resourceItems.every((resource) => isRecord(resource) && isIdentifier(resource.id) && isSafeResourceHref(resource.href))) {
    issues.push('data.resources.fields')
  }
  if (!actionItems.every((action) => isRecord(action)
    && isIdentifier(action.id)
    && action.kind === 'open-resource'
    && isBoundedText(action.label, 1, 80)
    && isIdentifier(action.resourceId)
    && resourceIds.has(action.resourceId)
    && (action.target === undefined || action.target === 'self' || action.target === 'blank'))) {
    issues.push('data.actions.fields')
  }
  if (!conceptItems.every((concept) => isRecord(concept)
    && isIdentifier(concept.id)
    && isIdentifier(concept.subjectId)
    && subjectIds.has(concept.subjectId)
    && isIdentifier(concept.cardRef)
    && cardIds.has(concept.cardRef)
    && isIdentifier(concept.actionRef)
    && actionIds.has(concept.actionRef))) {
    issues.push('structure.concepts.fields')
  }
  if (!flowItems.every((edge) => isRecord(edge)
    && isIdentifier(edge.id)
    && isIdentifier(edge.fromSubjectId)
    && isIdentifier(edge.toSubjectId)
    && edge.fromSubjectId !== edge.toSubjectId
    && subjectIds.has(edge.fromSubjectId)
    && subjectIds.has(edge.toSubjectId))) {
    issues.push('structure.flow.fields')
  }
  if (!isRecord(value.presentation.layout) || value.presentation.layout.direction !== 'top-to-bottom') {
    issues.push('presentation.layout')
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, document: raw as LearningPathDocument }
}

export function isLearningPathRendererDocument(value: unknown): value is LearningPathDocument {
  return validateRendererDocument(value).ok
}

export function validRendererDocumentFixture(id = 'contract-path'): LearningPathDocument {
  return {
    protocol: 'learning-path',
    version: '1.0',
    id,
    metadata: { title: '合同路线', locale: 'zh-CN' },
    structure: {
      entrySubjectId: 'subject-start',
      goalSubjectIds: ['subject-goal'],
      subjects: [
        { id: 'subject-start', cardRef: 'card-start', orderHint: 1 },
        { id: 'subject-core', cardRef: 'card-core', orderHint: 2 },
        { id: 'subject-goal', cardRef: 'card-goal', orderHint: 3 },
      ],
      concepts: [
        {
          id: 'concept-start',
          subjectId: 'subject-core',
          cardRef: 'card-concept',
          actionRef: 'action-concept',
          orderHint: 1,
        },
      ],
      flow: [
        { id: 'flow-start-core', fromSubjectId: 'subject-start', toSubjectId: 'subject-core' },
        { id: 'flow-core-goal', fromSubjectId: 'subject-core', toSubjectId: 'subject-goal' },
      ],
      flowGroups: [],
    },
    data: {
      cards: [
        { id: 'card-start', title: '起点', summary: '从这里开始。' },
        { id: 'card-core', title: '载体', summary: '承载核心概念。' },
        { id: 'card-goal', title: '目标', summary: '到达目标。' },
        { id: 'card-concept', title: '核心概念', summary: '理解核心概念。' },
      ],
      resources: [
        { id: 'resource-concept', href: 'https://www.zhihu.com/question/1' },
      ],
      actions: [
        {
          id: 'action-concept',
          kind: 'open-resource',
          label: '查看内容',
          resourceId: 'resource-concept',
          target: 'blank',
        },
      ],
    },
    presentation: { layout: { direction: 'top-to-bottom' } },
  }
}
