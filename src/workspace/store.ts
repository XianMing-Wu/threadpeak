import { useEffect,useState } from 'react'
import { type AssistantMode } from '../assistant-mode'
import { addChatHistory,readChatHistory,retainChatHistory } from '../history'
import { hostDocumentChanged } from '../path-3d/host-document-persistence'
import { isRenderableMineRoute } from '../path-3d/resolved-path-document.ts'
import { asProcessSteps,uniqueTrace,type ProcessStep } from '../process-trace'
import { readableLayerTitle,titleFromPathLayer } from '../session/layer-title.ts'
import {
blueprintConcepts,
catalogLesson,
conceptAccent,
conceptTitle,
exampleBlueprints,
exampleKnowledgeRecord,
findExampleBlueprint,
graphFromLesson,
routeRecordFromBlueprint
} from './catalog'
import { mineRouteFromValidatedDocument } from './published-route'
import { hasSettledMineConceptGraph } from './settled-mine-graph.ts'
import { projectionDraft,readMergedSnapshot,readSnapshot,PROJECTION_KEY,writeProjection } from './snapshot-cache'
import type {
ConceptCard,
ConversationKind,
ConversationRecord,
FirstLesson,
KnowledgeCard,
KnowledgeGraph,
KnowledgeRecord,
LearningTurn,
RouteBlueprint,
RouteCard,
RouteRecord,
WorkspaceSnapshot
} from './types'

export { hasSettledMineConceptGraph } from './settled-mine-graph.ts'

export const WORKSPACE_KEY = 'threadpeak-workspace-v1'
export const WORKSPACE_EVENT = 'threadpeak:workspace-change'
export const PROCESS_TRACE_KEY_PREFIX = 'threadpeak-process-trace-v1:'

function processTraceBackupKey(conversationId: string) {
  return `${PROCESS_TRACE_KEY_PREFIX}${conversationId}`
}

function readBackupTrace(conversationId: string): ProcessStep[] {
  try {
    return asProcessSteps(JSON.parse(localStorage.getItem(processTraceBackupKey(conversationId)) ?? 'null')) ?? []
  } catch {
    return []
  }
}

function writeBackupTrace(conversationId: string, steps: readonly ProcessStep[]) {
  if (!steps.length) return
  try {
    localStorage.setItem(processTraceBackupKey(conversationId), JSON.stringify(steps))
  } catch {
    // quota or private mode — conversation/route copies may still land
  }
}

export function loadConversationTrace(conversationId: string, routeId?: string): ProcessStep[] {
  const fromConversation = asProcessSteps(getConversation(conversationId)?.processTrace) ?? []
  const fromRoute = routeId ? asProcessSteps(getRoute(routeId)?.processTrace) ?? [] : []
  return uniqueTrace([...readBackupTrace(conversationId), ...fromRoute, ...fromConversation])
}

export function saveConversationTrace(
  conversationId: string,
  steps: readonly ProcessStep[],
  extra?: { pathRunId?: string; routeId?: string; routeStep?: number },
) {
  const processTrace = uniqueTrace(steps)
  writeBackupTrace(conversationId, processTrace)
  mutate((snapshot) => {
    snapshot.conversations = snapshot.conversations.map((item) => {
      if (item.id !== conversationId) return item
      return {
        ...item,
        ...(extra?.pathRunId ? { pathRunId: extra.pathRunId } : {}),
        ...(extra?.routeStep !== undefined ? { routeStep: extra.routeStep } : {}),
        ...(processTrace.length ? { processTrace } : {}),
        updatedAt: Date.now(),
      }
    })
    if (extra?.routeId && processTrace.length) {
      snapshot.routes = snapshot.routes.map((route) => (
        route.id === extra.routeId ? { ...route, processTrace } : route
      ))
    }
  })
}

function lessonKey(routeId: string, conceptId: string) { return `${routeId}::${conceptId}` }

export function useWorkspaceTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const refresh = () => setTick((value) => value + 1)
    addEventListener(WORKSPACE_EVENT, refresh)
    addEventListener('storage', refresh)
    return () => {
      removeEventListener(WORKSPACE_EVENT, refresh)
      removeEventListener('storage', refresh)
    }
  }, [])
  return tick
}

export const readWorkspace = readMergedSnapshot
function mutate(update: (snapshot: WorkspaceSnapshot) => void) {
  const snapshot=projectionDraft()
  update(snapshot)
  writeProjection(snapshot)
  window.dispatchEvent(new Event(WORKSPACE_EVENT))
  return snapshot
}

export function exampleRoutes(): RouteRecord[] {
  return exampleBlueprints.map((item) => routeRecordFromBlueprint(item))
}

export function exampleKnowledge(): KnowledgeRecord[] {
  return exampleBlueprints.map(exampleKnowledgeRecord)
}

function toRouteCard(route: RouteRecord): RouteCard {
  return {
    id: route.id,
    owner: route.owner,
    title: route.title,
    summary: route.summary,
    outcome: route.outcome,
    duration: route.duration,
    tags: route.tags,
    icon: route.icon,
    carriers: route.document.structure.subjects.filter((item) => (
      item.id !== route.document.structure.entrySubjectId
      && !route.document.structure.goalSubjectIds.includes(item.id)
    )).length,
    concepts: route.document.structure.concepts.length,
    knowledgeId: route.knowledgeId,
  }
}

export function conceptGraphsOf(item: KnowledgeRecord): Record<string, KnowledgeGraph> {
  if (item.graphs && Object.keys(item.graphs).length) return item.graphs
  const graphs: Record<string, KnowledgeGraph> = {}
  const root = item.graph.nodes.find((node) => node.id === 'root')
  if (root && item.seedConceptId) graphs[item.seedConceptId] = { nodes: [root], edges: [] }
  for (const node of item.graph.nodes) {
    if (!node.id.startsWith('c-')) continue
    graphs[node.id.slice(2)] = { nodes: [{ ...node, id: 'root' }], edges: [] }
  }
  return graphs
}

export function settledMineConceptIdsOf(item: KnowledgeRecord): string[] {
  if (item.owner === 'example') return Object.keys(conceptGraphsOf(item))
  return Object.entries(conceptGraphsOf(item))
    .filter(([, graph]) => hasSettledMineConceptGraph(graph))
    .map(([id]) => id)
}



function toKnowledgeCard(item: KnowledgeRecord): KnowledgeCard {
  return {
    id: item.id,
    routeId: item.routeId,
    owner: item.owner,
    title: item.title,
    description: item.description,
    icon: item.icon,
    sources: item.sources,
    type: item.type,
  }
}

export function listRoutes(owner: 'mine' | 'example'): RouteCard[] {
  if (owner === 'example') return exampleRoutes().map(toRouteCard)
  return readSnapshot(PROJECTION_KEY).routes.filter(isRenderableMineRoute).map(toRouteCard)
}

/** Read-only showcase data; current user knowledge comes from ProductLibrary. */
export function listExampleKnowledge(): KnowledgeCard[] {
  return exampleKnowledge().map(toKnowledgeCard)
}

export function getRoute(id: string): RouteRecord | undefined {
  const key = id.trim()
  if (!key) return undefined
  const routes=readWorkspace().routes
  const exact=routes.find(item=>item.id===key)
  if(exact)return exact
  const aliases=routes.filter(item=>item.document.id===key)
  if(aliases.length)return aliases.length===1?aliases[0]:undefined
  return findExampleBlueprint(key)?exampleRoutes().find(item=>item.id===key):undefined
}

export function persistRepairedMineDocument(routeId: string, document: RouteRecord['document']) {
  const current = getRoute(routeId)
  if (current?.owner !== 'mine' || !hostDocumentChanged(current.document, document)) return
  mutate((snapshot) => {
    snapshot.routes = snapshot.routes.map((route) => (
      route.id === routeId && route.owner === 'mine' ? { ...route, document } : route
    ))
  })
}

/** These accessors only read legacy archives or named examples, never server knowledge. */
export function getReadOnlyKnowledge(id: string): KnowledgeRecord | undefined {
  return readWorkspace().knowledge.find((item) => item.id === id) ?? exampleKnowledge().find((item) => item.id === id)
}

export function getReadOnlyKnowledgeByRoute(routeId: string): KnowledgeRecord | undefined {
  const route = getRoute(routeId)
  if (route?.knowledgeId) {const knowledge=getReadOnlyKnowledge(route.knowledgeId);if(knowledge)return knowledge}
  return readWorkspace().knowledge.find(k=>k.routeId===routeId)
}

export function getReadOnlyConceptGraph(knowledgeId: string, conceptId: string): KnowledgeGraph | undefined {
  const knowledge = getReadOnlyKnowledge(knowledgeId)
  if (!knowledge) return undefined
  const stored = conceptGraphsOf(knowledge)[conceptId]
  if (knowledge.owner !== 'example') {
    return stored
  }
  if (stored) return stored
  const lesson = getReadOnlyLesson(knowledge.routeId, conceptId)
  if (!lesson) return undefined
  return graphFromLesson(conceptTitle(blueprintOf(knowledge.routeId), conceptId), lesson, conceptAccent(blueprintOf(knowledge.routeId), conceptId))
}

export function listReadOnlyConceptCards(knowledgeId: string): ConceptCard[] {
  const knowledge = getReadOnlyKnowledge(knowledgeId)
  if (!knowledge) return []
  const blueprint = blueprintOf(knowledge.routeId)
  const learned = knowledge.owner === 'example'
    ? blueprintConcepts(blueprint).filter(item => settledMineConceptIdsOf(knowledge).includes(item.id))
    : settledMineConceptIdsOf(knowledge).map((id) => (
      blueprintConcepts(blueprint).find((item) => item.id === id)
      ?? { id, title: conceptTitle(blueprint, id), summary: '', carrierId: '', carrierTitle: '' }
    ))
  return learned.map((item) => ({
    id: item.id,
    knowledgeId: knowledge.id,
    routeId: knowledge.routeId,
    title: item.title,
    description: getReadOnlyLesson(knowledge.routeId, item.id)?.heading || item.summary,
    icon: knowledge.icon,
    sources: knowledge.sources,
    type: knowledge.type,
  }))
}

export function getConversation(id: string): ConversationRecord | undefined {
  return readWorkspace().conversations.find((item) => item.id === id)
}

export function getReadOnlyLesson(routeId: string, conceptId: string): FirstLesson | undefined {
  const stored = readWorkspace().lessons[lessonKey(routeId, conceptId)]
  if (stored) return stored
  return catalogLesson(routeId, conceptId)
}



function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function recordLearningHistory(conversation: ConversationRecord, bump = true) {
  if (conversation.kind !== 'learning') return
  if (!bump && readChatHistory().some((item) => item.id === conversation.id)) return
  addChatHistory(conversation.title, 'learning', {
    id: conversation.id,
    routeId: conversation.routeId,
    conceptId: conversation.conceptId,
    title: conversation.title,
  })
}

function isFailedHomeConversation(conversation: ConversationRecord) {
  if (conversation.kind === 'home-route') return !conversation.routeReady && (conversation.routeStep ?? -2) < 0
  if (conversation.kind === 'home-answer') return !conversation.turns.some((turn) => turn.role === 'assistant' && !turn.failed)
  return false
}

export function hydrateLearningHistory() {
  const snapshot = readWorkspace()
  for (const conversation of snapshot.conversations) {
    recordLearningHistory(conversation, false)
  }
  const keep = new Set(snapshot.conversations.filter((item) => !isFailedHomeConversation(item)).map((item) => item.id))
  retainChatHistory(new Set(readChatHistory().filter((entry) => keep.has(entry.id)).map((entry) => entry.id)))
}

export function createHomeConversation(query: string, experience: ConversationRecord['experience']): ConversationRecord {
  const kind: ConversationKind = experience === 'route' ? 'home-route' : 'home-answer'
  const conversation: ConversationRecord = {
    id: newId('chat'),
    kind,
    title: query.length > 28 ? `${query.slice(0, 28)}…` : query,
    query,
    experience,
    turns: [],
    value: '',
    quote: '',
    mode: '',
    updatedAt: Date.now(),
    routeStep: experience === 'route' ? -2 : undefined,
    routeChoices: experience === 'route' ? [] : undefined,
    routeReady: false,
  }
  mutate((snapshot) => {
    snapshot.conversations = [conversation, ...snapshot.conversations.filter((item) => item.id !== conversation.id)].slice(0, 40)
  })
  return conversation
}

export function saveConversation(id: string, patch: Partial<ConversationRecord>) {
  mutate((snapshot) => {
    snapshot.conversations = snapshot.conversations.map((item) => item.id === id ? { ...item, ...patch, id: item.id, updatedAt: Date.now() } : item)
  })
}

export function attachConversationToRoute(routeId: string, conversationId: string) {
  mutate((snapshot) => {
    snapshot.routes = snapshot.routes.map((route) => {
      if (route.id !== routeId) return route
      const conversationIds = route.conversationIds.includes(conversationId) ? route.conversationIds : [...route.conversationIds, conversationId]
      return { ...route, conversationIds }
    })
    snapshot.conversations = snapshot.conversations.map((item) => item.id === conversationId ? { ...item, routeId, updatedAt: Date.now() } : item)
  })
}

export function createMineRouteFromChat(query: string, choices: string[], conversationId: string, document: RouteRecord['document'], resourceId?: string): RouteRecord {
  const existing = getConversation(conversationId)
  const processTrace = loadConversationTrace(conversationId, existing?.routeId)
  if (existing?.routeId) {
    const route = getRoute(existing.routeId)
    if (route && route.document.id === document.id && (!resourceId || route.id === resourceId)) {
      if (processTrace.length && !asProcessSteps(route.processTrace)?.length) {
        mutate((snapshot) => {
          snapshot.routes = snapshot.routes.map((item) => item.id === route.id ? { ...item, processTrace } : item)
        })
      }
      return getRoute(existing.routeId) ?? route
    }
  }
  const created = mineRouteFromValidatedDocument(query, conversationId, document, Date.now(), resourceId)
  const route = processTrace.length ? { ...created, processTrace } : created
  mutate((snapshot) => {
    snapshot.routes = [route, ...snapshot.routes.filter((item) => item.id !== route.id)]
    snapshot.conversations = snapshot.conversations.map((item) => item.id === conversationId ? {
      ...item,
      routeId: route.id,
      routeChoices: choices,
      routeReady: true,
      routeStep: 4,
      ...(processTrace.length ? { processTrace } : {}),
      updatedAt: Date.now(),
    } : item)
  })
  return getRoute(route.id) ?? route
}

export function startLinkedConversation(routeId: string): ConversationRecord {
  const route = getRoute(routeId)
  const siblings = readWorkspace().conversations.filter((item) => item.routeId === routeId)
  const conversation: ConversationRecord = {
    id: newId('chat'),
    kind: 'route-followup',
    title: route ? `${route.title} · 对话 ${siblings.length + 1}` : '新对话',
    query: route?.title ?? '继续这条路线',
    experience: 'route',
    routeId,
    knowledgeId: route?.knowledgeId ?? undefined,
    routeReady: true,
    routeStep: 4,
    routeChoices: siblings[0]?.routeChoices ?? [],
    turns: [],
    value: '',
    quote: '',
    mode: '',
    updatedAt: Date.now(),
  }
  mutate((snapshot) => {
    snapshot.conversations = [conversation, ...snapshot.conversations]
    snapshot.routes = snapshot.routes.map((item) => item.id === routeId ? { ...item, conversationIds: [...item.conversationIds, conversation.id] } : item)
  })
  addChatHistory(conversation.query, 'route', { id: conversation.id, routeId })
  return conversation
}

export function latestLearningConversation(routeId: string, conceptId: string): ConversationRecord | undefined {
  return readWorkspace().conversations.find((item) => item.kind === 'learning' && item.routeId === routeId && item.conceptId === conceptId)
}

export function ensureLearningConversation(routeId: string, conceptId: string): ConversationRecord {
  const snapshot = readWorkspace()
  const existing = snapshot.conversations.find((item) => item.kind === 'learning' && item.routeId === routeId && item.conceptId === conceptId)
  if (existing) {
    recordLearningHistory(existing, false)
    return existing
  }
  const route = getRoute(routeId)
  const conversation: ConversationRecord = {
    id: newId('learn'),
    kind: 'learning',
    title: `${conceptTitle(findExampleBlueprint(routeId) ?? draftFromRoute(route), conceptId) || conceptId} · 对话 1`,
    query: conceptId,
    experience: 'answer',
    routeId,
    knowledgeId: route?.knowledgeId ?? undefined,
    conceptId,
    turns: [],
    value: '',
    quote: '',
    mode: '',
    updatedAt: Date.now(),
  }
  mutate((state) => {
    state.conversations = [conversation, ...state.conversations]
    if (route && state.routes.some((item) => item.id === routeId)) {
      state.routes = state.routes.map((item) => item.id === routeId ? { ...item, conversationIds: item.conversationIds.includes(conversation.id) ? item.conversationIds : [...item.conversationIds, conversation.id] } : item)
    }
  })
  recordLearningHistory(conversation)
  return conversation
}

function draftFromRoute(route?: RouteRecord): RouteBlueprint {
  const example = route ? findExampleBlueprint(route.id) : undefined
  if (example) return example
  return {
    id: route?.id ?? 'unknown',
    owner: route?.owner ?? 'mine',
    title: route?.title ?? '当前路线',
    summary: route?.summary ?? '',
    outcome: route?.outcome ?? '',
    duration: route?.duration ?? '',
    tags: route?.tags ?? [],
    icon: route?.icon ?? 'route',
    documentId: route?.document.id ?? 'unknown',
    description: route?.summary ?? '',
    goalTitle: route?.outcome ?? '',
    goalSummary: route?.summary ?? '',
    startSummary: '',
    carriers: (route?.document.structure.concepts ?? []).reduce<RouteBlueprint['carriers']>((carriers, concept) => {
      const subject = carriers.find((item) => item.id === concept.subjectId)
      const card = route?.document.data.cards.find((item) => item.id === concept.cardRef)
      const entry = [concept.id, card?.title ?? concept.id, card?.summary ?? ''] as const
      if (subject) {
        subject.concepts = [...subject.concepts, entry]
        return carriers
      }
      const subjectMeta = route?.document.structure.subjects.find((item) => item.id === concept.subjectId)
      const subjectCard = route?.document.data.cards.find((item) => item.id === subjectMeta?.cardRef)
        ?? route?.document.data.cards.find((item) => item.id === `card-${concept.subjectId}`)
      carriers.push({
        id: concept.subjectId,
        title: titleFromPathLayer(route?.document, concept.subjectId) || readableLayerTitle(subjectCard?.title) || '',
        summary: subjectCard?.summary ?? '',
        concepts: [entry],
      })
      return carriers
    }, []),
  }
}

export function blueprintOf(routeId: string) {
  const example = findExampleBlueprint(routeId)
  if (example) return example
  return draftFromRoute(getRoute(routeId))
}



export function saveConversationDraft(id: string, draft: { turns?: LearningTurn[]; value?: string; quote?: string; mode?: AssistantMode }) {
  saveConversation(id, draft)
}

export function findLearningDraft(entry: { id: string; routeId?: string; conceptId?: string; title?: string }) {
  const conversations = readWorkspace().conversations.filter((item) => item.kind === 'learning')
  const byId = conversations.find((item) => item.id === entry.id)
  if (byId) return byId
  const scoped = conversations.filter((item) => (
    Boolean(entry.routeId && entry.conceptId && item.routeId === entry.routeId && item.conceptId === entry.conceptId)
  ))
  if (entry.title) {
    const byTitle = scoped.find((item) => item.title === entry.title)
    if (byTitle) return byTitle
  }
  return scoped.length === 1 ? scoped[0] : undefined
}

export function startLearningConversation(routeId: string, conceptId: string): ConversationRecord {
  const route = getRoute(routeId)
  const siblings = readWorkspace().conversations.filter((item) => item.kind === 'learning' && item.routeId === routeId && item.conceptId === conceptId)
  const conversation: ConversationRecord = {
    id: newId('learn'),
    kind: 'learning',
    title: `${conceptTitle(blueprintOf(routeId), conceptId)} · 对话 ${siblings.length + 1}`,
    query: conceptId,
    experience: 'answer',
    routeId,
    knowledgeId: route?.knowledgeId ?? undefined,
    conceptId,
    turns: [],
    value: '',
    quote: '',
    mode: '',
    updatedAt: Date.now(),
  }
  mutate((snapshot) => {
    snapshot.conversations = [conversation, ...snapshot.conversations]
    if (route && !snapshot.routes.some((item) => item.id === routeId)) return
    snapshot.routes = snapshot.routes.map((item) => item.id === routeId ? { ...item, conversationIds: [...item.conversationIds, conversation.id] } : item)
  })
  recordLearningHistory(conversation)
  return conversation
}

export function recommendedExampleKnowledge() {
  return listExampleKnowledge().slice(0, 2)
}

/** Local projection of server-owned resources; source content remains on the server. */
export function hydrateProductLibrary(data: import('../learning-v2/library').ProductLibrary) {
  mutate(snapshot=>{
    snapshot.routes=data.paths.map(p=>{
      const old=snapshot.routes.find(r=>r.id===p.id)
      const fresh=mineRouteFromValidatedDocument(p.goal,p.id,p.document,p.updatedAt,p.id)
      return {...fresh,conversationIds:[...new Set([...(old?.conversationIds??[]),...data.conversations.filter(c=>c.routeId===p.id).map(c=>c.id)])],knowledgeId:old?.knowledgeId??null,processTrace:old?.processTrace}
    })
    for(const entry of data.conversations){
      if(entry.kind==='learning')continue
      const existing=snapshot.conversations.find(c=>c.pathRunId===entry.resourceId||c.id===entry.id)
      const id=entry.id
      const conversation:ConversationRecord={id,kind:entry.kind==='path'?'home-route':'home-answer',title:entry.title,query:entry.query,experience:entry.kind==='path'?'route':'answer',routeId:entry.routeId,turns:[],value:'',quote:'',mode:'',updatedAt:entry.updatedAt,...(entry.kind==='path'?{pathRunId:entry.resourceId}:{})}
      snapshot.conversations=[{...conversation,value:existing?.value??'',quote:existing?.quote??'',processTrace:existing?.processTrace,routeReady:!!entry.routeId,id},...snapshot.conversations.filter(c=>c.id!==id&&!(entry.kind==='path'&&c.pathRunId===entry.resourceId))]
    }
  })
}
