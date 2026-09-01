import { useEffect, useState } from 'react'
import { normalizeAssistantMode, type AssistantMode } from '../assistant-mode'
import { addChatHistory, readChatHistory } from '../history'
import {
  blueprintConcepts,
  catalogLesson,
  conceptAccent,
  conceptTitle,
  documentFromBlueprint,
  draftFirstLesson,
  draftMineBlueprint,
  exampleBlueprints,
  exampleKnowledgeRecord,
  findExampleBlueprint,
  firstConceptId,
  graphFromLesson,
  routeRecordFromBlueprint,
} from './catalog'
import { conversationHostAfterGrow, growGraph, mergeConversationBranch, parseGrowCommand, parseQuotedUserTurn, parseTurnHost, plainQuoteText, readGrowCommand, replyCardTitle, resolveQuotedHost } from '../knowledge-canvas/generate'
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
  WorkspaceSnapshot,
} from './types'

export const WORKSPACE_KEY = 'threadpeak-workspace-v1'
export const WORKSPACE_EVENT = 'threadpeak:workspace-change'

const emptySnapshot = (): WorkspaceSnapshot => ({
  version: 1,
  routes: [],
  knowledge: [],
  conversations: [],
  lessons: {},
})

function lessonKey(routeId: string, conceptId: string) {
  return `${routeId}::${conceptId}`
}

function validSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!value || typeof value !== 'object') return false
  const snap = value as WorkspaceSnapshot
  return snap.version === 1 && Array.isArray(snap.routes) && Array.isArray(snap.knowledge) && Array.isArray(snap.conversations) && !!snap.lessons
}

function migrateConversationModes(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  let dirty = false
  const conversations = snapshot.conversations.map((conversation) => {
    const mode = normalizeAssistantMode((conversation as { mode?: unknown }).mode)
    let turnsChanged = false
    const turns = conversation.turns.map((turn) => {
      const rawMode = (turn as { mode?: unknown }).mode
      if (rawMode === undefined) return turn
      const nextMode = normalizeAssistantMode(rawMode)
      if (nextMode === rawMode) return turn
      turnsChanged = true
      return { ...turn, mode: nextMode }
    })
    if (mode === conversation.mode && !turnsChanged) return conversation
    dirty = true
    return { ...conversation, mode, turns }
  })
  if (!dirty) return snapshot
  const next = { ...snapshot, conversations }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next))
  return next
}

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

function isLegacyLesson(lesson?: FirstLesson) {
  return Boolean(lesson?.paragraphs.some((paragraph) => paragraph.includes('这是你第一次进入') && paragraph.includes('而不是套用别的路线的讲稿')))
}

function migrateKnowledge(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  let dirty = false
  const lessons = { ...snapshot.lessons }
  const knowledge = snapshot.knowledge.map((item) => {
    const mixed = item.graph.nodes.some((node) => node.id.startsWith('c-'))
    const graphs = conceptGraphsOf(item)
    const route = snapshot.routes.find((entry) => entry.id === item.routeId)
    const blueprint = findExampleBlueprint(item.routeId) ?? (route ? draftFromRoute(route) : undefined)
    const nextGraphs: Record<string, KnowledgeGraph> = { ...graphs }
    let itemDirty = !item.graphs || mixed
    if (blueprint) {
      for (const conceptId of Object.keys(graphs)) {
        const current = lessons[lessonKey(item.routeId, conceptId)]
        if (item.graphs?.[conceptId] && !isLegacyLesson(current) && !mixed) continue
        const fresh = draftFirstLesson(blueprint, conceptId)
        lessons[lessonKey(item.routeId, conceptId)] = fresh
        nextGraphs[conceptId] = graphFromLesson(conceptTitle(blueprint, conceptId), fresh, conceptAccent(blueprint, conceptId))
        itemDirty = true
      }
    }
    if (!itemDirty) return item
    dirty = true
    return {
      ...item,
      description: route?.summary ?? item.description,
      graph: nextGraphs[item.seedConceptId] ?? { nodes: item.graph.nodes.filter((node) => node.id === 'root'), edges: [] },
      graphs: nextGraphs,
    }
  })
  if (!dirty) return snapshot
  const next = { ...snapshot, knowledge, lessons }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(next))
  return next
}

export function readWorkspace(): WorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY)
    if (!raw) return emptySnapshot()
    const parsed = JSON.parse(raw) as unknown
    return validSnapshot(parsed) ? migrateKnowledge(migrateConversationModes(parsed)) : emptySnapshot()
  } catch {
    return emptySnapshot()
  }
}

function writeWorkspace(snapshot: WorkspaceSnapshot) {
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot))
  window.dispatchEvent(new Event(WORKSPACE_EVENT))
}

function mutate(update: (snapshot: WorkspaceSnapshot) => void) {
  const snapshot = readWorkspace()
  update(snapshot)
  writeWorkspace(snapshot)
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
    carriers: route.document.structure.subjects.filter((item) => item.id !== 'route-start' && item.id !== 'goal-understanding').length,
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
  return readWorkspace().routes.map(toRouteCard)
}

export function listKnowledge(owner: 'mine' | 'example'): KnowledgeCard[] {
  if (owner === 'example') return exampleKnowledge().map(toKnowledgeCard)
  return readWorkspace().knowledge.map(toKnowledgeCard)
}

export function getRoute(id: string): RouteRecord | undefined {
  return readWorkspace().routes.find((item) => item.id === id) ?? exampleRoutes().find((item) => item.id === id)
}

export function getKnowledge(id: string): KnowledgeRecord | undefined {
  return readWorkspace().knowledge.find((item) => item.id === id) ?? exampleKnowledge().find((item) => item.id === id)
}

export function getKnowledgeByRoute(routeId: string): KnowledgeRecord | undefined {
  const route = getRoute(routeId)
  if (route?.knowledgeId) return getKnowledge(route.knowledgeId)
  return undefined
}

export function getConceptGraph(knowledgeId: string, conceptId: string): KnowledgeGraph | undefined {
  const knowledge = getKnowledge(knowledgeId)
  if (!knowledge) return undefined
  const stored = conceptGraphsOf(knowledge)[conceptId]
  if (stored) return stored
  const lesson = getLesson(knowledge.routeId, conceptId)
  if (!lesson) return undefined
  return graphFromLesson(conceptTitle(blueprintOf(knowledge.routeId), conceptId), lesson, conceptAccent(blueprintOf(knowledge.routeId), conceptId))
}

export function listConceptCards(knowledgeId: string): ConceptCard[] {
  const knowledge = getKnowledge(knowledgeId)
  if (!knowledge) return []
  const blueprint = blueprintOf(knowledge.routeId)
  const graphs = conceptGraphsOf(knowledge)
  const learned = knowledge.owner === 'example'
    ? blueprintConcepts(blueprint)
    : blueprintConcepts(blueprint).filter((item) => Boolean(graphs[item.id]))
  return learned.map((item) => ({
    id: item.id,
    knowledgeId: knowledge.id,
    routeId: knowledge.routeId,
    title: item.title,
    description: getLesson(knowledge.routeId, item.id)?.heading || item.summary,
    icon: knowledge.icon,
    sources: knowledge.sources,
    type: knowledge.type,
  }))
}

export function getConversation(id: string): ConversationRecord | undefined {
  return readWorkspace().conversations.find((item) => item.id === id)
}

export function getLesson(routeId: string, conceptId: string): FirstLesson | undefined {
  const stored = readWorkspace().lessons[lessonKey(routeId, conceptId)]
  if (stored) return stored
  return catalogLesson(routeId, conceptId)
}

export function hasGeneratedLesson(routeId: string, conceptId: string) {
  const route = getRoute(routeId)
  if (!route) return false
  if (route.owner === 'example') return true
  return Boolean(readWorkspace().lessons[lessonKey(routeId, conceptId)])
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

export function hydrateLearningHistory() {
  for (const conversation of readWorkspace().conversations) {
    recordLearningHistory(conversation, false)
  }
}

export function createHomeConversation(query: string, experience: ConversationRecord['experience']): ConversationRecord {
  const kind: ConversationKind = experience === 'route' ? 'home-route' : experience === 'visual' ? 'home-visual' : 'home-answer'
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
  addChatHistory(query, experience, { id: conversation.id, routeId: conversation.routeId })
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

export function createMineRouteFromChat(query: string, choices: string[], conversationId: string): RouteRecord {
  const existing = getConversation(conversationId)
  if (existing?.routeId) {
    const route = getRoute(existing.routeId)
    if (route) return route
  }
  const blueprint = draftMineBlueprint(query, choices)
  const route = routeRecordFromBlueprint(blueprint, {
    knowledgeId: null,
    conversationIds: [conversationId],
    createdAt: Date.now(),
  })
  mutate((snapshot) => {
    snapshot.routes = [route, ...snapshot.routes.filter((item) => item.id !== route.id)]
    snapshot.conversations = snapshot.conversations.map((item) => item.id === conversationId ? {
      ...item,
      routeId: route.id,
      routeChoices: choices,
      routeReady: true,
      routeStep: 4,
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
      const subjectCard = route?.document.data.cards.find((item) => item.id === `card-${concept.subjectId}`)
      carriers.push({ id: concept.subjectId, title: subjectCard?.title ?? concept.subjectId, summary: subjectCard?.summary ?? '', concepts: [entry] })
      return carriers
    }, []),
  }
}

export function blueprintOf(routeId: string) {
  const example = findExampleBlueprint(routeId)
  if (example) return example
  return draftFromRoute(getRoute(routeId))
}

export function syncKnowledgeWithFirstLesson(routeId: string, conceptId: string): { lesson: FirstLesson; knowledge?: KnowledgeRecord; createdKnowledge: boolean } {
  const route = getRoute(routeId)
  if (!route) {
    const fallback = catalogLesson(routeId, conceptId) ?? draftFirstLesson(blueprintOf(routeId), conceptId)
    return { lesson: fallback, createdKnowledge: false }
  }
  const existingLesson = readWorkspace().lessons[lessonKey(routeId, conceptId)]
  if (existingLesson) {
    return { lesson: existingLesson, knowledge: route.knowledgeId ? getKnowledge(route.knowledgeId) : undefined, createdKnowledge: false }
  }
  if (route.owner === 'example') {
    const lesson = catalogLesson(routeId, conceptId) ?? draftFirstLesson(blueprintOf(routeId), conceptId)
    return { lesson, knowledge: getKnowledgeByRoute(routeId), createdKnowledge: false }
  }

  const lesson = draftFirstLesson(blueprintOf(routeId), conceptId)
  const graph = graphFromLesson(conceptTitle(blueprintOf(routeId), conceptId), lesson, conceptAccent(blueprintOf(routeId), conceptId))
  let createdKnowledge = false
  mutate((snapshot) => {
    snapshot.lessons[lessonKey(routeId, conceptId)] = lesson
    if (!route.knowledgeId) {
      const knowledge = {
        id: `knowledge-${route.id}`,
        routeId: route.id,
        owner: 'mine' as const,
        title: route.title,
        description: route.summary,
        icon: route.icon,
        sources: 2,
        type: '知乎回答',
        seedConceptId: conceptId,
        graph,
        graphs: { [conceptId]: graph },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      snapshot.knowledge = [knowledge, ...snapshot.knowledge]
      snapshot.routes = snapshot.routes.map((item) => item.id === route.id ? { ...item, knowledgeId: knowledge.id } : item)
      createdKnowledge = true
    } else {
      snapshot.knowledge = snapshot.knowledge.map((item) => {
        if (item.id !== route.knowledgeId) return item
        const graphs = conceptGraphsOf(item)
        if (graphs[conceptId]) return { ...item, graphs, updatedAt: Date.now() }
        return {
          ...item,
          graphs: { ...graphs, [conceptId]: graph },
          updatedAt: Date.now(),
        }
      })
    }
    snapshot.conversations = snapshot.conversations.map((item) => item.routeId === routeId ? { ...item, knowledgeId: snapshot.routes.find((entry) => entry.id === routeId)?.knowledgeId ?? item.knowledgeId } : item)
  })
  return { lesson, knowledge: getKnowledgeByRoute(routeId), createdKnowledge }
}

export function saveConversationDraft(id: string, draft: { turns?: LearningTurn[]; value?: string; quote?: string; mode?: AssistantMode }) {
  saveConversation(id, draft)
}

export function saveKnowledgeGraph(knowledgeId: string, graph: KnowledgeRecord['graph'], conceptId?: string) {
  mutate((snapshot) => {
    const write = (item: KnowledgeRecord): KnowledgeRecord => {
      const key = conceptId || item.seedConceptId
      const graphs = { ...conceptGraphsOf(item), [key]: graph }
      return {
        ...item,
        graph: key === item.seedConceptId ? graph : item.graph,
        graphs,
        updatedAt: Date.now(),
      }
    }
    if (snapshot.knowledge.some((item) => item.id === knowledgeId)) {
      snapshot.knowledge = snapshot.knowledge.map((item) => item.id === knowledgeId ? write(item) : item)
      return
    }
    const cataloged = exampleKnowledge().find((item) => item.id === knowledgeId)
    if (cataloged) snapshot.knowledge = [write(cataloged), ...snapshot.knowledge]
  })
}

function replyParagraphs(reply: string) {
  if (reply === 'visual') return ['这次用图把刚才引用的关系摊开，而不是再写一段定义。']
  if (reply === 'authors') return ['这次把问题交给相关作者的公开回答，而不是直接给一条新定义。']
  return [reply]
}

export function syncConversationGraph(
  routeId: string,
  conceptId: string,
  conversationId: string,
  turns?: LearningTurn[],
) {
  const knowledge = getKnowledgeByRoute(routeId)
  if (!knowledge) return
  const conversation = getConversation(conversationId)
  const lesson = getLesson(routeId, conceptId)
  if (!lesson) return
  const blueprint = blueprintOf(routeId)
  const root = {
    ...graphFromLesson(conceptTitle(blueprint, conceptId), lesson, conceptAccent(blueprint, conceptId)).nodes[0],
    id: 'root',
  }
  const existing = getConceptGraph(knowledge.id, conceptId)
  const foreignNodes = (existing?.nodes ?? []).filter((node) => node.id !== 'root' && node.conversationId && node.conversationId !== conversationId)
  const keep = new Set(['root', ...foreignNodes.map((node) => node.id)])
  const foreignEdges = (existing?.edges ?? []).filter((edge) => keep.has(edge.from) && keep.has(edge.to))
  let branchNodes: KnowledgeGraph['nodes'] = [root]
  let branchEdges: KnowledgeGraph['edges'] = []
  let hostId = 'root'
  let lastCreatedId = ''
  const replay = (turns ?? conversation?.turns ?? []).map((item) => ({ ...item }))
  const createdAtTurn = new Map<number, string>()
  for (let index = 0; index < replay.length; index += 1) {
    const user = replay[index]
    const assistant = replay[index + 1]
    if (user.role !== 'user' || assistant?.role !== 'assistant') continue
    const assistantIndex = index + 1
    index += 1
    const parsed = parseQuotedUserTurn(user.text)
    const command = user.grow
      ? { kind: user.grow, question: parsed.question }
      : readGrowCommand(parsed.question) || readGrowCommand(user.text) || parseGrowCommand(parsed.question)
    const kind = command?.kind ?? 'succ'
    const asked = command && !user.grow ? command.question : parsed.question.replace(/^[123]\s*/, '').trim()
    const quote = user.quote || parsed.quote || plainQuoteText(user.text)
    const turnHostId = (() => {
      const turnIndex = parseTurnHost(user.quoteFromId)
      return turnIndex == null ? undefined : createdAtTurn.get(turnIndex)
    })()
    const attachId = resolveQuotedHost(branchNodes, hostId, quote, user.quoteFromId, turnHostId)
    const grown = growGraph(branchNodes, branchEdges, attachId, kind, asked, quote, {
      title: replyCardTitle(assistant.text, asked || quote || root.title),
      question: quote ? `引用「${quote}」` : asked,
      replyKind: 'full',
      paragraphs: replyParagraphs(assistant.text),
    }, conversationId)
    if (!grown) continue
    branchNodes = grown.nodes
    branchEdges = grown.edges
    createdAtTurn.set(assistantIndex, grown.created.id)
    lastCreatedId = grown.created.id
    replay[assistantIndex] = { ...assistant, nodeId: grown.created.id }
    replay[assistantIndex - 1] = { ...user, quote, grow: kind, quoteFromId: user.quoteFromId }
    hostId = conversationHostAfterGrow(kind, attachId, grown.created.id)
  }
  const merged = mergeConversationBranch(root, foreignNodes, foreignEdges, branchNodes, branchEdges)
  saveKnowledgeGraph(knowledge.id, { nodes: merged.nodes, edges: merged.edges }, conceptId)
  saveConversation(conversationId, {
    turns: replay,
    canvasHostId: merged.idMap.get(hostId) || hostId,
  })
  if (conversation) recordLearningHistory({ ...conversation, turns: replay })
  return merged.idMap.get(lastCreatedId) || lastCreatedId || undefined
}

export function appendLearningTurnToGraph(
  routeId: string,
  conceptId: string,
  conversationId: string,
  input: { question: string; quote?: string; quoteFromId?: string; reply: string },
) {
  const conversation = getConversation(conversationId)
  const quote = plainQuoteText(input.quote ?? '')
  const grow = parseGrowCommand(input.question)?.kind
  const quoteFromId = input.quoteFromId
  const userText = quote ? `引用「${quote}」\n${input.question}` : input.question
  const prior = conversation?.turns ?? []
  const already = prior.some((item, index) => item.role === 'user' && item.text === userText && prior[index + 1]?.role === 'assistant')
  const turns = already
    ? prior.map((item) => (
      item.role === 'user' && item.text === userText
        ? { ...item, quote, grow: grow || item.grow, quoteFromId: quoteFromId || item.quoteFromId }
        : item
    ))
    : [...prior, { role: 'user' as const, text: userText, quote, quoteFromId, grow }, { role: 'assistant' as const, text: input.reply }]
  return syncConversationGraph(routeId, conceptId, conversationId, turns)
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
  return listKnowledge('example').slice(0, 2)
}

export function recommendedExampleRoutes() {
  return listRoutes('example').slice(0, 2)
}

export function defaultConceptId(routeId: string) {
  return firstConceptId(blueprintOf(routeId))
}

export function routeDocument(routeId: string) {
  const route = getRoute(routeId)
  if (route) return route.document
  const example = findExampleBlueprint(routeId)
  return example ? documentFromBlueprint(example) : undefined
}
