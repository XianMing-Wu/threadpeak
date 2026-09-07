import {semanticChunks} from './semantic-chunks.ts'
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
  return semanticChunks(text,maxTokens,estimator)
}

export async function summarizeChunked(
  input: { sourceId: string; text: string; targetTokens: number },
  summarizer: Summarizer,
  estimator: TokenEstimator = estimateTokens,
): Promise<string> {
  const { sourceId, text, targetTokens } = input
  if (estimator(text) <= targetTokens) return text
  const tagBudget=estimator(taggedSummary(sourceId,''))+8
  if(targetTokens<tagBudget+24)throw new Error('CONTEXT_REQUIRES_PARTITION')
  let candidate=text
  for(let pass=0;pass<6;pass++){
    const chunks=chunkByTokens(candidate,16000,estimator)
    const perChunk=Math.max(24,Math.floor((targetTokens-tagBudget)/Math.max(1,chunks.length)))
    const parts:string[]=[]
    for(const [index,chunk] of chunks.entries())parts.push(await summarizer({sourceId:`${sourceId}#${index+1}/${chunks.length}`,text:chunk,targetTokens:perChunk}))
    candidate=parts.join('\n')
    const result=taggedSummary(sourceId,candidate)
    if(estimator(result)<=targetTokens)return result
  }
  throw new Error('SUMMARY_NOT_REDUCED')
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

  for (const [groupIndex, group] of searchGroupsOf(context).entries()) {
    for (const [resultIndex, result] of group.results.entries()) {
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
      if (typeof message.content !== 'string'||message.role==='user') continue
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

export async function compressFields(
  fields: CompressibleField[],
  targetTokens: number,
  summarizer: Summarizer,
  estimator: TokenEstimator = estimateTokens,
): Promise<void> {
  if(fields.length===0)return
  if(targetTokens<=0)throw new Error('CONTEXT_REQUIRES_PARTITION')
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
  const fields=collect()
  const protectedSize=fields.filter(f=>protectedSet.has(f.sourceId)).reduce((n,f)=>n+estimator(f.text),0)
  await compressFields(fields.filter(f=>!protectedSet.has(f.sourceId)),targetTokens-protectedSize,summarizer,estimator)
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
