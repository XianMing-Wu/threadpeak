import { createRuntimeStore, type RuntimeStore } from '@threadpeak/runtime-store'
import { WORKSPACE_EVENT } from '../workspace/store'
import { projectLibraryReadModel, type LibraryReadModel } from './library-read-model'

// This is a UI selector cache. Durable snapshots/revisions are accepted separately
// by learning-v2; this store does not own product records or synthesize events.
let store:RuntimeStore<LibraryReadModel>|undefined
let subscribers=0
let detach:(()=>void)|undefined
export function getLibraryProjectionStore(){return store??=createRuntimeStore(projectLibraryReadModel())}
export function attachLibraryProjection():()=>void {
  const current=getLibraryProjectionStore()
  if(++subscribers===1){
    const refresh=()=>current.hydrateFromGet(projectLibraryReadModel())
    addEventListener(WORKSPACE_EVENT,refresh);addEventListener('storage',refresh);addEventListener('threadpeak:account-change',refresh)
    detach=()=>{removeEventListener(WORKSPACE_EVENT,refresh);removeEventListener('storage',refresh);removeEventListener('threadpeak:account-change',refresh)}
    refresh()
  }
  return()=>{if(--subscribers===0){detach?.();detach=undefined}}
}
