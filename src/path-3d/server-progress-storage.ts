import type { LearningProgressStoragePort } from 'liu-kanshan-learning-path-3d'
import { productRequest } from '../learning-v2/client'
import { createPathProgressStorage, sessionPathProgressCache } from './path-progress-storage'

const pendingWrites = new Map<string, Promise<void>>()

export function serverProgressStorage(documentId:string):LearningProgressStoragePort{
  const local=createPathProgressStorage(sessionPathProgressCache())
  const url=`/api/v2/paths/${encodeURIComponent(documentId)}/progress`
  return {
    async read(request,context){
      try{await pendingWrites.get(url)?.catch(()=>{});context.signal.throwIfAborted();const result=await productRequest<{value:string|null}>(url,{signal:context.signal});if(result.value!==null)await local.write({...request,value:result.value},context);return result.value}
      catch(error){if(context.signal.aborted)throw error;return local.read(request,context)}
    },
    async write(request,context){
      await local.write(request,context)
      const work=(pendingWrites.get(url)??Promise.resolve()).catch(()=>{}).then(()=>productRequest(url,{method:'PUT',body:{value:request.value}})).then(()=>{})
      pendingWrites.set(url,work)
      void work.finally(()=>{if(pendingWrites.get(url)===work)pendingWrites.delete(url)}).catch(()=>{})
      return work
    },
  }
}
