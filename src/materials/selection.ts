import type { PathAttachment } from '../path-planning/path-run-client.ts'
import type { SearchScope } from '../../packages/contracts/src/search-scope.ts'

export type { SearchScope } from '../../packages/contracts/src/search-scope.ts'
export type MaterialView = PathAttachment & {
  status: 'processing' | 'ready'
  origin: 'upload' | 'collection' | 'creation'
  folderId?: string
  recent?: boolean
  preview?: boolean
  count?: number
  notice?: string
  job?: { status: string; phase: string }
}

export function normalizeScope(value: unknown): SearchScope {
  const input = value as Partial<SearchScope> | null
  if (input?.kind === 'collections') return {
    kind: 'collections',
    folderIds: [...new Set(Array.isArray(input.folderIds) ? input.folderIds.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 240) : [])].slice(0, 8),
  }
  return { kind: input?.kind === 'web' ? 'web' : 'zhihu' }
}

/** Only explicit folder selections are submitted, even if an earlier import finishes late. */
export function selectedMaterials(files: MaterialView[], folders: Record<string, MaterialView>, scope: SearchScope): MaterialView[] {
  return [...files.filter(item => item.origin === 'upload'), ...(scope.kind === 'collections'
    ? (scope.folderIds ?? []).flatMap(id => folders[id] ? [folders[id]] : []) : [])]
}

export function materialsReady(files: MaterialView[], folders: Record<string, MaterialView>, scope: SearchScope): boolean {
  if (scope.kind === 'collections' && (!(scope.folderIds?.length) || scope.folderIds.some(id => !folders[id]))) return false
  return selectedMaterials(files, folders, scope).every(item => item.status === 'ready')
}
