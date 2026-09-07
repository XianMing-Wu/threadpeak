import { createHash } from 'node:crypto'
import type { LearningPathDocument } from '../../packages/contracts/src/path-document.ts'
import { addUniqueDraft, stabilizeHostSubjectDrafts } from '../../packages/contracts/src/host-subject-flow.ts'
import { validateRendererDocument } from '../../packages/contracts/src/validate-renderer-document.ts'
import { preflightLearningPath } from '../../src/vendor/learning-path-3d/index.js'
import type { R4Output } from '../agent-runtime/schemas.ts'

const WIRE = /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function clip(value: string, max: number, fallback: string): string {
  const compact = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  const sliced = compact.slice(0, max).trim()
  return sliced || fallback
}

export function toWireId(raw: string, used: Set<string>, prefix = ''): string {
  const lowered = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const body = /^[a-z]/.test(lowered) ? lowered : `x${lowered || 'id'}`
  let candidate = `${prefix}${body}`.slice(0, 64)
  if (!WIRE.test(candidate)) candidate = `id-${sha(raw).slice(0, 12)}`
  let unique = candidate
  let n = 2
  while (used.has(unique) || !WIRE.test(unique)) {
    unique = `${candidate.slice(0, 60)}-${n}`.slice(0, 64)
    n += 1
  }
  used.add(unique)
  return unique
}

function outgoingCount(route: R4Output): Map<string, number> {
  const counts = new Map(route.carriers.map((item) => [item.id, 0]))
  for (const edge of route.carrierEdges) {
    counts.set(edge.fromCarrierId, (counts.get(edge.fromCarrierId) ?? 0) + 1)
  }
  return counts
}

export type ProjectedPath = {
  document: LearningPathDocument
  conceptIdByWireId: Record<string, string>
  wireIdByConceptId: Record<string, string>
}

export function projectRouteToDocument(route: R4Output): { ok: true; value: ProjectedPath } | { ok: false; message: string } {
  const used = new Set<string>()
  const documentId = toWireId(sha(route.routeId).slice(0, 16), used, 'lp-')
  const startId = toWireId(sha(`start:${route.routeId}`).slice(0, 12), used, 'ps-')
  const startCardId = toWireId(sha(`start-card:${route.routeId}`).slice(0, 12), used, 'psc-')

  const subjectByCarrier = new Map<string, string>()
  const subjectCardByCarrier = new Map<string, string>()
  for (const carrier of route.carriers) {
    subjectByCarrier.set(carrier.id, toWireId(carrier.id, used, 's-'))
    subjectCardByCarrier.set(carrier.id, toWireId(carrier.id, used, 'cs-'))
  }

  const conceptWire = new Map<string, string>()
  const conceptCard = new Map<string, string>()
  const conceptAction = new Map<string, string>()
  const conceptResource = new Map<string, string>()
  for (const concept of route.concepts) {
    const slug = toWireId(concept.id, used, 'n-')
    conceptWire.set(concept.id, slug)
    conceptCard.set(concept.id, toWireId(concept.id, used, 'cc-'))
    conceptAction.set(concept.id, toWireId(slug, used, 'action-'))
    conceptResource.set(concept.id, toWireId(concept.id, used, 'r-'))
  }

  const goalId = toWireId(sha(`goal:${route.routeId}`).slice(0, 12), used, 'pg-')
  const goalCardId = toWireId(sha(`goal-card:${route.routeId}`).slice(0, 12), used, 'pgc-')

  const entryCarrierIds = new Set(
    route.concepts.filter((item) => route.entryConceptIds.includes(item.id)).map((item) => item.carrierId),
  )
  if (entryCarrierIds.size === 0) entryCarrierIds.add(route.carriers[0]!.id)

  const intended: Array<{ from: string; to: string }> = []
  for (const carrierId of entryCarrierIds) {
    const to = subjectByCarrier.get(carrierId)
    if (to) addUniqueDraft(intended, startId, to)
  }
  for (const edge of route.carrierEdges) {
    const from = subjectByCarrier.get(edge.fromCarrierId)
    const to = subjectByCarrier.get(edge.toCarrierId)
    if (from && to) addUniqueDraft(intended, from, to)
  }

  const out = outgoingCount(route)
  const terminals = route.carriers.filter((carrier) => (out.get(carrier.id) ?? 0) === 0)
  const goalCarriers = terminals.length > 0 ? terminals : [route.carriers.at(-1)!]
  for (const carrier of goalCarriers) {
    const from = subjectByCarrier.get(carrier.id)
    if (from) addUniqueDraft(intended, from, goalId)
  }

  const carrierSubjects = [...subjectByCarrier.values()]
  const allSubjects = [startId, ...carrierSubjects, goalId]
  const drafts = stabilizeHostSubjectDrafts(intended, startId, goalId, allSubjects)

  const outgoingBy = new Map<string, typeof drafts>()
  const incomingBy = new Map<string, typeof drafts>()
  for (const id of allSubjects) {
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
    const groupId = toWireId(`split-${id}`, used, 'fg-')
    flowGroups.push({ id: groupId, type: 'split', anchorSubjectId: id, policy: 'parallel' })
    for (const edge of edges) splitOf.set(`${edge.from}->${edge.to}`, groupId)
  }
  for (const [id, edges] of incomingBy) {
    if (edges.length < 2) continue
    const groupId = toWireId(`join-${id}`, used, 'fg-')
    flowGroups.push({ id: groupId, type: 'join', anchorSubjectId: id, policy: 'all-required' })
    for (const edge of edges) joinOf.set(`${edge.from}->${edge.to}`, groupId)
  }

  const flow: Array<LearningPathDocument['structure']['flow'][number]> = drafts.map((edge) => {
    const key = `${edge.from}->${edge.to}`
    const splitGroupId = splitOf.get(key)
    const joinGroupId = joinOf.get(key)
    return {
      id: toWireId(`${edge.from}-${edge.to}`, used, 'f-'),
      fromSubjectId: edge.from,
      toSubjectId: edge.to,
      ...(splitGroupId || joinGroupId
        ? { semantics: { ...(splitGroupId ? { splitGroupId } : {}), ...(joinGroupId ? { joinGroupId } : {}) } }
        : {}),
    }
  })

  const subjects: LearningPathDocument['structure']['subjects'] = [
    { id: startId, cardRef: startCardId, orderHint: 1 },
    ...route.carriers.map((carrier, index) => ({
      id: subjectByCarrier.get(carrier.id)!,
      cardRef: subjectCardByCarrier.get(carrier.id)!,
      orderHint: index + 2,
    })),
    { id: goalId, cardRef: goalCardId, orderHint: route.carriers.length + 2 },
  ]

  const concepts: LearningPathDocument['structure']['concepts'] = route.concepts.map((concept, index) => ({
    id: conceptWire.get(concept.id)!,
    subjectId: subjectByCarrier.get(concept.carrierId)!,
    cardRef: conceptCard.get(concept.id)!,
    actionRef: conceptAction.get(concept.id)!,
    orderHint: index + 1,
  }))

  const cards: LearningPathDocument['data']['cards'] = [
    { id: startCardId, eyebrow: '路线起点', title: '从这里出发', summary: '沿着推荐载体前进，任意概念都可以进入。' },
    ...route.carriers.map((carrier) => ({
      id: subjectCardByCarrier.get(carrier.id)!,
      eyebrow: '载体',
      title: clip(carrier.title, 160, '载体'),
      summary: clip(carrier.description, 500, '学习载体'),
    })),
    { id: goalCardId, eyebrow: '学习目标', title: clip(route.title, 160, '学习目标'), summary: '沿着推荐载体前进，任意概念都可以进入。' },
    ...route.concepts.map((concept) => ({
      id: conceptCard.get(concept.id)!,
      eyebrow: concept.hasDispute ? '有争议' : '概念',
      title: clip(concept.title, 160, '概念'),
      summary: clip(concept.detailedDescription, 500, '进入学习'),
      body: clip(concept.detailedDescription, 4000, '进入学习'),
    })),
  ]

  const resources: LearningPathDocument['data']['resources'] = route.concepts.map((concept) => ({
    id: conceptResource.get(concept.id)!,
    href: '#session-learning',
  }))

  const actions: LearningPathDocument['data']['actions'] = route.concepts.map((concept) => ({
    id: conceptAction.get(concept.id)!,
    kind: 'open-resource' as const,
    label: '进入学习',
    resourceId: conceptResource.get(concept.id)!,
    target: 'self' as const,
  }))

  const document: LearningPathDocument = {
    protocol: 'learning-path',
    version: '1.0',
    id: documentId,
    metadata: {
      title: clip(route.title, 160, '学习路线'),
      description: clip(route.title, 500, '已发布的学习路线'),
      locale: 'zh-CN',
    },
    structure: {
      entrySubjectId: startId,
      goalSubjectIds: [goalId],
      subjects,
      concepts,
      flow,
      flowGroups,
    },
    data: { cards, resources, actions },
    presentation: { layout: { direction: 'top-to-bottom' } },
  }

  const validated = validateRendererDocument(document)
  if (!validated.ok) {
    return { ok: false, message: `路线未通过 3D 文档校验：${validated.issues.join('，')}` }
  }
  // Use the exact renderer shipped to the browser: schema validity alone does
  // not prove that the physical road topology can be constructed.
  const runtime = preflightLearningPath(validated.document)
  if (!runtime.ok) {
    return { ok: false, message: `路线未通过 3D 运行时编译：${runtime.message}` }
  }

  const conceptIdByWireId: Record<string, string> = {}
  const wireIdByConceptId: Record<string, string> = {}
  for (const [original, wire] of conceptWire) {
    conceptIdByWireId[wire] = original
    wireIdByConceptId[original] = wire
  }

  return {
    ok: true,
    value: {
      document: validated.document,
      conceptIdByWireId,
      wireIdByConceptId,
    },
  }
}
