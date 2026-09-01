import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import type { RouteRecord } from './types'

export function mineRouteFromValidatedDocument(
  query: string,
  conversationId: string,
  document: LearningPathDocument,
  createdAt: number,
): RouteRecord {
  if (document.protocol !== 'learning-path' || document.version !== '1.0') {
    throw new Error('User-triggered routes require a validated renderer document.')
  }
  return {
    id: document.id,
    owner: 'mine',
    title: document.metadata.title,
    summary: document.metadata.description ?? query,
    outcome: document.metadata.title,
    duration: '',
    tags: [],
    icon: 'route',
    document,
    conversationIds: [conversationId],
    knowledgeId: null,
    createdAt,
  }
}
