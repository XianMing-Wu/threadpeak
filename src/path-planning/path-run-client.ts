import { DEFAULT_SEARCH_SCOPE,SearchScopeSchema,type SearchScope } from '@threadpeak/contracts/search-scope'
import { z } from 'zod'
import { productRequest } from '../learning-v2/client'
import { pollResource } from '../learning-v2/poll'
import type { ProcessStep } from '../process-trace'

export function rememberPathSearchScope(commandKey: string, searchScope: SearchScope) {
  sessionStorage.setItem(`tp-route-scope:${commandKey}`, JSON.stringify(SearchScopeSchema.parse(searchScope)))
}

export type PathAttachment = {
  sourceId: string
  fileName: string
  mimeType?: 'application/pdf' | 'text/markdown' | 'text/plain'
  content: string
}

export type PathQuestionSet = {
  round: number
  message?: string
  customAnswers?: Record<string, string>
  status: 'active' | 'superseded'
  questions: {
    id: string
    prompt: string
    reason?: string
    options: { id: string; label: string }[]
  }[]
  selectedOptionIds: Record<string, string>
}

export type PathRunView = {
  runId: string
  recoverable?:boolean
  preparing?:boolean
  goal: string
  status: 'running' | 'awaiting_answers' | 'published' | 'failed'
  stage: string
  trace?: ProcessStep[]
  questionSets: PathQuestionSet[]
  followUpMessage?: string
  document?: { id: string; metadata?: { title?: string } }
  route?: { routeId: string; title: string }
  reply?: string
  error?: { code: string; message: string }
  knowledgeCreated: false
}

export type PathRunWatch = {
  thinkingDepth?: 'fast' | 'deep'
  commandKey?: string
  onUpdate?: (view: PathRunView) => void
  signal?: AbortSignal
}

function asView(payload: unknown): PathRunView | undefined {
  const record = payload && typeof payload === 'object' ? payload as PathRunView : undefined
  if (!record || !record.status) return undefined
  return record
}

async function post(url: string, body: unknown, signal?: AbortSignal, key?:string): Promise<PathRunView> {
  const record = asView(await productRequest(url, { method:'POST', body, signal, key }))
  if (!record) throw new Error('路线服务不可用。')
  return record
}

export async function getPathRun(runId: string, signal?: AbortSignal): Promise<PathRunView> {
  const record=asView(await productRequest(`/api/path-runs/${encodeURIComponent(runId)}`,{signal}))
  if (!record || record.status === 'failed' && !record.runId) {
    throw new Error('找不到这次路线制定。')
  }
  return record
}

export async function watchPathRun(view: PathRunView, watch?: PathRunWatch): Promise<PathRunView> {
  watch?.onUpdate?.(view)
  if (view.status !== 'running' || !view.runId) return view
  let current = view
  const signal=watch?.signal??new AbortController().signal
  let failed:unknown
  await pollResource(async()=>{
    current=await getPathRun(current.runId,signal)
    if(signal.aborted)return false
    watch?.onUpdate?.(current)
    return current.status==='running'
  },{signal,onError:(error,stopped)=>{if(stopped)failed=error;watch?.onUpdate?.({...current,stage:stopped?'连接暂停，请重新连接':'正在重新连接，资料和选择仍然保留'})}})
  signal.throwIfAborted()
  if(failed)throw failed
  return current
}

export const pathLaunchAttachments = new Map<string, PathAttachment[]>()
export function readPathLaunchAttachments(id:string):{sourceId:string}[]{
  const raw=sessionStorage.getItem(`tp-launch-materials:${id}`)
  if(raw){try{return z.array(z.object({sourceId:z.string().min(1)})).max(8).parse(JSON.parse(raw))}catch{throw new Error('已选资料记录无法读取，原选择仍保留，请返回首页检查。')}}
  return (pathLaunchAttachments.get(id)??[]).map(a=>({sourceId:a.sourceId}))
}


export async function startPathRun(
  input: { goal: string; attachments?: {sourceId:string}[]; thinkingDepth?: 'fast' | 'deep'; searchScope?: SearchScope },
  watch?: PathRunWatch,
) {
  const cacheKey=`tp-route-command:${watch?.commandKey??''}`
  let frozen:typeof input={...input,attachments:input.attachments?.map(a=>({sourceId:a.sourceId}))}
  if (!frozen.searchScope && watch?.commandKey) {
    const scope = sessionStorage.getItem(`tp-route-scope:${watch.commandKey}`)
    if(scope){try{frozen.searchScope=SearchScopeSchema.parse(JSON.parse(scope))}catch{throw new Error('搜索范围记录无法读取，请回首页重新选择。')}}
  }
  frozen.searchScope ??= DEFAULT_SEARCH_SCOPE
  if(watch?.commandKey){
    const previous=sessionStorage.getItem(cacheKey)
    if(previous){
      try{frozen=z.object({goal:z.string().min(1),thinkingDepth:z.enum(['fast','deep']).optional(),searchScope:SearchScopeSchema,attachments:z.array(z.object({sourceId:z.string().min(1)})).optional()}).strict().parse(JSON.parse(previous))}
      catch{throw new Error('这次发送的本地记录无法读取，原记录已保留，请返回首页重新发起。')}
    }
    else sessionStorage.setItem(cacheKey,JSON.stringify({...frozen,attachments:input.attachments?.map(a=>({sourceId:a.sourceId}))}))
  }
  return watchPathRun(await post('/api/path-runs', frozen, watch?.signal,watch?.commandKey), watch)
}

export async function selectPathAnswer(runId: string, questionId: string, optionId: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/select`, { questionId, optionId }, watch?.signal, `path-answer:${runId}:${questionId}`), watch)
}

export async function submitCustomPathAnswer(runId: string, questionId: string, customAnswer: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/select`, { questionId, customAnswer }, watch?.signal, `path-answer:${runId}:${questionId}`), watch)
}

export async function followUpPathRun(runId: string, message: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/follow-up`, { message, thinkingDepth: watch?.thinkingDepth }, watch?.signal), watch)
}

export async function retryPathRun(runId: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/retry`, {}, watch?.signal), watch)
}

export async function replyPathRun(runId: string, message: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/reply`, { message, thinkingDepth: watch?.thinkingDepth }, watch?.signal), watch)
}
