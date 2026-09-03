import type { AssistantMode } from './assistant-mode'
import type { RouteName } from './components/Shell'
import { getConversation, latestLearningConversation, replayConceptGraph, saveConversationDraft, startLearningConversation } from './workspace/store'
import {
  openKnowledge,
  openKnowledgeFromSession,
  openLearning,
  readActiveConversationId,
  readCanvasReturn as readCanvasReturnNav,
  setActiveConversation,
} from './workspace/nav'
import { HISTORY_OPEN_EVENT } from './history'

export type LearningTurn = { role: 'user' | 'assistant'; text: string; mode?: AssistantMode; failed?: boolean }

export type LearningSessionState = {
  turns: LearningTurn[]
  value: string
  quote: string
  mode: AssistantMode
}

const empty: LearningSessionState = { turns: [], value: '', quote: '', mode: '' }

export function readLearningSession(): LearningSessionState {
  const conversation = getConversation(readActiveConversationId())
  if (!conversation) return empty
  return {
    turns: conversation.turns,
    value: conversation.value,
    quote: conversation.quote,
    mode: conversation.mode,
  }
}

export function writeLearningSession(state: LearningSessionState) {
  const id = readActiveConversationId()
  if (!id) return
  saveConversationDraft(id, state)
}

export function openKnowledgeCanvas(returnTo: RouteName = 'knowledge') {
  if (returnTo === 'session-learning') {
    const conversation = getConversation(readActiveConversationId())
    if (conversation?.routeId && conversation.conceptId) {
      replayConceptGraph(conversation.routeId, conversation.conceptId)
    }
    openKnowledgeFromSession()
    return
  }
  openKnowledge(sessionStorage.getItem('threadpeak-active-knowledge') ?? '', returnTo)
}

export function readCanvasReturn(): RouteName {
  return readCanvasReturnNav()
}

export function returnToLatestLearning(routeId: string, conceptId: string) {
  const trimmedRoute = routeId.trim()
  const trimmedConcept = conceptId.trim()
  if (!trimmedRoute || !trimmedConcept) return
  const conversation = latestLearningConversation(trimmedRoute, trimmedConcept)
    ?? startLearningConversation(trimmedRoute, trimmedConcept)
  setActiveConversation(conversation.id)
  openLearning(trimmedRoute, trimmedConcept, 'path-3d')
  window.dispatchEvent(new Event(HISTORY_OPEN_EVENT))
}
