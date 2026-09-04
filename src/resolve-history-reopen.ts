export type HistoryReopenEntry = {
  id: string
  title: string
  query: string
  experience: 'answer' | 'route' | 'learning'
  routeId?: string
  conceptId?: string
}

export type HistoryReopenConversation = {
  id: string
  kind: string
  query: string
  experience?: 'answer' | 'route'
  routeId?: string
  conceptId?: string
}

export type HistoryReopenResolution =
  | {
    kind: 'draft-learning'
    conversationId: string
    routeId: string
    conceptId: string
  }
  | {
    kind: 'draft-chat'
    conversationId: string
    query: string
    experience: 'answer' | 'route'
    routeId?: string
  }
  | {
    kind: 'unavailable'
    reason: 'missing-draft'
    title: string
    message: string
  }

export function resolveHistoryReopen(
  entry?: HistoryReopenEntry,
  conversation?: HistoryReopenConversation,
): HistoryReopenResolution {
  if (!entry) {
    return {
      kind: 'unavailable',
      reason: 'missing-draft',
      title: '无法打开这条记录',
      message: '没有可以重新打开的对话。',
    }
  }
  if (entry.experience === 'learning') {
    const routeId = conversation?.routeId || entry.routeId || ''
    const conceptId = conversation?.conceptId || entry.conceptId || ''
    if (conversation?.kind === 'learning' && routeId && conceptId) {
      return {
        kind: 'draft-learning',
        conversationId: conversation.id,
        routeId,
        conceptId,
      }
    }
    if (routeId && conceptId) {
      return {
        kind: 'draft-learning',
        conversationId: entry.id,
        routeId,
        conceptId,
      }
    }
    return {
      kind: 'unavailable',
      reason: 'missing-draft',
      title: '无法打开这条记录',
      message: '这条学习记录已经不在了。',
    }
  }
  const query = (conversation?.query || entry.query).trim()
  if (!query) {
    return {
      kind: 'unavailable',
      reason: 'missing-draft',
      title: '无法打开这条记录',
      message: '这次对话打不开了。',
    }
  }
  const raw = conversation?.experience === 'route' || conversation?.experience === 'answer'
    ? conversation.experience
    : entry.experience === 'route'
      ? entry.experience
      : 'answer'
  const experience = raw
  return {
    kind: 'draft-chat',
    conversationId: conversation?.id || entry.id,
    query,
    experience,
    ...(conversation?.routeId || entry.routeId
      ? { routeId: conversation?.routeId || entry.routeId }
      : {}),
  }
}
