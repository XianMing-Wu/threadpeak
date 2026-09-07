import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import type { AssistantMode } from '../assistant-mode'
import type { RouteName } from '../components/Shell'
import type { CanvasEdge, CanvasNode } from '../knowledge-canvas/content'

export type Owner = 'mine' | 'example'
export type ChatExperience = 'answer' | 'route'
export type ConversationKind = 'home-answer' | 'home-route' | 'route-followup' | 'learning'

export type PathCarrierSpec = {
  id: string
  title: string
  summary: string
  concepts: ReadonlyArray<readonly [string, string, string]>
}

export type RouteBlueprint = {
  id: string
  owner: Owner
  title: string
  summary: string
  outcome: string
  duration: string
  tags: string[]
  icon: 'function' | 'brain' | 'layers' | 'route' | 'book'
  documentId: string
  description: string
  goalTitle: string
  goalSummary: string
  startSummary: string
  carriers: PathCarrierSpec[]
}

export type FirstLesson = {
  heading: string
  paragraphs: string[]
  quote?: string
  figureCaption?: string
  placeholder: string
}

export type KnowledgeGraph = {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export type LearningTurn = {
  role: 'user' | 'assistant'
  text: string
  mode?: AssistantMode
  quote?: string
  quoteFromId?: string
  nodeId?: string
  grow?: 'pred' | 'succ' | 'par'
  growSource?: 'command' | 'model' | 'heuristic'
  growTitle?: string
  growReason?: string
  mergeNodeId?: string
  failed?: boolean
}

export type ConversationRecord = {
  id: string
  kind: ConversationKind
  title: string
  query: string
  experience: ChatExperience
  routeId?: string
  knowledgeId?: string
  conceptId?: string
  routeStep?: number
  routeChoices?: string[]
  routeReady?: boolean
  turns: LearningTurn[]
  value: string
  quote: string
  mode: AssistantMode
  canvasHostId?: string
  pathRunId?: string
  processTrace?: import('../process-trace').ProcessStep[]
  updatedAt: number
}

export type RouteRecord = {
  id: string
  owner: Owner
  title: string
  summary: string
  outcome: string
  duration: string
  tags: string[]
  icon: RouteBlueprint['icon']
  document: LearningPathDocument
  conversationIds: string[]
  knowledgeId: string | null
  processTrace?: import('../process-trace').ProcessStep[]
  createdAt: number
}

export type KnowledgeRecord = {
  id: string
  routeId: string
  owner: Owner
  title: string
  description: string
  icon: RouteBlueprint['icon']
  sources: number
  type: string
  seedConceptId: string
  graph: KnowledgeGraph
  graphs?: Record<string, KnowledgeGraph>
  createdAt: number
  updatedAt: number
}

export type LessonKey = `${string}::${string}`

export type WorkspaceSnapshot = {
  version: 1
  routes: RouteRecord[]
  knowledge: KnowledgeRecord[]
  conversations: ConversationRecord[]
  lessons: Record<string, FirstLesson>
}

export type RouteCard = {
  id: string
  owner: Owner
  title: string
  summary: string
  outcome: string
  duration: string
  tags: string[]
  icon: RouteBlueprint['icon']
  carriers: number
  concepts: number
  knowledgeId: string | null
}

export type KnowledgeCard = {
  id: string
  routeId: string
  owner: Owner
  title: string
  description: string
  icon: RouteBlueprint['icon']
  sources: number
  type: string
}

export type ConceptCard = {
  id: string
  knowledgeId: string
  routeId: string
  title: string
  description: string
  icon: RouteBlueprint['icon']
  sources: number
  type: string
}

export type ActiveContext = {
  routeId: string
  conceptId: string
  knowledgeId: string
  conversationId: string
  pathReturn: RouteName
  canvasReturn: RouteName
  sessionReturn: RouteName
}
