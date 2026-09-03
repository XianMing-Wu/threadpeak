import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import { addUniqueDraft, stabilizeHostSubjectDrafts } from './host-subject-flow.ts'
import { isLearningPathRendererDocument, validateRendererDocument } from './validate-renderer-document.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clip(value: string, max: number, fallback: string): string {
  const compact = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  const sliced = compact.slice(0, max).trim()
  return sliced || fallback
}

function nextId(used: Set<string>, base: string): string {
  let candidate = base.slice(0, 64)
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 60)}-${n}`.slice(0, 64)
    n += 1
  }
  used.add(candidate)
  return candidate
}

/**
 * Make an already-published mine document satisfy the 3D host graph contract
 * without changing concept ids or card copy beyond clipping.
 */
export function repairHostDocument(value: unknown): unknown {
  if (isLearningPathRendererDocument(value)) return value
  if (!isRecord(value) || value.protocol !== 'learning-path' || !isRecord(value.structure) || !isRecord(value.data)) {
    return value
  }

  const structure = value.structure
  const data = value.data
  const subjects = Array.isArray(structure.subjects) ? structure.subjects.filter(isRecord) : []
  const concepts = Array.isArray(structure.concepts) ? structure.concepts.filter(isRecord) : []
  const flow = Array.isArray(structure.flow) ? structure.flow.filter(isRecord) : []
  const cards = Array.isArray(data.cards) ? data.cards.filter(isRecord) : []
  if (subjects.length === 0) return value

  const used = new Set<string>()
  for (const item of [...subjects, ...concepts, ...flow, ...cards]) {
    if (typeof item.id === 'string') used.add(item.id)
  }

  const entryId = typeof structure.entrySubjectId === 'string' ? structure.entrySubjectId : String(subjects[0]?.id ?? '')
  const conceptOwners = new Set(concepts.map((item) => String(item.subjectId)))
  const subjectIds = subjects.map((item) => String(item.id))
  let goalIds = Array.isArray(structure.goalSubjectIds)
    ? structure.goalSubjectIds.filter((id): id is string => typeof id === 'string')
    : []
  const goalsOwnConcepts = goalIds.some((id) => conceptOwners.has(id))
  const hasCleanGoal = goalIds.some((id) => subjectIds.includes(id) && !conceptOwners.has(id))

  const nextSubjects = [...subjects]
  const nextCards: Record<string, unknown>[] = cards.map((card) => ({
    ...card,
    title: typeof card.title === 'string' ? clip(card.title, 160, '标题') : card.title,
    summary: typeof card.summary === 'string' ? clip(card.summary, 500, '摘要') : card.summary,
    ...(typeof card.body === 'string' ? { body: clip(card.body, 4000, '进入学习') } : {}),
  }))

  let goalId = goalIds.find((id) => subjectIds.includes(id) && !conceptOwners.has(id))
  if (!hasCleanGoal || goalsOwnConcepts || !goalId) {
    goalId = nextId(used, `pg-${String(value.id ?? 'goal').replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'goal'}`)
    const goalCardId = nextId(used, `pgc-${goalId.slice(3) || 'goal'}`)
    const title = isRecord(value.metadata) && typeof value.metadata.title === 'string'
      ? clip(value.metadata.title, 160, '学习目标')
      : '学习目标'
    nextSubjects.push({ id: goalId, cardRef: goalCardId, orderHint: nextSubjects.length + 1 })
    nextCards.push({
      id: goalCardId,
      eyebrow: '学习目标',
      title,
      summary: '沿着推荐载体前进，任意概念都可以进入。',
    })
    goalIds = [goalId]
  }

  const intended: Array<{ from: string; to: string }> = []
  for (const edge of flow) {
    const from = String(edge.fromSubjectId ?? '')
    const to = String(edge.toSubjectId ?? '')
    if (subjectIds.includes(from) && (subjectIds.includes(to) || to === goalId)) addUniqueDraft(intended, from, to)
  }

  const outgoingOf = (id: string) => intended.filter((item) => item.from === id)
  const carrierIds = subjectIds.filter((id) => id !== entryId && id !== goalId)
  const terminals = carrierIds.filter((id) => outgoingOf(id).every((edge) => edge.to === goalId) || outgoingOf(id).length === 0)
  for (const id of terminals.length > 0 ? terminals : carrierIds.slice(-1)) addUniqueDraft(intended, id, goalId)

  const allIds = [...new Set([...subjectIds, goalId, entryId])]
  const drafts = stabilizeHostSubjectDrafts(intended, entryId, goalId, allIds)

  const outgoingBy = new Map<string, typeof drafts>()
  const incomingBy = new Map<string, typeof drafts>()
  for (const id of allIds) {
    outgoingBy.set(id, [])
    incomingBy.set(id, [])
  }
  for (const edge of drafts) {
    outgoingBy.get(edge.from)?.push(edge)
    incomingBy.get(edge.to)?.push(edge)
  }

  const flowGroups: Array<LearningPathDocument['structure']['flowGroups'][number]> = []
  const splitOf = new Map<string, string>()
  const joinOf = new Map<string, string>()
  for (const [id, edges] of outgoingBy) {
    if (edges.length < 2) continue
    const groupId = nextId(used, `fg-split-${id}`.replace(/[^a-z0-9-]+/g, '').slice(0, 64))
    flowGroups.push({ id: groupId, type: 'split', anchorSubjectId: id, policy: 'parallel' })
    for (const edge of edges) splitOf.set(`${edge.from}->${edge.to}`, groupId)
  }
  for (const [id, edges] of incomingBy) {
    if (edges.length < 2) continue
    const groupId = nextId(used, `fg-join-${id}`.replace(/[^a-z0-9-]+/g, '').slice(0, 64))
    flowGroups.push({ id: groupId, type: 'join', anchorSubjectId: id, policy: 'all-required' })
    for (const edge of edges) joinOf.set(`${edge.from}->${edge.to}`, groupId)
  }

  const nextFlow = drafts.map((edge) => {
    const key = `${edge.from}->${edge.to}`
    const splitGroupId = splitOf.get(key)
    const joinGroupId = joinOf.get(key)
    return {
      id: nextId(used, `f-${edge.from}-${edge.to}`.replace(/[^a-z0-9-]+/g, '').slice(0, 64)),
      fromSubjectId: edge.from,
      toSubjectId: edge.to,
      ...(splitGroupId || joinGroupId
        ? { semantics: { ...(splitGroupId ? { splitGroupId } : {}), ...(joinGroupId ? { joinGroupId } : {}) } }
        : {}),
    }
  })

  const repaired = {
    ...value,
    structure: {
      ...structure,
      entrySubjectId: entryId,
      goalSubjectIds: goalIds,
      subjects: nextSubjects,
      concepts,
      flow: nextFlow,
      flowGroups,
    },
    data: {
      ...data,
      cards: nextCards,
    },
  }
  const validated = validateRendererDocument(repaired)
  return validated.ok ? validated.document : value
}
