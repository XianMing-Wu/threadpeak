import type { LearningProgressStoragePort } from 'liu-kanshan-learning-path-3d'

export type PathProgressCache = {
  read(key: string): string | null
  write(key: string, value: string): void
}

const memory = new Map<string, string>()
let workspace:string|null=null
function currentAccount(){let next:string|null=null;try{next=localStorage.getItem('tp-server-workspace')}catch{/* Local memory is still bounded. */}if(next!==workspace){memory.clear();workspace=next}}
function remember(key:string,value:string){memory.delete(key);memory.set(key,value);while(memory.size>32)memory.delete(memory.keys().next().value!)}
if(typeof window!=='undefined')window.addEventListener('threadpeak:account-change',()=>memory.clear())

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
      currentAccount()
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (memory.has(key)) return memory.get(key) ?? null
      const persisted = cache?.read(key) ?? null
      if (persisted != null) remember(key, persisted)
      return persisted
    },
    write({ key, value }, { signal }) {
      currentAccount()
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      remember(key, value)
      cache?.write(key, value)
    },
  }
}

export function resetPathProgressStorageForTests() {
  memory.clear()
}
