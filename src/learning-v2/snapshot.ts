import type {LearningSnapshot} from './client'
type VersionedSnapshot={id:string;revision:number;job?:{updated_at?:number}|null}
/** A slow poll must not roll back a draft already delivered over SSE. */
export function isStaleSnapshot(old:VersionedSnapshot|null,next:VersionedSnapshot){
  return !!old&&old.id===next.id&&(old.revision>next.revision||old.revision===next.revision&&(old.job?.updated_at??0)>(next.job?.updated_at??0))
}
/** Apply only newer server revisions; share unchanged collections without mutation. */
export function mergeLearningSnapshot(old:LearningSnapshot|null,next:LearningSnapshot):LearningSnapshot{
  if(!old||old.id!==next.id)return next
  if(isStaleSnapshot(old,next))return old
  if(old.dataRevision!==undefined&&old.dataRevision===next.dataRevision)return {...next,data:old.data}
  return {...next,data:{...next.data,
    nodes:equalJson(old.data.nodes,next.data.nodes)?old.data.nodes:next.data.nodes,
    articles:equalJson(old.data.articles,next.data.articles)?old.data.articles:next.data.articles,
    conversations:equalJson(old.data.conversations,next.data.conversations)?old.data.conversations:next.data.conversations,
  }}
}

/** Validated JSON is acyclic; compare without allocating full serialized copies. */
function equalJson(left:unknown,right:unknown):boolean {
  if(left===right)return true
  if(!left||!right||typeof left!=='object'||typeof right!=='object')return false
  if(Array.isArray(left))return Array.isArray(right)&&left.length===right.length&&left.every((value,i)=>equalJson(value,right[i]))
  if(Array.isArray(right))return false
  const a=left as Record<string,unknown>,b=right as Record<string,unknown>,keys=Object.keys(a)
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equalJson(a[key],b[key]))
}
