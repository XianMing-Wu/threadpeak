import type { RouteName } from '../components/Shell'
import { resolveOpenLearningTarget } from '../session/resolve-learning-entry'
import { getKnowledge, getRoute } from './store'

export const ACTIVE_ROUTE_KEY = 'threadpeak-active-route'
export const ACTIVE_CONCEPT_KEY = 'threadpeak-active-concept'
export const ACTIVE_KNOWLEDGE_KEY = 'threadpeak-active-knowledge'
export const KNOWLEDGE_CONCEPT_KEY = 'threadpeak-knowledge-concept'
export const KNOWLEDGE_RETURN_KEY = 'threadpeak-knowledge-return'
export const ACTIVE_CONVERSATION_KEY = 'threadpeak-active-conversation'
export const PATH_RETURN_KEY = 'threadpeak-path-return'
export const CANVAS_RETURN_KEY = 'threadpeak-canvas-return'
export const SESSION_RETURN_KEY = 'threadpeak-session-return'
export const NAV_EVENT = 'threadpeak:nav-change'

function readKey(key: string) {
  return sessionStorage.getItem(key) ?? ''
}

function writeKey(key: string, value: string) {
  if (value) sessionStorage.setItem(key, value)
  else sessionStorage.removeItem(key)
  window.dispatchEvent(new Event(NAV_EVENT))
}

export function readActiveRouteId() {
  return readKey(ACTIVE_ROUTE_KEY)
}

export function readActiveConceptId() {
  return readKey(ACTIVE_CONCEPT_KEY)
}

export function readActiveKnowledgeId() {
  return readKey(ACTIVE_KNOWLEDGE_KEY)
}

export function readKnowledgeConceptId() {
  return readKey(KNOWLEDGE_CONCEPT_KEY)
}

export function readActiveConversationId() {
  return readKey(ACTIVE_CONVERSATION_KEY)
}

export function setActiveConversation(id: string) {
  writeKey(ACTIVE_CONVERSATION_KEY, id)
}

export function readPathReturn(): RouteName {
  const value = readKey(PATH_RETURN_KEY)
  return value === 'chat' || value === 'home' || value === 'paths' ? value : 'paths'
}

export function readKnowledgeListReturn(): RouteName {
  const value = readKey(KNOWLEDGE_RETURN_KEY)
  return value === 'home' ? 'home' : 'knowledge'
}

export function readCanvasReturn(): RouteName {
  const value = readKey(CANVAS_RETURN_KEY)
  return value === 'session-learning' ? 'session-learning' : 'knowledge-detail'
}

export function readSessionReturn(): RouteName {
  const value = readKey(SESSION_RETURN_KEY)
  return value === 'path-3d' || value === 'knowledge-detail' ? value : 'path-3d'
}

export function openRoute(routeId: string, returnTo: RouteName = 'paths') {
  writeKey(ACTIVE_ROUTE_KEY, routeId)
  writeKey(PATH_RETURN_KEY, returnTo)
  const knowledge = getRoute(routeId)?.knowledgeId
  if (knowledge) writeKey(ACTIVE_KNOWLEDGE_KEY, knowledge)
  location.hash = 'path-3d'
}

export function openKnowledge(knowledgeId: string, returnTo: RouteName = 'knowledge') {
  const knowledge = getKnowledge(knowledgeId)
  writeKey(ACTIVE_KNOWLEDGE_KEY, knowledgeId)
  writeKey(KNOWLEDGE_CONCEPT_KEY, '')
  writeKey(KNOWLEDGE_RETURN_KEY, returnTo === 'home' ? 'home' : 'knowledge')
  if (knowledge?.routeId) writeKey(ACTIVE_ROUTE_KEY, knowledge.routeId)
  location.hash = 'knowledge-detail'
}

export function openConceptKnowledge(knowledgeId: string, conceptId: string, returnTo: RouteName = 'knowledge-detail') {
  const knowledge = getKnowledge(knowledgeId)
  writeKey(ACTIVE_KNOWLEDGE_KEY, knowledgeId)
  writeKey(KNOWLEDGE_CONCEPT_KEY, conceptId)
  writeKey(CANVAS_RETURN_KEY, returnTo === 'session-learning' ? 'session-learning' : 'knowledge-detail')
  if (knowledge?.routeId) writeKey(ACTIVE_ROUTE_KEY, knowledge.routeId)
  location.hash = 'knowledge-detail'
}

export function closeConceptKnowledge() {
  writeKey(KNOWLEDGE_CONCEPT_KEY, '')
}

export function openLearning(routeId: string, conceptId?: string, returnTo: RouteName = 'path-3d') {
  const target = resolveOpenLearningTarget(routeId, conceptId)
  writeKey(ACTIVE_ROUTE_KEY, target.routeId)
  writeKey(ACTIVE_CONCEPT_KEY, target.conceptId)
  writeKey(SESSION_RETURN_KEY, returnTo)
  const knowledge = getRoute(target.routeId)?.knowledgeId
  if (knowledge) writeKey(ACTIVE_KNOWLEDGE_KEY, knowledge)
  location.hash = 'session-learning'
}

export function openKnowledgeFromSession() {
  const routeId = readActiveRouteId()
  const conceptId = readActiveConceptId()
  if (!routeId || !conceptId) return
  const route = getRoute(routeId)
  writeKey(ACTIVE_ROUTE_KEY, routeId)
  writeKey(KNOWLEDGE_CONCEPT_KEY, conceptId)
  writeKey(CANVAS_RETURN_KEY, 'session-learning')
  writeKey(ACTIVE_KNOWLEDGE_KEY, route?.knowledgeId ?? '')
  location.hash = 'knowledge-detail'
}
