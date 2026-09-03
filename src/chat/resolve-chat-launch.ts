export type ChatLaunchExperience = 'answer' | 'route' | 'visual'

export type ChatLaunchReady = {
  kind: 'ready'
  query: string
  mode: ChatLaunchExperience
  conversationId: string
  routeId?: string
  generate?: boolean
}

export type ChatLaunchUnavailable = {
  kind: 'unavailable'
  reason: 'missing-chat-launch'
  title: string
  message: string
}

export type ChatLaunchResolution = ChatLaunchReady | ChatLaunchUnavailable

function normalizeMode(value: unknown): ChatLaunchExperience {
  return value === 'route' || value === 'visual' || value === 'answer' ? value : 'answer'
}

export function resolveChatLaunch(raw: unknown): ChatLaunchResolution {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const query = typeof record.query === 'string' ? record.query.trim() : ''
  if (!query) {
    return {
      kind: 'unavailable',
      reason: 'missing-chat-launch',
      title: '无法打开这次对话',
      message: '这次对话没有可用的发送上下文。不能用预写问题或 localStorage 会话正文冒充已打开的会话。',
    }
  }
  const conversationId = typeof record.conversationId === 'string' ? record.conversationId : ''
  const routeId = typeof record.routeId === 'string' && record.routeId ? record.routeId : undefined
  return {
    kind: 'ready',
    query,
    mode: normalizeMode(record.mode),
    conversationId,
    ...(routeId ? { routeId } : {}),
    ...(record.generate === true ? { generate: true } : {}),
  }
}
