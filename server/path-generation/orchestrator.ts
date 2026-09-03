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
import { projectRouteToDocument } from './project-document.ts'
import type { LearningPathDocument } from '../../src/vendor/learning-path-3d/index.js'

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
  queries?: R1Output['queries']
  searchGroups?: SearchGroup[]
  exploration?: R2Output
  questionSets: PathQuestionSet[]
  route?: R4Output
  document?: LearningPathDocument
  conceptIdByWireId?: Record<string, string>
  conversation: ConversationTurn[]
  followUpMessage?: string
  error?: { code: string; message: string }
  knowledgeCreated: false
}

export type PathRunView = {
  runId: string
  goal: string
  status: PathRun['status']
  stage: string
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
  options?: { thinkingDepth?: ThinkingDepth; parseInput?: { attachmentSourceIds?: readonly string[]; activeRound?: number } },
) => Promise<StructuredInvokeResult<T>>

export type PathInvokeText = (
  agentId: 'R5',
  context: unknown,
  options?: { thinkingDepth?: ThinkingDepth },
) => Promise<TextInvokeResult>

export type PathSearch = (query: string, count: number) => Promise<ZhihuSearchResult>

const SEARCH_COUNT = 5

function viewOf(run: PathRun, extra?: { reply?: string }): PathRunView {
  return {
    runId: run.runId,
    goal: run.goal,
    status: run.status,
    stage: run.stage,
    questionSets: run.questionSets,
    knowledgeCreated: false,
    ...(run.followUpMessage ? { followUpMessage: run.followUpMessage } : {}),
    ...(run.route ? { route: run.route } : {}),
    ...(run.document ? { document: run.document } : {}),
    ...(run.error ? { error: run.error } : {}),
    ...(extra?.reply ? { reply: extra.reply } : {}),
  }
}

function failRun(run: PathRun, code: string, message: string): PathRunView {
  run.status = 'failed'
  run.stage = 'failed'
  run.error = { code, message }
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

export function createPathRunStore() {
  const runs = new Map<string, PathRun>()
  return {
    get(runId: string): PathRun | undefined {
      return runs.get(runId)
    },
    save(run: PathRun) {
      runs.set(run.runId, run)
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

  const generateRoute = async (run: PathRun): Promise<PathRunView> => {
    run.status = 'running'
    run.stage = '正在生成学习路线'
    const r4Input = {
      exploration: run.exploration,
      questionSets: r4QuestionContext(run),
      newerRoundPreferred: true,
      attachments: run.attachments,
    }
    const r4Options = {
      thinkingDepth: run.thinkingDepth,
      parseInput: { attachmentSourceIds: attachmentIds(run.attachments) },
    }
    let generated = await ports.invokeStructured<R4Output>('R4', r4Input, r4Options)
    if (generated.kind === 'failed') {
      generated = await ports.invokeStructured<R4Output>('R4', r4Input, r4Options)
    }
    if (generated.kind === 'failed') return failRun(run, generated.code, generated.message)
    let projected = projectRouteToDocument(generated.value)
    if (!projected.ok) {
      generated = await ports.invokeStructured<R4Output>('R4', r4Input, r4Options)
      if (generated.kind === 'failed') return failRun(run, generated.code, generated.message)
      projected = projectRouteToDocument(generated.value)
    }
    if (!projected.ok) return failRun(run, 'RENDERER_INVALID', projected.message)
    run.route = generated.value
    run.document = projected.value.document
    run.conceptIdByWireId = projected.value.conceptIdByWireId
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
    const questions = await ports.invokeStructured<R3Output>('R3', {
      exploration: run.exploration,
      attachments: run.attachments,
    }, { thinkingDepth: run.thinkingDepth, parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } })
    if (questions.kind === 'failed') return failRun(run, questions.code, questions.message)
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

  const runFromR1 = async (run: PathRun): Promise<PathRunView> => {
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

    const split = await ports.invokeStructured<R1Output>('R1', {
      goal: run.goal,
      attachments: run.attachments,
    }, { thinkingDepth: run.thinkingDepth, parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } })
    if (split.kind === 'failed') return failRun(run, split.code, split.message)
    run.queries = split.value.queries

    run.stage = '正在并联检索知乎'
    const searchOnce = (query: string) => ports.search(query, SEARCH_COUNT)
    const searches = await Promise.all(split.value.queries.map(async (query) => {
      let result = await searchOnce(query.text)
      if (result.kind === 'failed') {
        await new Promise((resolve) => setTimeout(resolve, 400))
        result = await searchOnce(query.text)
      }
      return { query, result }
    }))
    const hits = searches.filter((item) => item.result.kind === 'hits')
    if (hits.length === 0 && searches.some((item) => item.result.kind === 'failed')) {
      return failRun(run, 'PROVIDER_UNAVAILABLE', '知乎检索不可用，不能继续制定这条路线。')
    }
    run.searchGroups = searches.map(({ query, result }) => ({
      queryId: query.id,
      query: query.text,
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

    run.stage = '正在整理可能的载体和概念'
    const explored = await ports.invokeStructured<R2Output>('R2', {
      goal: run.goal,
      searchGroups: run.searchGroups,
      attachments: run.attachments,
    }, { thinkingDepth: run.thinkingDepth, parseInput: { attachmentSourceIds: attachmentIds(run.attachments) } })
    if (explored.kind === 'failed') return failRun(run, explored.code, explored.message)
    run.exploration = explored.value
    return afterExploration(run)
  }

  return {
    view: viewOf,
    get(runId: string): PathRunView | undefined {
      const run = store.get(runId)
      return run ? viewOf(run) : undefined
    },

    async start(input: {
      goal: string
      attachments?: PathAttachment[]
      thinkingDepth?: ThinkingDepth
    }): Promise<PathRunView> {
      const goal = input.goal.trim()
      if (!goal) {
        return {
          runId: '',
          goal: '',
          status: 'failed',
          stage: 'failed',
          questionSets: [],
          knowledgeCreated: false,
          error: { code: 'PROVIDER_INVALID', message: '学习目标不能为空。' },
        }
      }
      const run: PathRun = {
        runId: randomUUID(),
        goal,
        attachments: input.attachments ?? [],
        thinkingDepth: input.thinkingDepth === 'deep' ? 'deep' : 'fast',
        status: 'running',
        stage: '正在开始',
        questionSets: [],
        conversation: [{ messageId: 'm-1', role: 'user', kind: 'text', content: goal }],
        knowledgeCreated: false,
      }
      store.save(run)
      return runFromR1(run)
    },

    async retry(runId: string): Promise<PathRunView> {
      const run = store.get(runId)
      if (!run) {
        return {
          runId,
          goal: '',
          status: 'failed',
          stage: 'failed',
          questionSets: [],
          knowledgeCreated: false,
          error: { code: 'PROVIDER_INVALID', message: '找不到这次路线制定。' },
        }
      }
      return runFromR1(run)
    },

    async select(input: { runId: string; questionId: string; optionId: string }): Promise<PathRunView> {
      const run = store.get(input.runId)
      if (!run) {
        return {
          runId: input.runId,
          goal: '',
          status: 'failed',
          stage: 'failed',
          questionSets: [],
          knowledgeCreated: false,
          error: { code: 'PROVIDER_INVALID', message: '找不到这次路线制定。' },
        }
      }
      const reject = (message: string): PathRunView => ({ ...viewOf(run), error: { code: 'PROVIDER_INVALID', message } })
      if (run.status !== 'awaiting_answers') return reject('当前不是作答阶段。')
      const current = activeSet(run)
      if (!current) return reject('没有进行中的题组。')
      const question = current.questions.find((item) => item.id === input.questionId)
      if (!question) return reject('题目不属于当前题组。')
      if (!question.options.some((item) => item.id === input.optionId)) return reject('选项无效。')
      current.selectedOptionIds = { ...current.selectedOptionIds, [input.questionId]: input.optionId }
      return viewOf(run)
    },

    async commit(runId: string): Promise<PathRunView> {
      const run = store.get(runId)
      if (!run) return this.retry(runId)
      if (run.status !== 'awaiting_answers') {
        return { ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: '当前不是作答阶段。' } }
      }
      const current = activeSet(run)
      if (!current || !setComplete(current)) {
        return { ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: '当前题组还没有全部答完。' } }
      }
      return generateRoute(run)
    },

    async followUp(input: { runId: string; message: string }): Promise<PathRunView> {
      const run = store.get(input.runId)
      if (!run) return this.retry(input.runId)
      const message = input.message.trim()
      const reject = (text: string): PathRunView => ({ ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: text } })
      if (!message) return reject('追问不能为空。')
      if (run.status !== 'awaiting_answers') return reject('只有未答完的题组才能追问。')
      const current = activeSet(run)
      if (!current) return reject('没有进行中的题组。')
      run.stage = '正在处理追问'
      const result = await ports.invokeStructured<R3bOutput>('R3b', {
        followUp: message,
        activeRound: current.round,
        questionSets: run.questionSets,
        attachments: run.attachments,
      }, {
        thinkingDepth: run.thinkingDepth,
        parseInput: { attachmentSourceIds: attachmentIds(run.attachments), activeRound: current.round },
      })
      if (result.kind === 'failed') return failRun(run, result.code, result.message)
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
    },

    async reply(input: { runId: string; message: string }): Promise<PathRunView> {
      const run = store.get(input.runId)
      if (!run) return this.retry(input.runId)
      const message = input.message.trim()
      if (!message) return failRun(run, 'PROVIDER_INVALID', '消息不能为空。')
      if (run.status !== 'published') {
        return { ...viewOf(run), error: { code: 'PROVIDER_INVALID', message: '路线发布后才能继续普通回复。' } }
      }
      const answered = await ports.invokeText('R5', {
        conversation: run.conversation,
        currentMessage: message,
        attachments: run.attachments,
      }, { thinkingDepth: run.thinkingDepth })
      if (answered.kind === 'failed') return failRun(run, answered.code, answered.message)
      pushConversation(run, { role: 'user', kind: 'text', content: message })
      pushConversation(run, { role: 'assistant', kind: 'text', content: answered.text })
      run.stage = '已发布'
      return viewOf(run, { reply: answered.text })
    },
  }
}

export type PathOrchestrator = ReturnType<typeof createPathOrchestrator>
