import type { LearningProgressStoragePort } from 'liu-kanshan-learning-path-3d'

export type PathProgressCache = {
  read(key: string): string | null
  write(key: string, value: string): void
}

const memory = new Map<string, string>()

export function pathProgressKey(documentId: string): string {
  const id = documentId.trim()
  if (!id || /\s/.test(id)) {
    throw new Error('3D progressKey requires a non-empty document id without whitespace.')
  }
  return `threadpeak:path-progress:document:${id}`
}

export function sessionPathProgressCache(): PathProgressCache {
  return {
    read(key) {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
    write(key, value) {
      try {
        sessionStorage.setItem(key, value)
      } catch {
        // Discardable view cache. Quota or private-mode failure must not invent a path.
      }
    },
  }
}

export function createPathProgressStorage(cache?: PathProgressCache): LearningProgressStoragePort {
  return {
    read({ key }, { signal }) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (memory.has(key)) return memory.get(key) ?? null
      const persisted = cache?.read(key) ?? null
      if (persisted != null) memory.set(key, persisted)
      return persisted
    },
    write({ key, value }, { signal }) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      memory.set(key, value)
      cache?.write(key, value)
    },
  }
}

export function resetPathProgressStorageForTests() {
  memory.clear()
}
