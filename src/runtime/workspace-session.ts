import { useSyncExternalStore } from 'react'

export type WorkspaceSession = {
  kind: 'guest' | 'authenticated'
  provider: 'zhihu' | 'account' | null
  workspaceId: string
  capabilities: { zhihuMaterials: boolean }
  profile?: { name?: string; demo?: boolean }
  demo?: boolean
}
let current: WorkspaceSession | null = null
const listeners = new Set<() => void>()
export function publishWorkspaceSession(session: WorkspaceSession | null) {
  current = session
  listeners.forEach(notify => notify())
}
export const getWorkspaceSession = () => current
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify) } }
export const useWorkspaceSession = () => useSyncExternalStore(subscribe, getWorkspaceSession, () => null)
