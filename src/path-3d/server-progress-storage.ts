import type { LearningProgressStoragePort } from 'liu-kanshan-learning-path-3d'
import { productRequest } from '../learning-v2/client'
import { createPathProgressStorage, sessionPathProgressCache } from './path-progress-storage'

const pendingWrites = new Map<string, Promise<void>>()

export function serverProgressStorage(documentId:string):LearningProgressStoragePort{
  const local=createPathProgressStorage(sessionPathProgressCache())
  const workspace=localStorage.getItem('tp-server-workspace')
  const assertWorkspace=()=>{if(localStorage.getItem('tp-server-workspace')!==workspace)throw new Error('ACCOUNT_CHANGED')}
  const url=`/api/v2/paths/${encodeURIComponent(documentId)}/progress`
  const queueKey=`${workspace}:${url}`
  return {
    async read(request,context){
      try{assertWorkspace();await pendingWrites.get(queueKey)?.catch(()=>{});context.signal.throwIfAborted();const result=await productRequest<{value:string|null}>(url,{signal:context.signal});assertWorkspace();if(result.value!==null)await local.write({...request,value:result.value},context);return result.value??local.read(request,context)}
      catch(error){assertWorkspace();if(context.signal.aborted)throw error;return local.read(request,context)}
    },
    async write(request,context){
      assertWorkspace();await local.write(request,context)
      const work=(pendingWrites.get(queueKey)??Promise.resolve()).catch(()=>{}).then(()=>{assertWorkspace();return productRequest(url,{method:'PUT',body:{value:request.value}})}).then(()=>{})
      pendingWrites.set(queueKey,work)
      void work.finally(()=>{if(pendingWrites.get(queueKey)===work)pendingWrites.delete(queueKey)}).catch(()=>{})
      return work
    },
  }
}
