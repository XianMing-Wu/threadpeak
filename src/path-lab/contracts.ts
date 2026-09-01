import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'

type JsonRecord = Record<string, unknown>

export const QUALITY_ISSUE_LABELS = {
  budget_cost_unknown: '预算路径存在未知耗时',
  budget_exceeded: '依赖闭包超过预算',
  budgeted_coverage_note_missing: '预算路径缺少覆盖说明',
  capability_prerequisite_bypass: '能力层级绕过了前置要求',
  clarification_unresolved: '学习目标仍有未解决的歧义',
  claim_author_mismatch: '证据作者与冻结快照不一致',
  claim_snapshot_mismatch: '证据快照不一致',
  claim_source_not_frozen: '证据来源未冻结',
  community_prune_evidence_insufficient: '社区裁剪证据不足',
  complete_slice_hard_edges_missing: '完整切片缺少硬前置边',
  cyclic_prerequisites: '前置依赖存在环',
  dependency_evidence_invalid: '硬前置缺少闭合的冻结证据',
  duplicate_plan_part: '计划阶段包含重复节点',
  empty_executable_path: '路径没有可执行节点',
  evidence_bundle_reference_invalid: '证据包引用不闭合',
  folded_hard_prerequisite: '硬前置被错误折叠',
  full_coverage_incomplete: '完整模式仍有未覆盖需求',
  hard_prerequisite_not_selected: '硬前置未被选入路径',
  independent_judge_rejected: '独立质量审查未通过',
  independent_source_count_unproven: '独立来源数量无法证明',
  low_harvest_confidence_locked: '低置信节点被错误锁定',
  non_contiguous_plan_stages: '计划阶段不连续',
  owner_document_claim_not_anchored: '私有文档证据未锚定原文',
  path_degraded: '路径已降级',
  plan_contains_unselected: '计划包含未选节点',
  plan_selection_mismatch: '计划与求解结果不一致',
  prerequisite_coverage_detail_missing: '前置覆盖明细缺失',
  prerequisite_stage_order: '前置节点阶段顺序错误',
  quote_not_in_frozen_source: '引用无法在冻结原文中验证',
  redundancy_target_does_not_cover: '冗余折叠目标没有真实覆盖',
  redundancy_target_not_selected: '冗余折叠目标未被选中',
  renderer_document_invalid: '3D 渲染文档不符合协议',
  renderer_projection_failed: '3D 渲染投影失败',
  repair_round_limit: '修复轮次超过上限',
  resource_claim_reference_invalid: '学习资源缺少闭合证据引用',
  resource_source_unreliable: '学习资源来源可靠性不足',
  resource_url_not_frozen_by_claim: '学习资源地址未被证据冻结',
  result_kind_overclaims_prerequisites: '结果夸大了前置关系完整性',
  result_kind_underclaims_complete_graph: '结果未正确标记完整前置图',
  satisfy_evidence_invalid: '覆盖边缺少有效证据',
  satisfy_independence_missing: '覆盖边缺少独立来源',
  selected_part_missing_concept: '已选节点缺少可渲染概念',
  selected_part_missing_resource: '已选节点缺少已验证资源',
  selected_part_unknown_concept: '已选节点引用未知概念',
  solver_status_inconsistent: '求解状态与输出不一致',
  sparse_estimates_in_budget_mode: '预算模式的可靠估时覆盖不足',
  uncovered_mismatch: '未覆盖需求与实际覆盖不一致',
  unproven_optimality: '最优性声明缺少证明',
} as const

export const DEGRADATION_LABELS = {
  partial_search: '部分证据检索暂时不可用，已仅使用成功冻结的来源',
  path_degraded: '路径因证据或约束不足而降级',
  uncovered_requirements: '仍有需求未被可靠覆盖',
} as const

const SERVICE_ERROR_MESSAGES = {
  clarification_required: '请完成当前选择后继续生成。',
  high_stakes_speedrun: '高风险主题不能使用速成模式，请改为完整学习路径。',
  internal_error: '生成服务未能安全完成本次请求，请稍后重试。',
  invalid_structured_output: '生成结果未通过结构校验，本次路径未发布。',
  private_document_external_processing_not_allowed: '私有文档未获外部处理授权，本次没有发送文档内容。',
  provider_budget_exhausted: '本次 Provider 调用预算已用尽，请稍后重试。',
  provider_deferred: 'Provider 当前超时或繁忙，本次路径未发布，请稍后重试。',
  provider_http_error: 'Provider 返回不可重试错误，请检查服务配置。',
  provider_invalid_json: 'Provider 返回了无效数据，本次路径未发布。',
  provider_request_rejected: 'Provider 拒绝了请求，请检查账号、模型、额度和鉴权配置。',
  provider_response_shape: 'Provider 响应结构不符合要求，本次路径未发布。',
  providers_unavailable: '路径生成 Provider 尚未启用，请先启动已配置的本地服务。',
  quality_gate_failed: '本次结果未通过严格质量门禁，旧路径已保留。',
  regulated_advice: '该请求涉及受监管的具体决策，请改写为知识与能力学习目标。',
  request_too_large: '输入内容超过服务限制，请缩短后重试。',
  search_batch_failed: '证据检索未能安全完成，本次路径未发布。',
  schema_mismatch: 'Provider 输出不符合冻结协议，本次路径未发布。',
  validation_error: '输入不符合路径生成协议，请检查目标后重试。',
  zhihu_invalid_json: '知乎检索返回了无效数据，本次路径未发布。',
} as const

type QualityIssueCode = keyof typeof QUALITY_ISSUE_LABELS
type DegradationCode = keyof typeof DEGRADATION_LABELS
type ServiceErrorCode = keyof typeof SERVICE_ERROR_MESSAGES

export type PathDiagnosticsView = Readonly<{
  qualityScore: number
  passed: boolean
  qualityIssueCount: number
  qualityIssueCodes: readonly QualityIssueCode[]
  qualityIssueLabels: readonly string[]
  invariantCount: number
  repairRounds: number
  totalMs: number
  providerCallCount: number
  sourceCounts: readonly Readonly<{ label: string; value: number }>[]
  degraded: boolean
  degradationCodes: readonly DegradationCode[]
  degradationLabels: readonly string[]
}>

export type ParsedGenerationResponse = Readonly<{
  rendererDocument: LearningPathDocument
  diagnostics: PathDiagnosticsView
}>

export type SafeServiceFailure = Readonly<{
  message: string
  diagnostics?: PathDiagnosticsView
  clarification?: ClarificationPrompt
}>

export type ClarificationOption = Readonly<{
  id: string
  label: string
  instruction: string
}>

export type ClarificationPrompt = Readonly<{
  questionId: string
  question: string
  step: number
  total: number
  options: readonly ClarificationOption[]
}>

export type ClarificationAnswer = Readonly<{
  question_id: string
  option_id: string
}>

export class PublicPathLabError extends Error {}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function owns(root: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(root, key)
}

function isFiniteNumber(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isSafeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function isBoundedText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string'
    && value.length >= minimum
    && value.length <= maximum
    && value.trim() === value
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)
}

function isIdentifier(value: unknown): value is string {
  return isBoundedText(value, 1, 64) && /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/.test(value)
}

function isClarificationIdentifier(value: unknown): value is string {
  return isBoundedText(value, 2, 120) && /^[a-z0-9][a-z0-9._:-]*$/.test(value)
}

function parseClarification(root: JsonRecord): ClarificationPrompt | undefined {
  if (root.code !== 'clarification_required') return undefined
  const questionId = root.clarification_question_id
  const question = root.clarification_question
  const step = root.clarification_step
  const total = root.clarification_total
  const rawOptions = root.clarification_options
  if (!isClarificationIdentifier(questionId)
    || !isBoundedText(question, 2, 400)
    || !isSafeInteger(step, 1, 3)
    || !isSafeInteger(total, 1, 3)
    || step > total
    || !Array.isArray(rawOptions)
    || rawOptions.length < 2
    || rawOptions.length > 4) return undefined

  const options: ClarificationOption[] = []
  for (const value of rawOptions) {
    if (!isRecord(value)
      || !isClarificationIdentifier(value.id)
      || !isBoundedText(value.label, 2, 240)
      || !isBoundedText(value.instruction, 2, 600)) return undefined
    options.push({ id: value.id, label: value.label, instruction: value.instruction })
  }
  if (new Set(options.map((option) => option.id)).size !== options.length) return undefined
  return { questionId, question, step, total, options }
}

function hasUniqueIds(values: readonly unknown[]): boolean {
  const ids = values.map((value) => isRecord(value) ? value.id : undefined)
  return ids.every(isIdentifier) && new Set(ids).size === ids.length
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

function isRendererDocument(value: unknown): value is LearningPathDocument {
  if (!isRecord(value) || value.protocol !== 'learning-path' || value.version !== '1.0' || !isIdentifier(value.id)) return false
  if (!isRecord(value.metadata)
    || !isBoundedText(value.metadata.title, 1, 160)
    || (value.metadata.description !== undefined && !isBoundedText(value.metadata.description, 1, 500))
    || !isBoundedText(value.metadata.locale, 2, 16)) return false
  if (!isRecord(value.structure) || !isRecord(value.data) || !isRecord(value.presentation)) return false

  const subjects = value.structure.subjects
  const concepts = value.structure.concepts
  const flow = value.structure.flow
  const flowGroups = value.structure.flowGroups
  const cards = value.data.cards
  const resources = value.data.resources
  const actions = value.data.actions
  if (!Array.isArray(subjects) || subjects.length < 1 || subjects.length > 128 || !hasUniqueIds(subjects)) return false
  if (!Array.isArray(concepts) || concepts.length > 1024 || !hasUniqueIds(concepts)) return false
  if (!Array.isArray(flow) || flow.length > 2048 || !hasUniqueIds(flow)) return false
  if (!Array.isArray(flowGroups) || flowGroups.length > 256 || !hasUniqueIds(flowGroups)) return false
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 1152 || !hasUniqueIds(cards)) return false
  if (!Array.isArray(resources) || resources.length > 1024 || !hasUniqueIds(resources)) return false
  if (!Array.isArray(actions) || actions.length > 1024 || !hasUniqueIds(actions)) return false

  const subjectIds = new Set(subjects.map((subject) => (subject as JsonRecord).id as string))
  const cardIds = new Set(cards.map((card) => (card as JsonRecord).id as string))
  const resourceIds = new Set(resources.map((resource) => (resource as JsonRecord).id as string))
  const actionIds = new Set(actions.map((action) => (action as JsonRecord).id as string))
  if (!isIdentifier(value.structure.entrySubjectId) || !subjectIds.has(value.structure.entrySubjectId)) return false
  if (!Array.isArray(value.structure.goalSubjectIds)
    || value.structure.goalSubjectIds.length < 1
    || !value.structure.goalSubjectIds.every((id) => isIdentifier(id) && subjectIds.has(id))) return false
  if (!subjects.every((subject) => isRecord(subject) && isIdentifier(subject.id) && isIdentifier(subject.cardRef) && cardIds.has(subject.cardRef))) return false
  if (!cards.every((card) => isRecord(card)
    && isIdentifier(card.id)
    && isBoundedText(card.title, 1, 160)
    && isBoundedText(card.summary, 1, 500)
    && (card.tags === undefined || (Array.isArray(card.tags) && card.tags.length <= 12 && card.tags.every((tag) => isBoundedText(tag, 1, 40)))))) return false
  if (!resources.every((resource) => isRecord(resource)
    && isIdentifier(resource.id)
    && isSafeResourceHref(resource.href))) return false
  if (!actions.every((action) => isRecord(action)
    && isIdentifier(action.id)
    && action.kind === 'open-resource'
    && isBoundedText(action.label, 1, 80)
    && isIdentifier(action.resourceId)
    && resourceIds.has(action.resourceId)
    && (action.target === undefined || action.target === 'self' || action.target === 'blank'))) return false
  if (!concepts.every((concept) => isRecord(concept)
    && isIdentifier(concept.id)
    && isIdentifier(concept.subjectId)
    && subjectIds.has(concept.subjectId)
    && isIdentifier(concept.cardRef)
    && cardIds.has(concept.cardRef)
    && isIdentifier(concept.actionRef)
    && actionIds.has(concept.actionRef))) return false
  if (!flow.every((edge) => isRecord(edge)
    && isIdentifier(edge.id)
    && isIdentifier(edge.fromSubjectId)
    && isIdentifier(edge.toSubjectId)
    && edge.fromSubjectId !== edge.toSubjectId
    && subjectIds.has(edge.fromSubjectId)
    && subjectIds.has(edge.toSubjectId))) return false

  return isRecord(value.presentation.layout) && value.presentation.layout.direction === 'top-to-bottom'
}

function knownQualityIssueCode(value: unknown): QualityIssueCode | undefined {
  return typeof value === 'string' && owns(QUALITY_ISSUE_LABELS, value) ? value as QualityIssueCode : undefined
}

function knownDegradationCode(value: unknown): DegradationCode | undefined {
  return typeof value === 'string' && owns(DEGRADATION_LABELS, value) ? value as DegradationCode : undefined
}

function parseDiagnostics(envelope: JsonRecord): PathDiagnosticsView {
  const quality = envelope.quality_report
  const trace = envelope.trace
  const diagnostics = envelope.diagnostics
  if (!isRecord(quality)
    || typeof quality.passed !== 'boolean'
    || !isFiniteNumber(quality.score, 0, 1)
    || !Array.isArray(quality.issues)
    || quality.issues.length > 200
    || !isSafeInteger(quality.invariant_count)
    || !isSafeInteger(quality.repair_rounds, 0, 2)) {
    throw new PublicPathLabError('服务端缺少完整的质量门禁报告')
  }

  const qualityIssueCodes: QualityIssueCode[] = []
  for (const issue of quality.issues) {
    const code = isRecord(issue) ? knownQualityIssueCode(issue.code) : undefined
    if (!isRecord(issue) || !code || !['error', 'warning', 'info'].includes(String(issue.severity))) {
      throw new PublicPathLabError('服务端返回了未登记的质量问题代码')
    }
    qualityIssueCodes.push(code)
  }
  if (quality.passed && qualityIssueCodes.length > 0) {
    throw new PublicPathLabError('质量门禁结论与问题列表不一致')
  }

  if (!isRecord(trace)
    || !isFiniteNumber(trace.total_duration_ms)
    || typeof trace.degraded !== 'boolean'
    || !isSafeInteger(trace.provider_call_count)
    || !isSafeInteger(trace.provider_call_budget)
    || !Array.isArray(trace.stages)) {
    throw new PublicPathLabError('服务端缺少完整的生成追踪摘要')
  }

  if (!isRecord(diagnostics) || !Array.isArray(diagnostics.degradation_codes)) {
    throw new PublicPathLabError('服务端缺少完整的降级诊断')
  }
  const degradationCodes: DegradationCode[] = []
  for (const rawCode of diagnostics.degradation_codes) {
    const code = knownDegradationCode(rawCode)
    if (!code) throw new PublicPathLabError('服务端返回了未登记的降级代码')
    degradationCodes.push(code)
  }
  if (trace.degraded !== (degradationCodes.length > 0)) {
    throw new PublicPathLabError('降级状态与降级代码不一致')
  }

  const sourceCountsRecord = isRecord(diagnostics.source_counts) ? diagnostics.source_counts : undefined
  const sourceCountCandidates: readonly (readonly [string, unknown])[] = sourceCountsRecord
    ? [
      ['全部来源', sourceCountsRecord.total],
      ['知乎', sourceCountsRecord.zhihu],
      ['锚点文档', sourceCountsRecord.anchor_documents],
      ['独立证据', sourceCountsRecord.independent],
    ]
    : []
  const sourceCounts: { label: string; value: number }[] = []
  for (const [label, value] of sourceCountCandidates) {
    if (isSafeInteger(value)) sourceCounts.push({ label, value })
  }

  return {
    qualityScore: quality.score,
    passed: quality.passed,
    qualityIssueCount: qualityIssueCodes.length,
    qualityIssueCodes,
    qualityIssueLabels: qualityIssueCodes.map((code) => QUALITY_ISSUE_LABELS[code]),
    invariantCount: quality.invariant_count,
    repairRounds: quality.repair_rounds,
    totalMs: trace.total_duration_ms,
    providerCallCount: trace.provider_call_count,
    sourceCounts,
    degraded: trace.degraded,
    degradationCodes,
    degradationLabels: degradationCodes.map((code) => DEGRADATION_LABELS[code]),
  }
}

export function projectDiagnostics(value: unknown): PathDiagnosticsView {
  if (!isRecord(value)) throw new PublicPathLabError('服务端响应不是有效对象')
  return parseDiagnostics(value)
}

export function parseGenerationResponse(value: unknown): ParsedGenerationResponse {
  if (!isRecord(value) || !isRendererDocument(value.renderer_document)) {
    throw new PublicPathLabError('服务端没有返回符合 renderer v1 协议的文档')
  }
  return {
    rendererDocument: value.renderer_document,
    diagnostics: parseDiagnostics(value),
  }
}

export function projectSafeServiceFailure(status: number, payload: unknown): SafeServiceFailure {
  if (!isRecord(payload) || typeof payload.code !== 'string' || !owns(SERVICE_ERROR_MESSAGES, payload.code)) {
    return { message: `生成服务返回错误（HTTP ${status}）` }
  }
  let diagnostics: PathDiagnosticsView | undefined
  try {
    diagnostics = projectDiagnostics(payload)
  } catch {
    // Error envelopes may omit diagnostics. Never fall back to arbitrary server text.
  }
  return {
    message: SERVICE_ERROR_MESSAGES[payload.code as ServiceErrorCode],
    diagnostics,
    clarification: parseClarification(payload),
  }
}

export async function readSafeServiceFailure(response: Response): Promise<SafeServiceFailure> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { message: `生成服务返回错误（HTTP ${response.status}）` }
  }
  return projectSafeServiceFailure(response.status, payload)
}
