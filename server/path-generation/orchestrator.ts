import { randomUUID } from 'node:crypto'
import type {
  AttachmentContext,
  SearchGroup,
  StructuredAgentId,
  StructuredInvokeResult,
  TextInvokeResult,
  ThinkingDepth,
  ZhihuSearchResult,
} from '../agent-runtime/types.ts'
import type {
  R1Output,
  R2Output,
  R3bOutput,
  R3Output,
  R4Output,
} from '../agent-runtime/schemas.ts'
import {
  PATH_STRUCTURE_FAILURE_MESSAGE,
  publicSafeFailureMessage,
} from '../agent-runtime/repair.ts'
import { ZHIHU_CONCURRENCY, mapWithConcurrency } from '../agent-runtime/concurrency.ts'
import { packZhihuSearchQueries } from '../agent-runtime/pack-search.ts'
import { PATH_SEARCH_COUNT } from './pack-search.ts'
import { projectRouteToDocument } from './project-document.ts'
import type { LearningPathDocument } from '../../src/vendor/learning-path-3d/index.js'
import {
  agentStep,
  confirmStep,
  searchStep,
  thinkStep,
  type ProcessStep,
} from '../../src/process-trace.ts'

export type PathAttachment = AttachmentContext

export type PathQuestionOption = {
  id: string
  label: string
  routeEffect: string
}

export type PathQuestion = {
  id: string
  prompt: string
  options: PathQuestionOption[]
}

export type PathQuestionSet = {
  round: number
  status: 'active' | 'superseded'
  questions: PathQuestion[]
  selectedOptionIds: Record<string, string>
}

export type ConversationTurn = {
  messageId: string
  role: 'user' | 'assistant' | 'system_event'
  kind: 'text' | 'question_set' | 'route_published'
  content: unknown
}

export type PathRun = {
  runId: string
  goal: string
  attachments: PathAttachment[]
  thinkingDepth: ThinkingDepth
  status: 'running' | 'awaiting_answers' | 'published' | 'failed'
  stage: string
  trace: ProcessStep[]
  queries?: R1Output['queries']
  searchGroups?: SearchGroup[]
  exploration?: R2Output
  questionSets: PathQuestionSet[]
  route?: R4Output
  document?: LearningPathDocument
  conceptIdByWireId?: Record<string, string>
  conversation: ConversationTurn[]
  followUpMessage?: string
  lastReply?: string
  error?: { code: string; message: string }
  knowledgeCreated: false
}

export type PathRunView = {
  runId: string
  goal: string
  status: PathRun['status']
  stage: string
  trace: ProcessStep[]
  questionSets: PathQuestionSet[]
  followUpMessage?: string
  route?: R4Output
  document?: LearningPathDocument
  reply?: string
  error?: { code: string; message: string }
  knowledgeCreated: false
}

export type PathInvokeStructured = <T>(
  agentId: StructuredAgentId,
  context: unknown,
  options?: {
    thinkingDepth?: ThinkingDepth
    parseInput?: { attachmentSourceIds?: readonly string[]; activeRound?: number }
    onReasoning?: (text: string) => void
  },
) => Promise<StructuredInvokeResult<T>>

export type PathInvokeText = (
  agentId: 'R5',
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth; onReasoning?: (text: string) => void },
) => Promise<TextInvokeResult>

export type PathSearch = (query: string, count: number) => Promise<ZhihuSearchResult>

function viewOf(run: PathRun, extra?: { reply?: string }): PathRunView {
  return {
    runId: run.runId,
    goal: run.goal,
    status: run.status,
    stage: run.stage,
    trace: run.trace.map((step) => ({ ...step })),
    questionSets: run.questionSets,
    knowledgeCreated: false,
    ...(run.followUpMessage ? { followUpMessage: run.followUpMessage } : {}),
    ...(run.route ? { route: run.route } : {}),
    ...(run.document ? { document: run.document } : {}),
    ...(run.error ? { error: run.error } : {}),
    ...(extra?.reply || run.lastReply ? { reply: extra?.reply ?? run.lastReply } : {}),
  }
}

function beginStep(run: PathRun, step: ProcessStep) {
  const current = run.trace.find((item) => item.id === step.id)
  if (current) {
    current.kind = step.kind
    current.status = 'running'
    if (step.title !== undefined) current.title = step.title
    if (step.extra !== undefined) current.extra = step.extra
    if (step.thought !== undefined) current.thought = step.thought
    return
  }
  run.trace.push({ ...step, status: 'running' })
}

function bindReasoning(run: PathRun, thinkId: string) {
  if (run.thinkingDepth !== 'deep') return undefined
  return (text: string) => {
    if (!text.trim()) return
    beginStep(run, thinkStep(thinkId))
    const current = run.trace.find((item) => item.id === thinkId)
    if (current) current.thought = text
  }
}

function finishStep(run: PathRun, id: string, extra?: Partial<ProcessStep>) {
  const current = run.trace.find((item) => item.id === id)
  if (!current) return
  current.status = extra?.status ?? 'done'
  if (extra?.title !== undefined) current.title = extra.title
  if (extra?.extra !== undefined) current.extra = extra.extra
  if (extra?.thought !== undefined) current.thought = extra.thought
}

function failOpenSteps(run: PathRun) {
  for (const step of run.trace) {
    if (step.status !== 'running') continue
    if (step.kind === 'think' && step.thought?.trim()) {
      step.status = 'done'
      continue
    }
    step.status = 'failed'
  }
}

function catchBackground(run: PathRun, work: Promise<PathRunView>) {
  void work.catch((error) => {
    failRun(run, 'PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : '路线服务不可用。')
  })
}

function emptyFailedView(runId: string, message: string): PathRunView {
  return {
    runId,
    goal: '',
    status: 'failed',
    stage: 'failed',
    trace: [],
    questionSets: [],
    knowledgeCreated: false,
    error: { code: 'PROVIDER_INVALID', message },
  }
}

function failRun(run: PathRun, code: string, message: string): PathRunView {
  run.status = 'failed'
  run.stage = 'failed'
  failOpenSteps(run)
  const pathStructureFailure = code === 'OUTPUT_INVALID' || code === 'RENDERER_INVALID'
  run.error = {
    code,
    message: pathStructureFailure
      ? PATH_STRUCTURE_FAILURE_MESSAGE
      : publicSafeFailureMessage(message, PATH_STRUCTURE_FAILURE_MESSAGE),
  }
  return viewOf(run)
}

function attachmentIds(attachments: readonly PathAttachment[]): string[] {
  return attachments.map((item) => item.sourceId)
}

function allUndisputed(exploration: R2Output): boolean {
  let count = 0
  for (const concepts of Object.values(exploration)) {
    for (const value of Object.values(concepts)) {
      count += 1
      if (value.争议) return false
    }
  }
  return count > 0
}

function activeSet(run: PathRun): PathQuestionSet | undefined {
  return run.questionSets.find((item) => item.status === 'active')
}

function setComplete(set: PathQuestionSet): boolean {
  return set.questions.every((question) => Boolean(set.selectedOptionIds[question.id]))
}

function r4QuestionContext(run: PathRun) {
  return run.questionSets.map((set) => ({
    round: set.round,
    status: set.status,
    questions: set.questions,
    selectedOptionIds: set.questions.map((question) => set.selectedOptionIds[question.id]).filter(Boolean),
    selectedOptions: set.questions.flatMap((question) => {
      const optionId = set.selectedOptionIds[question.id]
      const option = question.options.find((item) => item.id === optionId)
      return option ? [{ questionId: question.id, optionId: option.id, label: option.label, routeEffect: option.routeEffect }] : []
    }),
  }))
}

function pushConversation(run: PathRun, turn: Omit<ConversationTurn, 'messageId'>) {
  run.conversation.push({ ...turn, messageId: `m-${run.conversation.length + 1}` })
}

export type PublishedConcept = {
  conceptId: string
  title: string
  hasDispute: boolean
  detailedDescription: string
  attachmentSourceIds: string[]
}

export type PublishedPath = {
  documentId: string
  route: R4Output
  conceptIdByWireId: Record<string, string>
}

export function createPathRunStore() {
  const runs = new Map<string, PathRun>()
  const published = new Map<string, PublishedPath>()
  return {
    get(runId: string): PathRun | undefined {
      return runs.get(runId)
    },
    save(run: PathRun) {
      runs.set(run.runId, run)
    },
    savePublished(record: PublishedPath) {
      published.set(record.documentId, record)
    },
    getPublishedConcept(routeId: string, conceptId: string): PublishedConcept | undefined {
      const record = published.get(routeId.trim())
      if (!record) return undefined
      const originalId = record.conceptIdByWireId[conceptId] ?? conceptId
      const concept = record.route.concepts.find((item) => item.id === originalId)
      if (!concept) return undefined
      return {
        conceptId,
        title: concept.title,
        hasDispute: concept.hasDispute,
        detailedDescription: concept.detailedDescription,
        attachmentSourceIds: [...concept.attachmentSourceIds],
      }
    },
  }
}

export function createPathOrchestrator(ports: {
  invokeStructured: PathInvokeStructured
  invokeText: PathInvokeText
  search: PathSearch
  store?: ReturnType<typeof createPathRunStore>
}) {
  const store = ports.store ?? createPathRunStore()

  const startAgent = (run: PathRun, id: string, title: string) => {
    beginStep(run, agentStep(id, title))
  }

  const finishAgent = (run: PathRun, id: string) => {
    finishStep(run, `${id}-think`)
    finishStep(run, id)
  }

  const agentCall = (run: PathRun, id: string, extra?: { parseInput?: { attachmentSourceIds?: readonly string[]; activeRound?: number } }) => ({
    thinkingDepth: run.thinkingDepth,
    onReasoning: bindReasoning(run, `${id}-think`),
    ...(id === 'r4' ? { repairLimit: 2 } : {}),
    ...(extra ?? {}),
  })

  const generateRoute = async (run: PathRun): Promise<PathRunView> => {
    run.status = 'running'
    run.stage = '正在生成学习路线'
    startAgent(run, 'r4', '生成学习路线')
    const r4Input = {
      exploration: run.exploration,
      questionSets: r4QuestionContext(run),
      newerRoundPreferred: true,
      attachments: run.attachments,
    }
    const r4Options = agentCall(run, 'r4', { parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } })
    let generated = await ports.invokeStructured<R4Output>('R4', {
      goal: run.goal,
      ...r4Input,
    }, r4Options)
    if (generated.kind === 'failed' && (generated.code === 'PROVIDER_UNAVAILABLE' || generated.code === 'OUTPUT_INVALID')) {
      generated = await ports.invokeStructured<R4Output>('R4', {
        goal: run.goal,
        ...r4Input,
      }, { ...r4Options, thinkingDepth: 'fast', onReasoning: undefined })
    }
    if (generated.kind === 'failed') return failRun(run, generated.code, generated.message)
    finishAgent(run, 'r4')
    const projected = projectRouteToDocument(generated.value)
    if (!projected.ok) return failRun(run, 'RENDERER_INVALID', projected.message)
    run.route = generated.value
    run.document = projected.value.document
    run.conceptIdByWireId = projected.value.conceptIdByWireId
    store.savePublished({
      documentId: projected.value.document.id,
      route: generated.value,
      conceptIdByWireId: projected.value.conceptIdByWireId,
    })
    run.status = 'published'
    run.stage = '已发布'
    run.knowledgeCreated = false
    pushConversation(run, { role: 'system_event', kind: 'route_published', content: { routeId: generated.value.routeId, title: generated.value.title } })
    return viewOf(run)
  }

  const afterExploration = async (run: PathRun): Promise<PathRunView> => {
    if (!run.exploration) return failRun(run, 'OUTPUT_INVALID', '探索结果缺失。')
    if (allUndisputed(run.exploration)) return generateRoute(run)
    run.stage = '正在生成选择题'
    startAgent(run, 'r3', '生成选择题')
    const questions = await ports.invokeStructured<R3Output>('R3', {
      goal: run.goal,
      exploration: run.exploration,
      attachments: run.attachments,
    }, agentCall(run, 'r3', { parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } }))
    if (questions.kind === 'failed') return failRun(run, questions.code, questions.message)
    finishAgent(run, 'r3')
    const set: PathQuestionSet = {
      round: 1,
      status: 'active',
      questions: questions.value.questions,
      selectedOptionIds: {},
    }
    run.questionSets = [set]
    run.status = 'awaiting_answers'
    run.stage = '请完成当前题组'
    pushConversation(run, { role: 'assistant', kind: 'question_set', content: set })
    return viewOf(run)
  }

  const resetForR1 = (run: PathRun) => {
    run.status = 'running'
    run.stage = '正在拆成检索问题'
    run.queries = undefined
    run.searchGroups = undefined
    run.exploration = undefined
    run.questionSets = []
    run.route = undefined
    run.document = undefined
    run.followUpMessage = undefined
    run.error = undefined
    run.knowledgeCreated = false
    run.trace = []
    startAgent(run, 'r1', '拆成检索问题')
  }

  const continueFromR1 = async (run: PathRun): Promise<PathRunView> => {
    const split = await ports.invokeStructured<R1Output>('R1', {
      goal: run.goal,
      attachments: run.attachments,
    }, agentCall(run, 'r1', { parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } }))
    if (split.kind === 'failed') return failRun(run, split.code, split.message)
    finishAgent(run, 'r1')
    run.queries = split.value.queries

    run.stage = '正在检索知乎'
    const packs = packZhihuSearchQueries(split.value.queries, ZHIHU_CONCURRENCY)
    const searches = await mapWithConcurrency(packs, ZHIHU_CONCURRENCY, async (pack, index) => {
      const pending = ports.search(pack.query, PATH_SEARCH_COUNT)
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * 200))
      beginStep(run, searchStep(`rs-${pack.queryId}`, pack.query))
      const result = await pending
      finishStep(run, `rs-${pack.queryId}`, { status: result.kind === 'failed' ? 'failed' : 'done' })
      return { pack, result }
    })
    const hits = searches.filter((item) => item.result.kind === 'hits')
    if (hits.length === 0 && searches.some((item) => item.result.kind === 'failed')) {
      return failRun(run, 'PROVIDER_UNAVAILABLE', '知乎检索不可用，不能继续制定这条路线。')
    }
    run.searchGroups = searches.map(({ pack, result }) => ({
      queryId: pack.queryId,
      query: pack.query,
      results: result.kind === 'hits'
        ? result.items.map((item) => ({
          evidenceId: item.evidenceId,
          authorId: item.authorId,
          authorName: item.authorName,
          title: item.title,
          summary: item.summary,
          url: item.url,
        }))
        : [],
    }))
    return continueFromR2(run)
  }

  const continueFromR2 = async (run: PathRun): Promise<PathRunView> => {
    run.stage = '正在整理可能的载体和概念'
    startAgent(run, 'r2', '整理载体和概念')
    const explored = await ports.invokeStructured<R2Output>('R2', {
      goal: run.goal,
      searchGroups: run.searchGroups,
      attachments: run.attachments,
    }, agentCall(run, 'r2', { parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } }))
    if (explored.kind === 'failed') return failRun(run, explored.code, explored.message)
    finishAgent(run, 'r2')
    run.exploration = explored.value
    return afterExploration(run)
  }

  const questionsReadyForR4 = (run: PathRun) => {
    if (!run.exploration) return false
    if (allUndisputed(run.exploration) && run.questionSets.length === 0) return true
    return run.questionSets.some((set) => setComplete(set))
  }

  const resumeAfterFailure = async (run: PathRun): Promise<PathRunView> => {
    run.error = undefined
    run.status = 'running'
    if (questionsReadyForR4(run)) return generateRoute(run)
    if (run.exploration) return afterExploration(run)
    if (run.searchGroups?.length) return continueFromR2(run)
    resetForR1(run)
    return continueFromR1(run)
  }

  const runFromR1 = async (run: PathRun): Promise<PathRunView> => {
    resetForR1(run)
    return continueFromR1(run)
  }

  return {
    view: viewOf,
    get(runId: string): PathRunView | undefined {
      const run = store.get(runId)
      return run ? viewOf(run) : undefined
    },
    getPublishedConcept(routeId: string, conceptId: string) {
      return store.getPublishedConcept(routeId, conceptId)
    },

    async start(input: {
      goal: string
      attachments?: PathAttachment[]
      thinkingDepth?: ThinkingDepth
      wait?: boolean
    }): Promise<PathRunView> {
      const goal = input.goal.trim()
      if (!goal) return emptyFailedView('', '学习目标不能为空。')
      const run: PathRun = {
        runId: randomUUID(),
        goal,
        attachments: input.attachments ?? [],
        thinkingDepth: input.thinkingDepth === 'deep' ? 'deep' : 'fast',
        status: 'running',
        stage: '正在开始',
        trace: [],
        questionSets: [],
        conversation: [{ messageId: 'm-1', role: 'user', kind: 'text', content: goal }],
        knowledgeCreated: false,
      }
      store.save(run)
      if (input.wait === false) {
        resetForR1(run)
        catchBackground(run, continueFromR1(run))
        return viewOf(run)
      }
      return runFromR1(run)
    },

    async retry(runId: string, options?: { wait?: boolean }): Promise<PathRunView> {
      const run = store.get(runId)
      if (!run) return emptyFailedView(runId, '找不到这次路线制定。')
      if (options?.wait === false) {
        const work = resumeAfterFailure(run)
        catchBackground(run, work)
        return viewOf(run)
      }
      return resumeAfterFailure(run)
    },

    async select(input: { runId: string; questionId: string; optionId: string; wait?: boolean }): Promise<PathRunView> {
      const run = store.get(input.runId)
      if (!run) return emptyFailedView(input.runId, '找不到这次路线制定。')
      const reject = (message: string): PathRunView => ({ ...viewOf(run), error: { code: 'PROVIDER_INVALID', message } })
      if (run.status !== 'awaiting_answers') return reject('当前不是作答阶段。')
      const current = activeSet(run)
      if (!current) return reject('没有进行中的题组。')
      const question = current.questions.find((item) => item.id === input.questionId)
      if (!question) return reject('题目不属于当前题组。')
      if (!question.options.some((item) => item.id === input.optionId)) return reject('选项无效。')
      current.selectedOptionIds = { ...current.selectedOptionIds, [input.questionId]: input.optionId }
      const option = question.options.find((item) => item.id === input.optionId)
      if (option && !run.trace.some((step) => step.id === `q-${question.id}`)) {
        run.trace.push(confirmStep(`q-${question.id}`, option.label))
      }
      if (setComplete(current)) {
        if (input.wait === false) {
          run.status = 'running'
          run.stage = '正在生成学习路线'
          startAgent(run, 'r4', '生成学习路线')
          catchBackground(run, generateRoute(run))
          return viewOf(run)
        }
        return generateRoute(run)
      }
      return viewOf(run)
    },

    async commit(runId: string, options?: { wait?: boolean }): Promise<PathRunView> {
      const run = store.get(runId)
      if (!run) return this.retry(runId, options)
      if (run.status === 'published' || run.status === 'failed') return viewOf(run)
      if (run.status !== 'awaiting_answers') {
        return { ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: '当前不是作答阶段。' } }
      }
      const current = activeSet(run)
      if (!current || !setComplete(current)) {
        return { ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: '当前题组还没有全部答完。' } }
      }
      if (options?.wait === false) {
        run.status = 'running'
        run.stage = '正在生成学习路线'
        startAgent(run, 'r4', '生成学习路线')
        catchBackground(run, generateRoute(run))
        return viewOf(run)
      }
      return generateRoute(run)
    },

    async followUp(input: { runId: string; message: string; wait?: boolean }): Promise<PathRunView> {
      const run = store.get(input.runId)
      if (!run) return this.retry(input.runId, { wait: input.wait })
      const message = input.message.trim()
      const reject = (text: string): PathRunView => ({ ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: text } })
      if (!message) return reject('追问不能为空。')
      if (run.status !== 'awaiting_answers') return reject('只有未答完的题组才能追问。')
      const current = activeSet(run)
      if (!current) return reject('没有进行中的题组。')
      const work = async (): Promise<PathRunView> => {
        run.status = 'running'
        run.stage = '正在处理追问'
        startAgent(run, 'r3b', '处理追问')
        const result = await ports.invokeStructured<R3bOutput>('R3b', {
          goal: run.goal,
          followUp: message,
          activeRound: current.round,
          questionSets: run.questionSets,
          attachments: run.attachments,
        }, agentCall(run, 'r3b', {
          parseInput: { attachmentSourceIds: attachmentIds(run.attachments), activeRound: current.round },
        }))
        if (result.kind === 'failed') return failRun(run, result.code, result.message)
        finishAgent(run, 'r3b')
        pushConversation(run, { role: 'user', kind: 'text', content: message })
        if (result.value.kind === 'continue_current') {
          run.followUpMessage = result.value.message
          run.status = 'awaiting_answers'
          run.stage = '请先完成当前题组'
          pushConversation(run, { role: 'assistant', kind: 'text', content: result.value.message })
          return viewOf(run)
        }
        current.status = 'superseded'
        const next: PathQuestionSet = {
          round: result.value.round,
          status: 'active',
          questions: result.value.questions,
          selectedOptionIds: {},
        }
        run.questionSets.push(next)
        run.followUpMessage = result.value.message
        run.status = 'awaiting_answers'
        run.stage = `请完成第 ${next.round} 轮题组`
        pushConversation(run, { role: 'assistant', kind: 'text', content: result.value.message })
        pushConversation(run, { role: 'assistant', kind: 'question_set', content: next })
        return viewOf(run)
      }
      if (input.wait === false) {
        run.status = 'running'
        run.stage = '正在处理追问'
        startAgent(run, 'r3b', '处理追问')
        catchBackground(run, work())
        return viewOf(run)
      }
      return work()
    },

    async reply(input: { runId: string; message: string; wait?: boolean }): Promise<PathRunView> {
      const run = store.get(input.runId)
      if (!run) return this.retry(input.runId, { wait: input.wait })
      const message = input.message.trim()
      if (!message) return failRun(run, 'PROVIDER_INVALID', '消息不能为空。')
      if (run.status !== 'published') {
        return { ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: '路线发布后才能继续普通回复。' } }
      }
      const work = async (): Promise<PathRunView> => {
        run.status = 'running'
        startAgent(run, 'r5', '组织回答')
        const answered = await ports.invokeText('R5', {
          conversation: run.conversation,
          currentMessage: message,
          attachments: run.attachments,
        }, { thinkingDepth: run.thinkingDepth, onReasoning: bindReasoning(run, 'r5-think') })
        if (answered.kind === 'failed') return failRun(run, answered.code, answered.message)
        finishAgent(run, 'r5')
        pushConversation(run, { role: 'user', kind: 'text', content: message })
        pushConversation(run, { role: 'assistant', kind: 'text', content: answered.text })
        run.lastReply = answered.text
        run.status = 'published'
        run.stage = '已发布'
        return viewOf(run, { reply: answered.text })
      }
      if (input.wait === false) {
        run.status = 'running'
        startAgent(run, 'r5', '组织回答')
        catchBackground(run, work())
        return viewOf(run)
      }
      return work()
    },
  }
}

export type PathOrchestrator = ReturnType<typeof createPathOrchestrator>
