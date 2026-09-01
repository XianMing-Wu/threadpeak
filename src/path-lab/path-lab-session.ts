import { createApiClient, type FetchPort, type JsonRequestResult } from '@threadpeak/api-client'
import { createRuntimeStore, type RuntimeStore } from '@threadpeak/runtime-store'
import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import type { ClarificationHistoryItem } from './clarification.ts'
import {
  parseGenerationResponse,
  projectSafeServiceFailure,
  PublicPathLabError,
  type ClarificationAnswer,
  type ClarificationOption,
  type ClarificationPrompt,
  type PathDiagnosticsView,
} from './contracts.ts'

export const PATH_LAB_GENERATE_URL = '/api/paths/generate'
export const PATH_GENERATE_TIMEOUT_MS = 10_000
export const PATH_GENERATE_UNAVAILABLE_MESSAGE = '无法连接本地路径生成服务或等待超时，请确认服务已启动后重试'

export type PathLabRunState = 'idle' | 'clarifying' | 'pending' | 'ready' | 'aborted' | 'error'

export type PathLabView = {
  runState: PathLabRunState
  status: string
  error: string
  document?: LearningPathDocument
  publishedDiagnostics?: PathDiagnosticsView
  attemptDiagnostics?: PathDiagnosticsView
  clarification?: ClarificationPrompt
  clarificationGoal: string
  clarificationAnswers: ClarificationAnswer[]
  clarificationHistory: ClarificationHistoryItem[]
  selectedOptionId?: string
  requestStartedAt?: number
  elapsedMs: number
}

export type PathLabSessionPorts = {
  fetch: FetchPort
  now: () => number
  generateTimeoutMs?: number
}

const idleStatus = '等待输入一个可观察、可验证的学习目标'

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

function unavailableTransportResult(traceId: string): JsonRequestResult {
  return {
    ok: false,
    aborted: true,
    error: {
      code: 'TRANSPORT_FAILED',
      message: PATH_GENERATE_UNAVAILABLE_MESSAGE,
      traceId,
      retryable: true,
    },
  }
}

export function createInitialPathLabView(): PathLabView {
  return {
    runState: 'idle',
    status: idleStatus,
    error: '',
    clarificationGoal: '',
    clarificationAnswers: [],
    clarificationHistory: [],
    elapsedMs: 0,
  }
}

function resetClarificationFields(): Pick<
  PathLabView,
  'clarification' | 'clarificationGoal' | 'clarificationAnswers' | 'clarificationHistory' | 'selectedOptionId'
> {
  return {
    clarification: undefined,
    clarificationGoal: '',
    clarificationAnswers: [],
    clarificationHistory: [],
    selectedOptionId: undefined,
  }
}

export function createPathLabSession(ports: PathLabSessionPorts) {
  const store: RuntimeStore<PathLabView> = createRuntimeStore(createInitialPathLabView())
  const client = createApiClient({ fetch: ports.fetch })
  let requestGeneration = 0
  let controller: AbortController | undefined

  const view = () => store.getSnapshot().view

  const replace = (next: PathLabView) => {
    store.hydrateFromGet(next)
  }

  const patch = (update: Partial<PathLabView>) => {
    replace({ ...view(), ...update })
  }

  const generate = async (
    rawGoal: string,
    answers: readonly ClarificationAnswer[] = [],
    transition?: Readonly<{ prompt: ClarificationPrompt; option: ClarificationOption }>,
  ) => {
    controller?.abort()
    requestGeneration += 1
    const generation = requestGeneration
    const nextController = new AbortController()
    controller = nextController
    const startedAt = ports.now()
    store.setInflight('path-lab', 'loading')
    patch({
      runState: 'pending',
      status: answers.length > 0 ? '选择已确认，正在生成完整路径…' : '正在判断目标是否需要校准…',
      error: '',
      attemptDiagnostics: undefined,
      requestStartedAt: startedAt,
      elapsedMs: 0,
    })

    const timeoutMs = ports.generateTimeoutMs ?? PATH_GENERATE_TIMEOUT_MS
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const requestSignal = AbortSignal.any([nextController.signal, timeoutSignal])
    const traceId = `path-lab-${generation}`
    const request = await Promise.race([
      client.requestJson({
        url: PATH_LAB_GENERATE_URL,
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ raw_goal: rawGoal, clarification_answers: answers }),
        signal: requestSignal,
        traceId,
      }),
      waitForAbort(timeoutSignal).then(() => unavailableTransportResult(traceId)),
    ])

    if (generation !== requestGeneration) return
    if (!request.ok && request.aborted) {
      if (nextController.signal.aborted) return
      store.setInflight('path-lab', 'terminal-error')
      patch({
        runState: 'error',
        status: '本次生成未完成',
        error: PATH_GENERATE_UNAVAILABLE_MESSAGE,
        requestStartedAt: undefined,
      })
      return
    }

    try {
      if (!request.ok) {
        const failure = projectSafeServiceFailure(request.status ?? 0, request.value)
        if (failure.diagnostics) patch({ attemptDiagnostics: failure.diagnostics })
        if (failure.clarification) {
          const current = view()
          const history = transition && failure.clarification.questionId !== transition.prompt.questionId
            ? [
              ...current.clarificationHistory.filter((item) => item.prompt.questionId !== transition.prompt.questionId),
              transition,
            ]
            : current.clarificationHistory
          store.setInflight('path-lab', 'idle')
          patch({
            clarification: failure.clarification,
            clarificationGoal: rawGoal,
            clarificationHistory: history,
            selectedOptionId: answers.find((answer) => answer.question_id === failure.clarification?.questionId)?.option_id,
            elapsedMs: ports.now() - startedAt,
            requestStartedAt: undefined,
            runState: 'clarifying',
            status: `请完成第 ${failure.clarification.step} 题；答完最多 ${failure.clarification.total} 题后立即生成`,
            error: '',
          })
          return
        }
        if (!request.status) {
          throw new PublicPathLabError(PATH_GENERATE_UNAVAILABLE_MESSAGE)
        }
        throw new PublicPathLabError(failure.message)
      }

      const result = parseGenerationResponse(request.value)
      if (generation !== requestGeneration) return
      patch({ attemptDiagnostics: result.diagnostics })
      if (result.diagnostics.passed !== true) {
        const issueSummary = result.diagnostics.qualityIssueCodes.length
          ? `：${result.diagnostics.qualityIssueLabels.slice(0, 3).join('、')}`
          : result.diagnostics.qualityIssueCount
            ? `（${result.diagnostics.qualityIssueCount} 项问题）`
            : ''
        throw new PublicPathLabError(`质量门禁未通过${issueSummary}；未发布新路径，上一版路径已保留`)
      }

      store.setInflight('path-lab', 'ready')
      replace({
        ...view(),
        document: result.rendererDocument,
        publishedDiagnostics: result.diagnostics,
        attemptDiagnostics: undefined,
        elapsedMs: ports.now() - startedAt,
        requestStartedAt: undefined,
        runState: 'ready',
        status: `路径已生成：${result.rendererDocument.structure.subjects.length} 个载体，${result.rendererDocument.structure.concepts.length} 个最终概念`,
        error: '',
        ...resetClarificationFields(),
      })
    } catch (cause: unknown) {
      if (generation !== requestGeneration) return
      store.setInflight('path-lab', 'terminal-error')
      patch({
        runState: 'error',
        status: '本次生成未完成',
        error: cause instanceof PublicPathLabError ? cause.message : PATH_GENERATE_UNAVAILABLE_MESSAGE,
        requestStartedAt: undefined,
      })
    } finally {
      if (generation === requestGeneration) controller = undefined
    }
  }

  return {
    store,
    generate,
    abort() {
      if (!controller) return
      controller.abort()
      controller = undefined
      store.setInflight('path-lab', 'cancelled')
      patch({
        runState: 'aborted',
        status: '已停止本次生成；目标草稿仍保留，可修改后重试',
        requestStartedAt: undefined,
      })
    },
    changeGoal(value: string) {
      const current = view()
      if (current.clarification && value.trim() !== current.clarificationGoal) {
        patch({
          ...resetClarificationFields(),
          runState: current.document ? 'ready' : 'idle',
          status: current.document ? '当前路径仍可浏览；修改目标后可生成新版本' : '等待生成新的学习目标',
          error: '',
        })
      }
    },
    submitNewGoal(rawGoal: string) {
      patch(resetClarificationFields())
      void generate(rawGoal)
    },
    selectOption(optionId: string) {
      patch({ selectedOptionId: optionId })
    },
    continueClarification(fallbackGoal: string) {
      const current = view()
      if (!current.clarification || !current.selectedOptionId || current.runState === 'pending') return
      const option = current.clarification.options.find((item) => item.id === current.selectedOptionId)
      if (!option) return
      const nextAnswers = [
        ...current.clarificationAnswers.filter((answer) => answer.question_id !== current.clarification?.questionId),
        { question_id: current.clarification.questionId, option_id: option.id },
      ]
      patch({ clarificationAnswers: nextAnswers })
      void generate(current.clarificationGoal || fallbackGoal, nextAnswers, {
        prompt: current.clarification,
        option,
      })
    },
    backClarification() {
      const current = view()
      const prior = current.clarificationHistory.at(-1)
      if (!prior || current.runState === 'pending') return
      const remaining = current.clarificationHistory.slice(0, -1)
      patch({
        clarificationHistory: remaining,
        clarificationAnswers: remaining.map((item) => ({
          question_id: item.prompt.questionId,
          option_id: item.option.id,
        })),
        clarification: prior.prompt,
        selectedOptionId: prior.option.id,
        runState: 'clarifying',
        status: `返回第 ${prior.prompt.step} 题，可重新选择后继续`,
        error: '',
      })
    },
    restartClarification() {
      const current = view()
      patch({
        ...resetClarificationFields(),
        runState: current.document ? 'ready' : 'idle',
        status: '请修改目标；原草稿已保留',
        error: '',
      })
    },
    tickElapsed() {
      const current = view()
      if (current.runState !== 'pending' || current.requestStartedAt === undefined) return
      patch({ elapsedMs: ports.now() - current.requestStartedAt })
    },
    teardown() {
      controller?.abort()
      controller = undefined
      store.teardown()
    },
  }
}

export type PathLabSession = ReturnType<typeof createPathLabSession>
