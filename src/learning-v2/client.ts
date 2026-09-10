import {switchWorkspace} from './account-storage.ts'
import {publishWorkspaceSession} from '../runtime/workspace-session.ts'
import {delay} from './poll.ts'
import type {TaskActivity} from '@threadpeak/contracts/task-activity'
import { LearningSchema,validateTree, type LearningState } from '@threadpeak/contracts/learning-v2'
export type TaskView={updated_at?:number;activities?:TaskActivity[];id:string;kind:string;status:'queued'|'running'|'waiting'|'completed'|'cancelled';phase:string;draft:string;recoverable:boolean;basisIds:string[];conversationId?:string}
export type LearningSnapshot={id:string;kind:'learning';revision:number;dataRevision?:number;data:LearningState;job:TaskView|null}
let session:Promise<void>|undefined
export function resetSession(){session=undefined;publishWorkspaceSession(null)}
export function ensureSession(){
  return session??=fetch('/api/v2/session',{credentials:'same-origin',signal:AbortSignal.timeout(15000)}).then(async r=>{
    if(!r.ok)throw new Error('请先登录后继续。')
    const identity=await r.json()
    if(typeof identity.workspaceId!=='string'||!identity.workspaceId)throw new Error('工作区身份无法读取。')
    await switchWorkspace(identity.workspaceId)
    publishWorkspaceSession(identity)
  }).catch(e=>{session=undefined;throw e})
}
export class ApiError extends Error { code:string; status:number; constructor(code:string,status:number,message:string){super(message);this.code=code;this.status=status} }
export async function productRequest<T>(url:string,options:{method?:string;body?:unknown;key?:string;signal?:AbortSignal}={}):Promise<T>{
  await ensureSession()
  const workspace=localStorage.getItem('tp-server-workspace')
  const key=options.key??crypto.randomUUID()
  const readOnly=!options.method||options.method==='GET'
  for(let attempt=0;attempt<(readOnly?1:3);attempt++){
    try{
      const response=await fetch(url,{method:options.method??'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:options.body===undefined?undefined:JSON.stringify(options.body),signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(url==='/api/v2/attachments'?45000:15000)]):AbortSignal.timeout(url==='/api/v2/attachments'?45000:15000)})
      const data=await response.json()
      if(!response.ok)throw new ApiError(data.code??'UNAVAILABLE',response.status,data.message??'暂时没有连接上，已有内容仍然保留。')
      if(workspace!==localStorage.getItem('tp-server-workspace'))throw new ApiError('ACCOUNT_CHANGED',409,'账号已改变，请重新打开内容。')
      if(!readOnly)window.dispatchEvent(new Event('threadpeak:resource-change'))
      return data as T
    }catch(error){
      if(options.signal?.aborted)throw error
      if(error instanceof ApiError&&error.status<500)throw error
      if(readOnly||attempt===2)throw error
      await delay(400*2**attempt,options.signal)
    }
  }
  throw new Error('暂时没有连接上。')
}
export function readLearning(value:unknown,previous?:LearningSnapshot|null):LearningSnapshot{
  const s=value as LearningSnapshot
  if(!s||s.kind!=='learning'||!Number.isInteger(s.revision)||typeof s.id!=='string')throw new Error('学习内容尚未读取完整。')
  if(s.dataRevision!==undefined&&(!Number.isInteger(s.dataRevision)||s.dataRevision<0||s.dataRevision>s.revision))throw new Error('学习内容版本无法读取。')
  if(previous?.id===s.id&&s.dataRevision!==undefined&&previous.dataRevision===s.dataRevision)return {...s,data:previous.data}
  const data=LearningSchema.parse(s.data);if(data.nodes.length)validateTree(data.nodes)
  return {...s,data}
}
