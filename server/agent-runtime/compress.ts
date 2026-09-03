import { estimateTokens } from './tokens.ts'
import type {
  AgentId,
  AttachmentContext,
  AuthorCandidate,
  ConversationMessage,
  GraphNode,
  SearchGroup,
  Summarizer,
  TokenEstimator,
} from './types.ts'

export type CompressibleField = {
  key: string
  sourceId: string
  phase: 'attachment' | 'non_attachment'
  rank: number
  text: string
  apply: (next: string) => void
}

type Mut = Record<string, unknown>

function asMut(value: unknown): Mut {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Mut
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function cloneContext<T>(value: T): T {
  return structuredClone(value)
}

export function taggedSummary(sourceId: string, text: string): string {
  return `[来源摘要 sourceId=${sourceId}]\n${text}`
}

export function originalExcerptTag(text: string): string {
  return `[原文摘要]\n${text}`
}

export function sliceToTokens(
  text: string,
  targetTokens: number,
  estimator: TokenEstimator = estimateTokens,
): string {
  if (targetTokens <= 0) return ''
  if (estimator(text) <= targetTokens) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (estimator(text.slice(0, mid)) <= targetTokens) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo)
}

export function chunkByTokens(
  text: string,
  maxTokens: number,
  estimator: TokenEstimator = estimateTokens,
): string[] {
  if (estimator(text) <= maxTokens) return [text]
  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let buffer = ''
  const pushLong = (piece: string) => {
    if (estimator(piece) <= maxTokens) {
      chunks.push(piece)
      return
    }
    const chars = Math.max(1, Math.floor(piece.length * (maxTokens / Math.max(1, estimator(piece)))))
    for (let index = 0; index < piece.length; index += chars) {
      chunks.push(piece.slice(index, index + chars))
    }
  }
  for (const paragraph of paragraphs) {
    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    if (!buffer || estimator(next) <= maxTokens) {
      if (estimator(paragraph) > maxTokens) {
        if (buffer) chunks.push(buffer)
        buffer = ''
        pushLong(paragraph)
        continue
      }
      buffer = next
      continue
    }
    chunks.push(buffer)
    buffer = paragraph
  }
  if (buffer) chunks.push(buffer)
  return chunks.length > 0 ? chunks : [text]
}

export async function summarizeChunked(
  input: { sourceId: string; text: string; targetTokens: number },
  summarizer: Summarizer,
  estimator: TokenEstimator = estimateTokens,
): Promise<string> {
  const { sourceId, text, targetTokens } = input
  if (estimator(text) <= targetTokens) return text
  const chunkBudget = Math.max(256, Math.min(16_000, Math.max(2_000, Math.floor(targetTokens / 4))))
  const chunks = chunkByTokens(text, chunkBudget, estimator)
  const perChunk = Math.max(24, Math.floor(targetTokens / Math.max(1, chunks.length)))
  const parts: string[] = []
  for (const [index, chunk] of chunks.entries()) {
    const summarized = await summarizer({
      sourceId: chunks.length === 1 ? sourceId : `${sourceId}#${index}`,
      text: chunk,
      targetTokens: perChunk,
    })
    parts.push(summarized)
  }
  const merged = parts.join('\n')
  const tagged = taggedSummary(sourceId, merged)
  if (estimator(tagged) <= targetTokens) return tagged
  const tightened = await summarizer({ sourceId, text: merged, targetTokens: Math.max(24, targetTokens - 12) })
  const again = taggedSummary(sourceId, tightened)
  if (estimator(again) <= targetTokens) return again
  return taggedSummary(sourceId, sliceToTokens(tightened, Math.max(8, targetTokens - 12), estimator))
}

function attachmentsOf(context: unknown): AttachmentContext[] {
  return asArray<AttachmentContext>(asMut(context).attachments)
}

export function attachmentContentTokens(
  context: unknown,
  estimator: TokenEstimator = estimateTokens,
): number {
  return attachmentsOf(context).reduce((sum, item) => sum + estimator(item.content ?? ''), 0)
}

function listAttachmentFields(context: unknown): CompressibleField[] {
  return attachmentsOf(context).map((item, index) => ({
    key: `attachments.${index}.content`,
    sourceId: item.sourceId,
    phase: 'attachment' as const,
    rank: estimateTokens(item.content ?? ''),
    text: item.content ?? '',
    apply: (next: string) => {
      item.content = next
    },
  }))
}

function searchGroupsOf(context: unknown): SearchGroup[] {
  return asArray<SearchGroup>(asMut(context).searchGroups)
}

function candidatesOf(context: unknown): AuthorCandidate[] {
  return asArray<AuthorCandidate>(asMut(context).candidates)
}

function conversationOf(context: unknown): ConversationMessage[] {
  return asArray<ConversationMessage>(asMut(context).conversation ?? asMut(context).messages)
}

function stringField(
  key: string,
  sourceId: string,
  phase: CompressibleField['phase'],
  getter: () => string,
  setter: (next: string) => void,
): CompressibleField {
  const text = getter()
  return {
    key,
    sourceId,
    phase,
    rank: estimateTokens(text),
    text,
    apply: setter,
  }
}

export function listCompressibleFields(agentId: AgentId, context: unknown): CompressibleField[] {
  const fields: CompressibleField[] = []
  const root = asMut(context)
  fields.push(...listAttachmentFields(context))

  if (typeof root.goal === 'string') {
    fields.push(stringField('goal', 'goal', 'non_attachment', () => String(root.goal), (next) => {
      root.goal = next
    }))
  }

  for (const [groupIndex, group] of searchGroupsOf(context).entries()) {
    for (const [resultIndex, result] of group.results.entries()) {
      fields.push(stringField(
        `searchGroups.${groupIndex}.results.${resultIndex}.title`,
        result.evidenceId,
        'non_attachment',
        () => result.title,
        (next) => {
          result.title = next
        },
      ))
      fields.push(stringField(
        `searchGroups.${groupIndex}.results.${resultIndex}.summary`,
        result.evidenceId,
        'non_attachment',
        () => result.summary,
        (next) => {
          result.summary = next
        },
      ))
    }
  }

  for (const [candidateIndex, candidate] of candidatesOf(context).entries()) {
    for (const [evidenceIndex, evidence] of candidate.evidence.entries()) {
      fields.push(stringField(
        `candidates.${candidateIndex}.evidence.${evidenceIndex}.summary`,
        evidence.evidenceId,
        'non_attachment',
        () => evidence.summary,
        (next) => {
          evidence.summary = next
        },
      ))
    }
  }

  if (agentId === 'G1') {
    const groups: Array<[string, GraphNode | GraphNode[] | undefined]> = [
      ['host', root.host as GraphNode | undefined],
      ['siblings', root.siblings as GraphNode[] | undefined],
      ['predecessors', root.predecessors as GraphNode[] | undefined],
      ['successors', root.successors as GraphNode[] | undefined],
    ]
    for (const [group, value] of groups) {
      const nodes = Array.isArray(value) ? value : value ? [value] : []
      for (const [index, node] of nodes.entries()) {
        fields.push(stringField(
          `${group}.${index}.content`,
          node.nodeId,
          'non_attachment',
          () => node.content,
          (next) => {
            node.content = next
          },
        ))
      }
    }
  }

  if (agentId === 'R5' || agentId === 'G2') {
    for (const [index, message] of conversationOf(context).entries()) {
      if (typeof message.content !== 'string') continue
      const kind = message.kind ?? 'text'
      if (kind !== 'text') continue
      fields.push(stringField(
        `messages.${index}.content`,
        message.messageId,
        'non_attachment',
        () => String(message.content),
        (next) => {
          message.content = next
        },
      ))
    }
  }

  if (agentId === 'L0a') {
    const concept = asMut(root.concept)
    if (typeof concept.detailedDescription === 'string') {
      fields.push(stringField(
        'concept.detailedDescription',
        String(concept.conceptId ?? 'concept'),
        'non_attachment',
        () => String(concept.detailedDescription),
        (next) => {
          concept.detailedDescription = next
        },
      ))
    }
  }

  if (agentId === 'L0b') {
    if (typeof root.detailedDescription === 'string') {
      fields.push(stringField(
        'detailedDescription',
        String(root.conceptId ?? 'concept'),
        'non_attachment',
        () => String(root.detailedDescription),
        (next) => {
          root.detailedDescription = next
        },
      ))
    }
    for (const [index, answer] of asArray<{ angle: string; content: string }>(root.directAnswers).entries()) {
      fields.push(stringField(
        `directAnswers.${index}.content`,
        answer.angle,
        'non_attachment',
        () => answer.content,
        (next) => {
          answer.content = next
        },
      ))
    }
  }

  if (agentId === 'A1') {
    const host = asMut(root.host)
    if (typeof host.content === 'string') {
      fields.push(stringField(
        'host.content',
        String(host.nodeId ?? 'host'),
        'non_attachment',
        () => String(host.content),
        (next) => {
          host.content = next
        },
      ))
    }
    const selection = asMut(root.selection)
    if (typeof selection.text === 'string') {
      fields.push(stringField(
        'selection.text',
        'selection',
        'non_attachment',
        () => String(selection.text),
        (next) => {
          selection.text = originalExcerptTag(next)
        },
      ))
    }
  }

  if (agentId === 'A3') {
    if (typeof root.selection === 'string' && root.selection) {
      fields.push(stringField('selection', 'selection', 'non_attachment', () => String(root.selection), (next) => {
        root.selection = null
        root.selectionSummary = originalExcerptTag(next)
      }))
    }
  }

  if (agentId === 'N1' && typeof root.question === 'string') {
    fields.push(stringField('question', 'question', 'non_attachment', () => String(root.question), (next) => {
      root.question = originalExcerptTag(next)
      root.questionSummary = originalExcerptTag(next)
    }))
  }

  if (agentId === 'R3' || agentId === 'R3b' || agentId === 'R4') {
    const exploration = root.exploration
    if (typeof exploration === 'string') {
      fields.push(stringField('exploration', 'exploration', 'non_attachment', () => String(exploration), (next) => {
        root.exploration = next
      }))
    }
  }

  return fields.filter((field) => field.text.length > 0)
}

function dedupeEvidence(groups: SearchGroup[]): void {
  for (const group of groups) {
    const seen = new Set<string>()
    group.results = group.results.filter((item) => {
      const key = item.evidenceId || item.url
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

function mergeEvidenceByAuthor(context: unknown): boolean {
  const groups = searchGroupsOf(context)
  const candidates = candidatesOf(context)
  let changed = false
  const mergeList = (items: Array<{ authorId: string | null; evidenceId: string; url: string; summary: string }>) => {
    const byAuthor = new Map<string, typeof items>()
    for (const item of items) {
      const key = item.authorId ?? item.evidenceId
      const list = byAuthor.get(key) ?? []
      list.push(item)
      byAuthor.set(key, list)
    }
    for (const list of byAuthor.values()) {
      if (list.length < 2) continue
      const merged = list.map((item) => item.summary).join('；')
      list[0].summary = taggedSummary(list[0].evidenceId, merged)
      for (const extra of list.slice(1)) {
        extra.summary = `[见同作者摘要 evidenceId=${extra.evidenceId} url=${extra.url}]`
      }
      changed = true
    }
  }
  for (const group of groups) mergeList(group.results)
  for (const candidate of candidates) {
    mergeList(candidate.evidence.map((item) => ({
      authorId: candidate.authorId,
      evidenceId: item.evidenceId,
      url: item.url,
      summary: item.summary,
    })))
  }
  return changed
}

function mergeEarliestConversation(context: unknown, protectIds: Set<string>): boolean {
  const messages = conversationOf(context)
  const compressible = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => (
      typeof message.content === 'string'
      && (message.kind ?? 'text') === 'text'
      && !protectIds.has(message.messageId)
    ))
  if (compressible.length < 2) return false
  const first = compressible[0]
  const second = compressible[1]
  const startId = first.message.messageId
  const endId = second.message.messageId
  first.message.content = `[对话摘要 ${startId}..${endId}]\n${String(first.message.content)}\n${String(second.message.content)}`
  second.message.content = `[已并入对话摘要 ${startId}..${endId}]`
  return true
}

export async function compressFields(
  fields: CompressibleField[],
  targetTokens: number,
  summarizer: Summarizer,
  estimator: TokenEstimator = estimateTokens,
): Promise<void> {
  if (fields.length === 0 || targetTokens <= 0) {
    for (const field of fields) field.apply(sliceToTokens(field.text, 8, estimator))
    return
  }
  const current = fields.reduce((sum, field) => sum + estimator(field.text), 0)
  if (current <= targetTokens) return
  const ordered = [...fields].sort((a, b) => b.rank - a.rank)
  const shares = ordered.map((field) => {
    const share = Math.max(8, Math.floor(targetTokens * (estimator(field.text) / Math.max(1, current))))
    return { field, share }
  })
  for (const { field, share } of shares) {
    if (estimator(field.text) <= share) continue
    const next = await summarizeChunked({
      sourceId: field.sourceId,
      text: field.text,
      targetTokens: share,
    }, summarizer, estimator)
    field.apply(next)
    field.text = next
  }
}

export async function compressAttachmentsOnce(
  context: unknown,
  targetTokens: number,
  summarizer: Summarizer,
  estimator: TokenEstimator = estimateTokens,
): Promise<void> {
  await compressFields(listAttachmentFields(context), targetTokens, summarizer, estimator)
}

export async function compressNonAttachment(
  agentId: AgentId,
  context: unknown,
  targetTokens: number,
  summarizer: Summarizer,
  estimator: TokenEstimator = estimateTokens,
  protectIds: readonly string[] = [],
): Promise<void> {
  if (agentId === 'R2' || agentId === 'A2' || agentId === 'N2') {
    dedupeEvidence(searchGroupsOf(context))
  }
  const protectedSet = new Set(protectIds)
  const collect = () => listCompressibleFields(agentId, context).filter((field) => field.phase === 'non_attachment')
  const remainingOf = (fields: CompressibleField[]) => fields.reduce((sum, field) => sum + estimator(field.text), 0)
  let fields = collect()
  const primary = fields.filter((field) => !protectedSet.has(field.sourceId))
  await compressFields(primary, targetTokens, summarizer, estimator)
  fields = collect()
  if (remainingOf(fields) > targetTokens && (agentId === 'R2' || agentId === 'A2' || agentId === 'N2')) {
    mergeEvidenceByAuthor(context)
    fields = collect()
    await compressFields(fields.filter((field) => !protectedSet.has(field.sourceId)), targetTokens, summarizer, estimator)
  }
  if (remainingOf(collect()) > targetTokens && (agentId === 'R5' || agentId === 'G2')) {
    mergeEarliestConversation(context, protectedSet)
    await compressFields(collect().filter((field) => !protectedSet.has(field.sourceId)), targetTokens, summarizer, estimator)
  }
  fields = collect()
  if (remainingOf(fields) > targetTokens) {
    const lastResort = fields.filter((field) => protectedSet.has(field.sourceId))
    await compressFields(lastResort, Math.max(8, targetTokens), summarizer, estimator)
  }
  fields = collect()
  if (remainingOf(fields) > targetTokens) {
    for (const field of [...fields].sort((a, b) => estimator(b.text) - estimator(a.text))) {
      if (remainingOf(collect()) <= targetTokens) break
      const next = taggedSummary(field.sourceId, sliceToTokens(field.text, Math.max(8, Math.floor(estimator(field.text) / 2)), estimator))
      field.apply(next)
      field.text = next
    }
  }
}

export function protectedSourceIds(agentId: AgentId, context: unknown): string[] {
  const root = asMut(context)
  const ids: string[] = []
  if (typeof root.currentMessage === 'string') ids.push('currentMessage')
  if (typeof root.currentQuestion === 'string') ids.push('currentQuestion')
  const question = asMut(root.question)
  if (typeof question.text === 'string') ids.push('question')
  const quote = asMut(root.quote)
  if (typeof quote.text === 'string' && quote.text) ids.push('quote')
  if (agentId === 'A1' || agentId === 'A3') {
    const selection = asMut(root.selection)
    if (typeof selection.text === 'string') ids.push('selection')
    if (typeof root.selection === 'string') ids.push('selection')
  }
  return ids
}

export function createStubSummarizer(estimator: TokenEstimator = estimateTokens): Summarizer {
  return async ({ sourceId, text, targetTokens }) => {
    const prefix = `[摘要 sourceId=${sourceId}] `
    const body = sliceToTokens(text, Math.max(8, targetTokens - estimator(prefix)), estimator)
    return `${prefix}${body}`
  }
}
