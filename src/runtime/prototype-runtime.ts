import { createRuntimeStore, type RuntimeStore } from '@threadpeak/runtime-store'
import { WORKSPACE_EVENT } from '../workspace/store'
import { projectLibraryReadModel, type LibraryReadModel } from './library-read-model'

let store: RuntimeStore<LibraryReadModel> | undefined
let listening = false

export function getPrototypeRuntimeStore(): RuntimeStore<LibraryReadModel> {
  if (!store) store = createRuntimeStore(projectLibraryReadModel())
  return store
}

export function ensurePrototypeRuntimeListeners() {
  const current = getPrototypeRuntimeStore()
  if (listening || typeof window === 'undefined') return current
  listening = true
  const refresh = () => current.hydrateFromGet(projectLibraryReadModel())
  addEventListener(WORKSPACE_EVENT, refresh)
  addEventListener('storage', refresh)
  return current
}
