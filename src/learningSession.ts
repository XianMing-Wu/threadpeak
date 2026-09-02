import type { AssistantMode } from './assistant-mode'
import type { RouteName } from './components/Shell'
import { getConversation, saveConversationDraft, syncConversationGraph } from './workspace/store'
import {
  openKnowledge,
  openKnowledgeFromSession,
  readActiveConversationId,
  readCanvasReturn as readCanvasReturnNav,
} from './workspace/nav'

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
      syncConversationGraph(conversation.routeId, conversation.conceptId, conversation.id, conversation.turns)
    }
    openKnowledgeFromSession()
    return
  }
  openKnowledge(sessionStorage.getItem('threadpeak-active-knowledge') ?? '', returnTo)
}

export function readCanvasReturn(): RouteName {
  return readCanvasReturnNav()
}
