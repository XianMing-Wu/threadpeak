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
  questionSets: PathQuestionSet[]
  followUpMessage?: string
  document?: { id: string; metadata?: { title?: string } }
  route?: { routeId: string; title: string }
  reply?: string
  error?: { code: string; message: string }
  knowledgeCreated: false
}

const TIMEOUT_MS = 360_000

async function post(url: string, body: unknown): Promise<PathRunView> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('路线服务返回了无法解析的响应。')
  }
  const record = payload && typeof payload === 'object' ? payload as PathRunView : undefined
  if (!record || !record.status) {
    throw new Error('路线服务不可用。')
  }
  return record
}

export const pathLaunchAttachments = new Map<string, PathAttachment[]>()

export function startPathRun(input: { goal: string; attachments?: PathAttachment[]; thinkingDepth?: 'fast' | 'deep' }) {
  return post('/api/path-runs', input)
}

export async function getPathRun(runId: string): Promise<PathRunView> {
  const response = await fetch(`/api/path-runs/${encodeURIComponent(runId)}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('路线服务返回了无法解析的响应。')
  }
  const record = payload && typeof payload === 'object' ? payload as PathRunView : undefined
  if (!record || !record.status || record.status === 'failed' && !record.runId) {
    throw new Error('找不到这次路线制定。')
  }
  return record
}

export function selectPathAnswer(runId: string, questionId: string, optionId: string) {
  return post(`/api/path-runs/${runId}/select`, { questionId, optionId })
}

export function commitPathAnswers(runId: string) {
  return post(`/api/path-runs/${runId}/commit`, {})
}

export function followUpPathRun(runId: string, message: string) {
  return post(`/api/path-runs/${runId}/follow-up`, { message })
}

export function retryPathRun(runId: string) {
  return post(`/api/path-runs/${runId}/retry`, {})
}

export function replyPathRun(runId: string, message: string) {
  return post(`/api/path-runs/${runId}/reply`, { message })
}
