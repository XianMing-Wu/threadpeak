export type HistoryReopenEntry = {
  id: string
  title: string
  query: string
  experience: 'answer' | 'route' | 'visual' | 'learning'
  routeId?: string
  conceptId?: string
}

export type HistoryReopenConversation = {
  id: string
  kind: string
  query: string
  experience?: 'answer' | 'route' | 'visual'
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
    experience: 'answer' | 'route' | 'visual'
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
      title: '无法重开这次历史',
      message: '没有可重开的本地草稿。不能编造一次已提交会话。',
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
      title: '无法重开这次历史',
      message: '这条学习草稿已经不在。不能用空记录冒充精确重开。',
    }
  }
  const query = (conversation?.query || entry.query).trim()
  if (!query) {
    return {
      kind: 'unavailable',
      reason: 'missing-draft',
      title: '无法重开这次历史',
      message: '这次对话没有可用的发送上下文。不能用预写问题冒充已打开的会话。',
    }
  }
  const experience = conversation?.experience === 'route' || conversation?.experience === 'visual' || conversation?.experience === 'answer'
    ? conversation.experience
    : entry.experience === 'route' || entry.experience === 'visual'
      ? entry.experience
      : 'answer'
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
