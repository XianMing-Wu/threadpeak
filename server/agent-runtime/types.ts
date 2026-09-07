import type { SearchMetadata } from '../../packages/contracts/src/search-scope.ts'
export const STRUCTURED_AGENT_IDS = [
  'R1',
  'R2',
  'R3',
  'R3b',
  'R4',
  'L0b',
  'G1',
  'A1',
  'A2',
  'N1',
  'N2',
] as const

export const TEXT_AGENT_IDS = ['R5', 'L0a', 'G2', 'A3'] as const

export const AGENT_IDS = [...STRUCTURED_AGENT_IDS, ...TEXT_AGENT_IDS] as const

export type StructuredAgentId = (typeof STRUCTURED_AGENT_IDS)[number]
export type TextAgentId = (typeof TEXT_AGENT_IDS)[number]
export type AgentId = (typeof AGENT_IDS)[number]

export const L0A_ANGLES = ['concrete_explanation', 'dispute', 'pitfalls'] as const
export type L0aAngle = (typeof L0A_ANGLES)[number]

export const THINKING_DEPTHS = ['fast', 'deep'] as const
export type ThinkingDepth = (typeof THINKING_DEPTHS)[number]

export type AgentChannel = 'llm' | 'zhihu_direct'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AttachmentContext = {
  sourceId: string
  fileName: string
  mimeType?: 'application/pdf' | 'text/markdown' | 'text/plain'
  content: string
}

export type SearchEvidence = SearchMetadata & {
  authorUrl?: string | null
  evidenceId: string
  authorId: string | null
  authorName: string | null
  title: string
  summary: string
  url: string
}

export type SearchGroup = {
  queryId: string
  query: string
  results: SearchEvidence[]
}

export type AuthorEvidence = {
  evidenceId: string
  summary: string
  url: string
}

export type AuthorCandidate = {
  authorId: string
  authorName: string
  evidence: AuthorEvidence[]
}

export type GraphAnnotation = {
  annotationId: string
  type: 'author_comment' | 'liu_kanshan_direct'
  content: string
  authorId: string | null
  evidenceIds?: string[]
}

export type GraphNode = {
  nodeId: string
  title: string
  content: string
  annotations: GraphAnnotation[]
}

export type GraphEdge = {
  edgeId: string
  fromNodeId: string
  toNodeId: string
  explanation: string
}

export type ConversationMessage = {
  messageId: string
  role: 'user' | 'assistant' | 'system_event'
  kind?: 'text' | 'question_set' | 'route_published'
  content: string | unknown
  annotations?: GraphAnnotation[]
}

export type QuestionOption = {
  id: string
  label: string
  routeEffect: string
}

export type QuestionItem = {
  id: string
  prompt: string
  options: QuestionOption[]
}

export type QuestionSet = {
  round: number
  status: 'active' | 'superseded'
  questions: QuestionItem[]
  selectedOptionIds?: string[]
}

export type RuntimeLimits = {
  totalTokens: number
  attachmentBranchTokens: number
}

export type SummarizeInput = {
  sourceId: string
  text: string
  targetTokens: number
}

export type Summarizer = (input: SummarizeInput) => Promise<string>

export type TokenEstimator = (text: string) => number

export type LlmCompleteInput = {
  cacheUserId?: string
  messages: readonly ChatMessage[]
  json: boolean
  thinkingDepth: ThinkingDepth
  maxTokens?: number
  signal?: AbortSignal
  onReasoning?: (text: string) => void
  onText?: (text: string) => void
}

export type ProviderUsage = { prompt_tokens?:number; completion_tokens?:number; total_tokens?:number; prompt_cache_hit_tokens?:number; prompt_cache_miss_tokens?:number }
export type ProviderDiagnostic = { httpStatus:number; upstreamCode?:string; requestId?:string }
export type ProviderMetadata = { usage?:ProviderUsage; diagnostic?:ProviderDiagnostic; cache?:'hit'|'miss'; cacheable?:boolean }
export type LlmCompleteResult = (
  | { kind: 'completed'; text: string; reasoning?: string }
  | { kind: 'failed'; message: string; code?: string; retryable?: boolean }
  ) & ProviderMetadata

export type LlmProvider = {
  complete(input: LlmCompleteInput): Promise<LlmCompleteResult>
}

export type ZhihuSearchHit = SearchEvidence & {
  queryId?: string
}

export type ZhihuSearchResult = (
  | { kind: 'hits'; items: readonly ZhihuSearchHit[] }
  | { kind: 'empty' }
  | { kind: 'failed'; message: string; code?: string; retryable?: boolean }
  ) & ProviderMetadata

export type ZhihuDirectInput = {
  messages: readonly ChatMessage[]
  thinkingDepth: ThinkingDepth
  signal?: AbortSignal
}

export type ZhihuDirectResult = (
  | { kind: 'completed'; text: string }
  | { kind: 'failed'; message: string; code?: string; retryable?: boolean }
  ) & ProviderMetadata

export type ZhihuProvider = {
  globalSearch?(query: string, count: number, signal?: AbortSignal): Promise<ZhihuSearchResult>
  search(query: string, count: number, signal?: AbortSignal): Promise<ZhihuSearchResult>
  direct(input: ZhihuDirectInput): Promise<ZhihuDirectResult>
}

export type AgentFailureCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_INVALID'
  | 'OUTPUT_INVALID'
  | 'CONFIG_INVALID'

export type AgentFailure = {
  kind: 'failed'
  code: AgentFailureCode
  message: string
  agentId: AgentId
}

export type PreparedCall = {
  agentId: AgentId
  messages: ChatMessage[]
  context: unknown
  compressed: boolean
  estimatedTokens: number
  originalUnchanged: true
}

export type StructuredInvokeResult<T> =
  | { kind: 'completed'; agentId: StructuredAgentId; value: T; compressed: boolean }
  | AgentFailure

export type TextInvokeResult =
  | { kind: 'completed'; agentId: TextAgentId; text: string; compressed: boolean }
  | AgentFailure
