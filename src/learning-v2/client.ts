import { LearningSchema, type LearningState } from '../../packages/contracts/src/learning-v2.ts'
export type TaskView={id:string;kind:string;status:'queued'|'running'|'waiting'|'completed'|'cancelled';phase:string;draft:string;recoverable:boolean;basisIds:string[];conversationId?:string}
export type LearningSnapshot={id:string;kind:'learning';revision:number;data:LearningState;job:TaskView|null}
let session:Promise<void>|undefined
export function resetSession(){session=undefined}
export function ensureSession(){
  return session??=fetch('/api/v2/session',{credentials:'same-origin',signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw new Error('请先登录后继续。');const identity=await r.json();const old=localStorage.getItem('tp-server-workspace');if(old&&old!==identity.workspaceId){
    // Browser projections are account-scoped; the server remains the source of truth.
    for(const key of Object.keys(localStorage))if(key.startsWith('threadpeak-')&&!['threadpeak-theme','threadpeak-authenticated'].includes(key))localStorage.removeItem(key)
    for(const key of Object.keys(sessionStorage))if(key.startsWith('threadpeak-')||key.startsWith('tp-'))sessionStorage.removeItem(key)
  }localStorage.setItem('tp-server-workspace',identity.workspaceId)}).catch(e=>{session=undefined;throw e})
}
export class ApiError extends Error { code:string; status:number; constructor(code:string,status:number,message:string){super(message);this.code=code;this.status=status} }
export async function productRequest<T>(url:string,options:{method?:string;body?:unknown;key?:string;signal?:AbortSignal}={}):Promise<T>{
  await ensureSession()
  const key=options.key??crypto.randomUUID()
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(url,{method:options.method??'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:options.body===undefined?undefined:JSON.stringify(options.body),signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(url==='/api/v2/attachments'?45000:15000)]):AbortSignal.timeout(url==='/api/v2/attachments'?45000:15000)})
      const data=await response.json()
      if(!response.ok)throw new ApiError(data.code??'UNAVAILABLE',response.status,data.message??'暂时没有连接上，已有内容仍然保留。')
      return data as T
    }catch(error){
      if(options.signal?.aborted)throw error
      if(error instanceof ApiError&&error.status<500)throw error
      if(attempt===2)throw error
      await new Promise(r=>setTimeout(r,400*2**attempt))
    }
  }
  throw new Error('暂时没有连接上。')
}
export function readLearning(value:unknown):LearningSnapshot{
  const s=value as LearningSnapshot
  if(!s||s.kind!=='learning'||!Number.isInteger(s.revision)||typeof s.id!=='string')throw new Error('学习内容尚未读取完整。')
  return {...s,data:LearningSchema.parse(s.data)}
}
