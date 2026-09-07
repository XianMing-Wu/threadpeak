import { productRequest, ensureSession } from '../learning-v2/client'
import type { ProcessStep } from '../process-trace'
import { SearchScopeSchema, DEFAULT_SEARCH_SCOPE, type SearchScope } from '../../packages/contracts/src/search-scope'

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
  status: 'active' | 'superseded'
  questions: {
    id: string
    prompt: string
    options: { id: string; label: string }[]
  }[]
  selectedOptionIds: Record<string, string>
}

export type PathRunView = {
  runId: string
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
  commandKey?: string
  onUpdate?: (view: PathRunView) => void
  signal?: AbortSignal
}

const TIMEOUT_MS = 360_000
const POLL_MS = 650

function sleep(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return}
  const done=()=>{signal?.removeEventListener('abort',abort);resolve()}
  const timer=setTimeout(done,ms)
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'))}
  signal?.addEventListener('abort',abort,{once:true})
})}

function asView(payload: unknown): PathRunView | undefined {
  const record = payload && typeof payload === 'object' ? payload as PathRunView : undefined
  if (!record || !record.status) return undefined
  return record
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error('路线服务返回了无法解析的响应。')
  }
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
  while (current.status === 'running') {
    await sleep(POLL_MS, watch?.signal)
    try{current = await getPathRun(current.runId, watch?.signal)}catch(error){
      if(watch?.signal?.aborted)throw error
      if(error instanceof Error&&'status' in error&&error.status===404)throw error
      watch?.onUpdate?.({...current,stage:'正在重新连接，资料和选择仍然保留'})
      await sleep(1500,watch?.signal);continue
    }
    watch?.onUpdate?.(current)
  }
  return current
}

export const pathLaunchAttachments = new Map<string, PathAttachment[]>()

export async function startPathRun(
  input: { goal: string; attachments?: PathAttachment[]; thinkingDepth?: 'fast' | 'deep'; searchScope?: SearchScope },
  watch?: PathRunWatch,
) {
  const cacheKey=`tp-route-command:${watch?.commandKey??''}`
  let frozen={...input}
  if (!frozen.searchScope && watch?.commandKey) {
    const scope = sessionStorage.getItem(`tp-route-scope:${watch.commandKey}`)
    if (scope) frozen.searchScope = SearchScopeSchema.parse(JSON.parse(scope))
  }
  frozen.searchScope ??= DEFAULT_SEARCH_SCOPE
  if(watch?.commandKey){
    const previous=sessionStorage.getItem(cacheKey)
    if(previous)frozen=JSON.parse(previous)
    else sessionStorage.setItem(cacheKey,JSON.stringify({...frozen,attachments:input.attachments?.map(a=>({...a,content:'[已上传，服务端读取原文]'}))}))
  }
  return watchPathRun(await post('/api/path-runs', frozen, watch?.signal,watch?.commandKey), watch)
}

export async function selectPathAnswer(runId: string, questionId: string, optionId: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/select`, { questionId, optionId }, watch?.signal), watch)
}

export async function commitPathAnswers(runId: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/commit`, {}, watch?.signal), watch)
}

export async function followUpPathRun(runId: string, message: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/follow-up`, { message }, watch?.signal), watch)
}

export async function retryPathRun(runId: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/retry`, {}, watch?.signal), watch)
}

export async function replyPathRun(runId: string, message: string, watch?: PathRunWatch) {
  return watchPathRun(await post(`/api/path-runs/${runId}/reply`, { message }, watch?.signal), watch)
}
