import { LearningGoalSchema, ConceptAlignmentSchema } from '../../packages/contracts/src/learning-goal.ts'
import { z } from 'zod'
import { isLiuKanshanName } from '../ports.ts'
import type { AgentId, AuthorCandidate, L0aAngle } from './types.ts'

const IdSchema = z.string().trim().min(1).max(128)
const NonEmptyText = z.string().trim().min(1)

function unique(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

const QueryAngleSchema = z.enum(['normal_learning', 'pitfall_or_dispute'])

export const R1OutputSchema = z
  .object({
    queries: z
      .array(
        z
          .object({
            id: IdSchema,
            text: NonEmptyText,
            angle: QueryAngleSchema,
          })
,
      )
      .min(4)
      .max(5),
  })
  .superRefine((value, ctx) => {
    const ids = value.queries.map((item) => item.id)
    const texts = value.queries.map((item) => item.text)
    if (!unique(ids)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'R1 query ids must be unique' })
    if (!unique(texts)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'R1 query texts must be unique' })
    const angles = new Set(value.queries.map((item) => item.angle))
    if (!angles.has('normal_learning') || !angles.has('pitfall_or_dispute')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'R1 must include both query angles' })
    }
  })

const ROUTE_SHAPE_KEYS = new Set([
  'version',
  'routeId',
  'title',
  'carriers',
  'concepts',
  'carrierEdges',
  'conceptEdges',
  'entryConceptIds',
  'terminalConceptIds',
])

export const R2OutputSchema = z
  .record(z.string().trim().min(1), z.record(z.string().trim().min(1), z.object({ 争议: z.boolean() })))
  .superRefine((value, ctx) => {
    const carriers = Object.keys(value)
    if (carriers.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'R2 must contain at least one carrier' })
      return
    }
    if (carriers.some((key) => ROUTE_SHAPE_KEYS.has(key))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'R2 must not use final-route field names as carrier keys' })
    }
    for (const carrier of carriers) {
      if (Object.keys(value[carrier] ?? {}).length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `R2 carrier ${carrier} must contain at least one concept` })
      }
    }
  })

const QuestionArraySchema = z
  .array(
    z
      .object({
        id: IdSchema,
        prompt: NonEmptyText,
        options: z
          .array(
            z
              .object({
                id: IdSchema,
                label: NonEmptyText,
                routeEffect: NonEmptyText,
              })
,
          )
          .min(2),
      })
,
  )
  .min(1)
  .max(3)

function refineQuestionIds(
  questions: z.infer<typeof QuestionArraySchema>,
  ctx: z.RefinementCtx,
  label: string,
) {
  const questionIds = questions.map((item) => item.id)
  const optionIds = questions.flatMap((item) => item.options.map((option) => option.id))
  if (!unique(questionIds)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} question ids must be unique` })
  if (!unique(optionIds)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} option ids must be unique` })
}

export const R3OutputSchema = z
  .object({
    round: z.literal(1),
    message: NonEmptyText.optional(),
    status: z.literal('active'),
    questions: QuestionArraySchema,
  })
  .superRefine((value, ctx) => refineQuestionIds(value.questions, ctx, 'R3'))

export const R3bContinueSchema = z
  .object({
    kind: z.literal('continue_current'),
    message: NonEmptyText,
    activeRound: z.number().int().min(1).max(3),
  })

export const R3bReplaceSchema = z
  .object({
    kind: z.literal('replace_questions'),
    message: NonEmptyText,
    round: z.number().int().min(2).max(3),
    status: z.literal('active'),
    questions: QuestionArraySchema,
  })

export const R3bOutputSchema = z
  .discriminatedUnion('kind', [R3bContinueSchema, R3bReplaceSchema])
  .superRefine((value, ctx) => {
    if (value.kind === 'replace_questions') refineQuestionIds(value.questions, ctx, 'R3b')
  })

const CarrierSchema = z
  .object({
    id: IdSchema,
    title: NonEmptyText,
    description: NonEmptyText,
  })

const ConceptSchema = z
  .object({
    id: IdSchema,
    carrierId: IdSchema,
    title: NonEmptyText,
    hasDispute: z.boolean(),
    detailedDescription: NonEmptyText,
    attachmentSourceIds: z.array(IdSchema),
    goalAlignment: ConceptAlignmentSchema.optional(),
  })

const CarrierEdgeSchema = z
  .object({
    id: IdSchema,
    fromCarrierId: IdSchema,
    toCarrierId: IdSchema,
    reason: NonEmptyText,
  })

const ConceptEdgeSchema = z
  .object({
    id: IdSchema,
    fromConceptId: IdSchema,
    toConceptId: IdSchema,
    reason: NonEmptyText,
  })

export const R4OutputSchema = z
  .object({
    version: z.literal('1.0'),
    routeId: IdSchema,
    learningGoal: LearningGoalSchema.optional(),
    title: NonEmptyText,
    carriers: z.array(CarrierSchema).min(1),
    concepts: z.array(ConceptSchema).min(1),
    carrierEdges: z.array(CarrierEdgeSchema),
    conceptEdges: z.array(ConceptEdgeSchema),
    entryConceptIds: z.array(IdSchema).min(1),
    terminalConceptIds: z.array(IdSchema).min(1),
  })

export const L0bOutputSchema = z.object({ content: NonEmptyText })
export const G1OutputSchema = z
  .object({
    relation: z.enum(['predecessor', 'successor', 'parallel']),
    title: NonEmptyText,
    edgeExplanation: NonEmptyText,
  })

const SimpleQueryArray = z
  .array(z.object({ id: IdSchema, text: NonEmptyText }))
  .min(2)
  .max(3)

export const A1OutputSchema = z
  .object({ queries: SimpleQueryArray })
  .superRefine((value, ctx) => {
    if (!unique(value.queries.map((item) => item.id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A1 query ids must be unique' })
    }
    if (!unique(value.queries.map((item) => item.text))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A1 query texts must be unique' })
    }
  })

export const N1OutputSchema = z
  .object({ queries: SimpleQueryArray })
  .superRefine((value, ctx) => {
    if (!unique(value.queries.map((item) => item.id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'N1 query ids must be unique' })
    }
    if (!unique(value.queries.map((item) => item.text))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'N1 query texts must be unique' })
    }
  })

const A2SelectionSchema = z
  .object({
    authorId: IdSchema,
    authorName: NonEmptyText,
    evidenceId: IdSchema,
    evidenceSummary: NonEmptyText,
    evidenceUrl: NonEmptyText,
  })

export const A2OutputSchema = z
  .object({
    status: z.enum(['selected', 'no_suitable_author']),
    normalizedQuestion: NonEmptyText,
    selections: z.array(A2SelectionSchema),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'no_suitable_author') {
      if (value.selections.length !== 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A2 no_suitable_author must have empty selections' })
      }
      return
    }
    if (value.selections.length < 1 || value.selections.length > 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A2 selected must contain 1–2 authors' })
    }
    if (!unique(value.selections.map((item) => item.authorId))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A2 authorId values must be unique' })
    }
  })

export const N2OutputSchema = z
  .object({
    selections: z.array(
      z
        .object({
          authorId: IdSchema,
          authorName: NonEmptyText,
          evidenceId: IdSchema,
        })
,
    ),
  })
  .superRefine((value, ctx) => {
    if (!unique(value.selections.map((item) => item.authorId))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'N2 authorId values must be unique' })
    }
  })

export type R1Output = z.infer<typeof R1OutputSchema>
export type R2Output = z.infer<typeof R2OutputSchema>
export type R3Output = z.infer<typeof R3OutputSchema>
export type R3bOutput = z.infer<typeof R3bOutputSchema>
export type R4Output = z.infer<typeof R4OutputSchema>
export type L0bOutput = z.infer<typeof L0bOutputSchema>
export type G1Output = z.infer<typeof G1OutputSchema>
export type A1Output = z.infer<typeof A1OutputSchema>
export type A2Output = z.infer<typeof A2OutputSchema>
export type N1Output = z.infer<typeof N1OutputSchema>
export type N2Output = z.infer<typeof N2OutputSchema>

export type ParseAgentOutputInput = {
  attachmentSourceIds?: readonly string[]
  activeRound?: number
  candidates?: readonly AuthorCandidate[]
  excludedAuthorIds?: readonly string[]
  remainingSlots?: number
}

export type ParseAgentOutputResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string }

function fail(message: string): ParseAgentOutputResult {
  return { ok: false, message }
}

function normalizeJsonSyntax(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
}

function jsonCandidates(text: string): string[] {
  const trimmed = text.trim()
  const found: string[] = []
  const add = (value: string | undefined) => {
    const next = value?.trim()
    if (next && !found.includes(next)) found.push(next)
  }
  add(trimmed)
  add(normalizeJsonSyntax(trimmed))
  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    add(match[1])
    add(normalizeJsonSyntax(match[1] ?? ''))
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    add(trimmed.slice(start, end + 1))
    add(normalizeJsonSyntax(trimmed.slice(start, end + 1)))
  }
  return found
}

function parseJsonObject(text: string): ParseAgentOutputResult {
  for (const candidate of jsonCandidates(text)) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown }
    } catch {
      // try next extract
    }
  }
  return fail('模型没有返回可解析的 JSON 对象。')
}

function asBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 'false') return value === 'true'
  return undefined
}

function normalizeR4Route(raw: unknown): unknown {
  const root = asRecord(raw)
  if (!root) return raw
  const next: Record<string, unknown> = { ...root }
  if (next.version === 1 || next.version === '1') next.version = '1.0'
  if (Array.isArray(next.concepts)) {
    next.concepts = next.concepts.map((item) => {
      const record = asRecord(item)
      if (!record) return item
      const flag = asBooleanFlag(record.hasDispute ?? record['争议'])
      return flag === undefined ? item : { ...record, hasDispute: flag }
    })
  }
  if (Array.isArray(next.conceptEdges)) {
    next.conceptEdges = next.conceptEdges.map((item) => {
      const record = asRecord(item)
      if (!record) return item
      return {
        ...record,
        fromConceptId: record.fromConceptId ?? record.from ?? record.fromId,
        toConceptId: record.toConceptId ?? record.to ?? record.toId,
      }
    })
  }
  if (Array.isArray(next.carrierEdges)) {
    next.carrierEdges = next.carrierEdges.map((item) => {
      const record = asRecord(item)
      if (!record) return item
      return {
        ...record,
        fromCarrierId: record.fromCarrierId ?? record.from ?? record.fromId,
        toCarrierId: record.toCarrierId ?? record.to ?? record.toId,
      }
    })
  }
  return next
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item))
}

function uniqueById(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const next: Record<string, unknown>[] = []
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push({ ...item, id })
  }
  return next
}

function dropCyclicEdges(
  nodes: readonly string[],
  edges: Record<string, unknown>[],
  fromKey: string,
  toKey: string,
): Record<string, unknown>[] {
  const kept: Record<string, unknown>[] = []
  for (const edge of edges) {
    const trial = [...kept, edge].map((item) => ({ from: String(item[fromKey]), to: String(item[toKey]) }))
    if (!hasCycle(nodes, trial)) kept.push(edge)
  }
  return kept
}

export function salvageR4Route(raw: unknown, attachmentSourceIds?: readonly string[]): unknown {
  const root = asRecord(normalizeR4Route(raw))
  if (!root) return raw
  const carriers: Record<string, unknown>[] = uniqueById(asRecords(root.carriers))
    .filter((item) => typeof item.title === 'string' && item.title.trim())
    .map((item) => ({
      ...item,
      description: typeof item.description === 'string' && item.description.trim()
        ? item.description
        : String(item.title),
    }))
  if (carriers.length === 0) return raw
  const carrierIds = new Set(carriers.map((item) => String(item.id)))
  const defaultCarrierId = String(carriers[0]?.id)
  const allowedAttachments = attachmentSourceIds ? new Set(attachmentSourceIds) : undefined
  const concepts: Record<string, unknown>[] = uniqueById(asRecords(root.concepts))
    .filter((item) => typeof item.title === 'string' && item.title.trim())
    .map((item) => {
      const carrierId = carrierIds.has(String(item.carrierId)) ? String(item.carrierId) : defaultCarrierId
      const flag = asBooleanFlag(item.hasDispute ?? item['争议'])
      const attachments = Array.isArray(item.attachmentSourceIds)
        ? item.attachmentSourceIds.filter((id): id is string => (
          typeof id === 'string' && (!allowedAttachments || allowedAttachments.has(id))
        ))
        : []
      return {
        ...item,
        carrierId,
        hasDispute: flag ?? false,
        detailedDescription: typeof item.detailedDescription === 'string' && item.detailedDescription.trim()
          ? item.detailedDescription
          : String(item.title),
        attachmentSourceIds: attachments,
      }
    })
  if (concepts.length === 0) return raw
  const conceptIds = new Set(concepts.map((item) => String(item.id)))
  let salvageSeq = 1
  const withEdgeId = (item: Record<string, unknown>, reason: string) => ({
    ...item,
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `salvage-e-${salvageSeq++}`,
    reason: typeof item.reason === 'string' && item.reason.trim() ? item.reason : reason,
  })
  const carrierNodes = [...carrierIds]
  const conceptNodes = [...conceptIds]
  const carrierEdges = dropCyclicEdges(
    carrierNodes,
    uniqueById(asRecords(root.carrierEdges))
      .filter((item) => (
        carrierIds.has(String(item.fromCarrierId))
        && carrierIds.has(String(item.toCarrierId))
        && item.fromCarrierId !== item.toCarrierId
      ))
      .map((item) => withEdgeId(item, '推荐载体流转')),
    'fromCarrierId',
    'toCarrierId',
  )
  let conceptEdges = dropCyclicEdges(
    conceptNodes,
    uniqueById(asRecords(root.conceptEdges))
      .filter((item) => (
        conceptIds.has(String(item.fromConceptId))
        && conceptIds.has(String(item.toConceptId))
        && item.fromConceptId !== item.toConceptId
      ))
      .map((item) => withEdgeId(item, '推荐学习关系')),
    'fromConceptId',
    'toConceptId',
  )
  const asIdList = (value: unknown) => (
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && conceptIds.has(id)) : []
  )
  let entryConceptIds = asIdList(root.entryConceptIds)
  if (entryConceptIds.length === 0) {
    const incoming = new Set(conceptEdges.map((item) => String(item.toConceptId)))
    entryConceptIds = conceptNodes.filter((id) => !incoming.has(id))
    if (entryConceptIds.length === 0) entryConceptIds = [conceptNodes[0]!]
  }
  const conceptGraph = () => conceptEdges.map((item) => ({ from: String(item.fromConceptId), to: String(item.toConceptId) }))
  let seen = reachable(entryConceptIds, conceptGraph())
  for (const id of conceptNodes) {
    if (seen.has(id)) continue
    conceptEdges.push(withEdgeId({
      fromConceptId: entryConceptIds[0],
      toConceptId: id,
    }, '补齐入口可达'))
    seen.add(id)
  }
  conceptEdges = dropCyclicEdges(conceptNodes, conceptEdges, 'fromConceptId', 'toConceptId')
  let terminalConceptIds = asIdList(root.terminalConceptIds)
  if (terminalConceptIds.length === 0) {
    const outgoing = new Set(conceptEdges.map((item) => String(item.fromConceptId)))
    terminalConceptIds = conceptNodes.filter((id) => !outgoing.has(id))
    if (terminalConceptIds.length === 0) terminalConceptIds = [conceptNodes[conceptNodes.length - 1]!]
  }
  const title = typeof root.title === 'string' && root.title.trim() ? root.title.trim() : '学习路线'
  const routeId = typeof root.routeId === 'string' && root.routeId.trim() ? root.routeId.trim().slice(0, 128) : 'route-salvaged'
  return {
    version: '1.0',
    routeId,
    title,
    carriers,
    concepts,
    carrierEdges,
    conceptEdges,
    entryConceptIds,
    terminalConceptIds,
  }
}

function normalizeR2Exploration(raw: unknown): unknown {
  const root = asRecord(raw)
  if (!root) return raw
  const next: Record<string, unknown> = {}
  for (const [carrier, concepts] of Object.entries(root)) {
    const conceptRoot = asRecord(concepts)
    if (!conceptRoot) return raw
    const mapped: Record<string, unknown> = {}
    for (const [concept, body] of Object.entries(conceptRoot)) {
      const record = asRecord(body)
      if (!record) return raw
      const flag = asBooleanFlag(record['争议'] ?? record['是否争议'] ?? record.hasDispute)
      if (flag === undefined) return raw
      mapped[concept] = { 争议: flag }
    }
    next[carrier] = mapped
  }
  return next
}

function hasCycle(nodes: readonly string[], edges: readonly { from: string; to: string }[]): boolean {
  const outgoing = new Map<string, string[]>()
  for (const id of nodes) outgoing.set(id, [])
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge.to)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const walk = (node: string): boolean => {
    if (visiting.has(node)) return true
    if (visited.has(node)) return false
    visiting.add(node)
    for (const next of outgoing.get(node) ?? []) {
      if (walk(next)) return true
    }
    visiting.delete(node)
    visited.add(node)
    return false
  }
  return nodes.some((node) => walk(node))
}

function reachable(entries: readonly string[], edges: readonly { from: string; to: string }[]): Set<string> {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? []
    list.push(edge.to)
    outgoing.set(edge.from, list)
  }
  const seen = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)
    for (const next of outgoing.get(current) ?? []) queue.push(next)
  }
  return seen
}

function validateRouteGraph(route: R4Output, attachmentSourceIds?: readonly string[]): string | undefined {
  const allIds = [
    route.routeId,
    ...route.carriers.map((item) => item.id),
    ...route.concepts.map((item) => item.id),
    ...route.carrierEdges.map((item) => item.id),
    ...route.conceptEdges.map((item) => item.id),
  ]
  if (!unique(allIds)) return 'R4 中的 ID 必须在单份路线内唯一。'
  const carrierIds = new Set(route.carriers.map((item) => item.id))
  const conceptIds = new Set(route.concepts.map((item) => item.id))
  const allowedAttachments = attachmentSourceIds ? new Set(attachmentSourceIds) : undefined
  for (const concept of route.concepts) {
    if (!carrierIds.has(concept.carrierId)) return 'R4 概念引用了不存在的载体。'
    if (allowedAttachments) {
      for (const sourceId of concept.attachmentSourceIds) {
        if (!allowedAttachments.has(sourceId)) return 'R4 不能创造输入中不存在的附件 sourceId。'
      }
    }
  }
  for (const edge of route.carrierEdges) {
    if (!carrierIds.has(edge.fromCarrierId) || !carrierIds.has(edge.toCarrierId)) {
      return 'R4 载体边引用了不存在的载体。'
    }
  }
  for (const edge of route.conceptEdges) {
    if (!conceptIds.has(edge.fromConceptId) || !conceptIds.has(edge.toConceptId)) {
      return 'R4 概念边引用了不存在的概念。'
    }
  }
  for (const id of route.entryConceptIds) {
    if (!conceptIds.has(id)) return 'R4 入口必须是真实存在的概念。'
  }
  for (const id of route.terminalConceptIds) {
    if (!conceptIds.has(id)) return 'R4 终点必须是真实存在的概念。'
  }
  const carrierGraph = route.carrierEdges.map((edge) => ({ from: edge.fromCarrierId, to: edge.toCarrierId }))
  const conceptGraph = route.conceptEdges.map((edge) => ({ from: edge.fromConceptId, to: edge.toConceptId }))
  if (hasCycle([...carrierIds], carrierGraph) || hasCycle([...conceptIds], conceptGraph)) {
    return 'R4 路线图必须无环。'
  }
  const seen = reachable(route.entryConceptIds, conceptGraph)
  if ([...conceptIds].some((id) => !seen.has(id))) return 'R4 所有概念必须从入口可达。'
  return undefined
}

function lookupCandidate(
  candidates: readonly AuthorCandidate[],
  authorId: string,
): AuthorCandidate | undefined {
  return candidates.find((item) => item.authorId === authorId)
}

function validateA2AgainstInput(value: A2Output, candidates: readonly AuthorCandidate[]): string | undefined {
  for (const selection of value.selections) {
    if (isLiuKanshanName(selection.authorName) || isLiuKanshanName(selection.authorId)) {
      return 'A2 不得把刘看山作为作者。'
    }
    const candidate = lookupCandidate(candidates, selection.authorId)
    if (!candidate) return 'A2 只能选择输入中存在的 authorId。'
    if (candidate.authorName !== selection.authorName) return 'A2 的作者姓名必须与输入候选一致。'
    const evidence = candidate.evidence.find((item) => item.evidenceId === selection.evidenceId)
    if (!evidence) return 'A2 的 evidenceId 必须属于同一作者。'
    if (evidence.summary !== selection.evidenceSummary || evidence.url !== selection.evidenceUrl) {
      return 'A2 的总结和链接必须与同一 evidenceId 的输入一致。'
    }
  }
  return undefined
}

function validateN2AgainstInput(
  value: N2Output,
  input: ParseAgentOutputInput,
): string | undefined {
  const remainingSlots = input.remainingSlots
  if (remainingSlots !== 1 && remainingSlots !== 2 && remainingSlots !== 3) {
    return 'N2 remainingSlots 只能是 1、2 或 3。'
  }
  if (value.selections.length > remainingSlots) return 'N2 返回人数不能超过 remainingSlots。'
  const excluded = new Set(input.excludedAuthorIds ?? [])
  const candidates = input.candidates ?? []
  for (const selection of value.selections) {
    if (excluded.has(selection.authorId)) return 'N2 不能选择已经被 N0 占用的 authorId。'
    if (isLiuKanshanName(selection.authorName) || isLiuKanshanName(selection.authorId)) {
      return 'N2 不得把刘看山作为作者。'
    }
    const candidate = lookupCandidate(candidates, selection.authorId)
    if (!candidate) return 'N2 只能选择输入中存在的 authorId。'
    if (candidate.authorName !== selection.authorName) return 'N2 的作者姓名必须与输入候选一致。'
    if (!candidate.evidence.some((item) => item.evidenceId === selection.evidenceId)) {
      return 'N2 的 evidenceId 必须属于同一作者。'
    }
  }
  return undefined
}

export function parseAgentJson(text: string): ParseAgentOutputResult {
  const parsed = parseJsonObject(text)
  if (!parsed.ok) return parsed
  if (asRecord(parsed.value) === undefined && !Array.isArray(parsed.value)) {
    return fail('模型没有返回 JSON 对象。')
  }
  return parsed
}

export function parseAgentOutput(
  agentId: AgentId,
  raw: unknown,
  input: ParseAgentOutputInput = {},
  angle?: L0aAngle,
): ParseAgentOutputResult {
  if (agentId === 'R5' || agentId === 'G2' || agentId === 'A3' || agentId === 'L0a') {
    if (typeof raw !== 'string' || raw.trim() === '') return fail('正文不能为空。')
    if (agentId === 'L0a' && angle && !['concrete_explanation', 'dispute', 'pitfalls'].includes(angle)) {
      return fail('L0a angle 无效。')
    }
    return { ok: true, value: raw.trim() }
  }

  const schemaByAgent: Record<Exclude<AgentId, 'R5' | 'L0a' | 'G2' | 'A3'>, z.ZodTypeAny> = {
    R1: R1OutputSchema,
    R2: R2OutputSchema,
    R3: R3OutputSchema,
    R3b: R3bOutputSchema,
    R4: R4OutputSchema,
    L0b: L0bOutputSchema,
    G1: G1OutputSchema,
    A1: A1OutputSchema,
    A2: A2OutputSchema,
    N1: N1OutputSchema,
    N2: N2OutputSchema,
  }
  const value = agentId === 'R2'
    ? normalizeR2Exploration(raw)
    : agentId === 'R4'
      ? normalizeR4Route(raw)
      : raw
  const parsed = schemaByAgent[agentId].safeParse(value)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
    return fail(detail ? `模型输出不符合该 Agent 的指定结构。${detail}` : '模型输出不符合该 Agent 的指定结构。')
  }
  if (agentId === 'R3b') {
    const value = parsed.data as R3bOutput
    const activeRound = input.activeRound
    if (value.kind === 'continue_current') {
      if (activeRound !== undefined && value.activeRound !== activeRound) {
        return fail('R3b continue_current 的 activeRound 必须与当前轮一致。')
      }
    } else {
      if (activeRound === 3) return fail('第 3 轮不能再换题。')
      if (activeRound !== undefined && value.round !== activeRound + 1) {
        return fail('R3b 新题轮次必须是 activeRound + 1。')
      }
    }
  }
  if (agentId === 'R4') {
    const graphError = validateRouteGraph(parsed.data as R4Output, input.attachmentSourceIds)
    if (graphError) return fail(graphError)
  }
  if (agentId === 'A2') {
    const bindingError = validateA2AgainstInput(parsed.data as A2Output, input.candidates ?? [])
    if (bindingError) return fail(bindingError)
  }
  if (agentId === 'N2') {
    const bindingError = validateN2AgainstInput(parsed.data as N2Output, input)
    if (bindingError) return fail(bindingError)
  }
  return { ok: true, value: parsed.data }
}

export function isR2ExplorationObject(value: unknown): boolean {
  return R2OutputSchema.safeParse(value).success
}
