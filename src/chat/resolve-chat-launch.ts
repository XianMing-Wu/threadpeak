export type ChatLaunchExperience = 'answer' | 'route'

export type ChatLaunchReady = {
  kind: 'ready'
  query: string
  mode: ChatLaunchExperience
  conversationId: string
  routeId?: string
  resourceId?:string
  generate?: boolean
  thinkingDepth?: 'fast' | 'deep'
}

export type ChatLaunchNotFound = {
  kind: 'not-found'
}

export type ChatLaunchResolution = ChatLaunchReady | ChatLaunchNotFound

function normalizeMode(value: unknown): ChatLaunchExperience {
  return value === 'route' || value === 'answer' ? value : 'answer'
}

export function resolveChatLaunch(raw: unknown): ChatLaunchResolution {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const query = typeof record.query === 'string' ? record.query.trim() : ''
  if (!query) return { kind: 'not-found' }
  const conversationId = typeof record.conversationId === 'string' ? record.conversationId : ''
  const routeId = typeof record.routeId === 'string' && record.routeId ? record.routeId : undefined
  return {
    kind: 'ready',
    query,
    mode: normalizeMode(record.mode),
    conversationId,
    ...(routeId ? { routeId } : {}),
    ...(typeof record.resourceId==='string'?{resourceId:record.resourceId}:{}),
    ...(record.generate === true ? { generate: true } : {}),
    ...(record.thinkingDepth === 'deep' || record.thinkingDepth === 'fast' ? { thinkingDepth: record.thinkingDepth } : {}),
  }
}
