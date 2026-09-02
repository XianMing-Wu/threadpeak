import { createApiClient } from '@threadpeak/api-client'
import { createRuntimeStore, type RuntimeStore } from '@threadpeak/runtime-store'
import { isLearningPathRendererDocument } from '../path-3d/validate-renderer-document.ts'
import type { ClarificationOption, ClarificationPrompt } from '../path-lab/contracts.ts'
import {
  createInitialPathLabView,
  PATH_GENERATE_UNAVAILABLE_MESSAGE,
  type PathLabSessionPorts,
  type PathLabView,
} from '../path-lab/path-lab-session.ts'

export const PATH_STREAM_URL = '/api/paths/generate/stream'
export const PATH_STREAM_TIMEOUT_MS = 55_000

type StreamSessionState = {
  sessionId: string
  revision: number | null
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asClarification(raw: unknown): ClarificationPrompt | undefined {
  const question = asRecord(raw)
  if (!question) return undefined
  const id = typeof question.id === 'string' ? question.id : ''
  const prompt = typeof question.prompt === 'string' ? question.prompt : ''
  const order = typeof question.order === 'number' ? question.order : 0
  const options = Array.isArray(question.options)
    ? question.options.flatMap((item): ClarificationOption[] => {
      const option = asRecord(item)
      const optionId = typeof option?.id === 'string' ? option.id : ''
      const label = typeof option?.label === 'string' ? option.label : ''
      const instruction = typeof option?.description === 'string' && option.description.trim()
        ? option.description
        : label
      return optionId && label ? [{ id: optionId, label, instruction }] : []
    })
    : []
  if (!id || !prompt || order < 1 || options.length < 2) return undefined
  return {
    questionId: id,
    question: prompt,
    step: order,
    total: 3,
    options,
  }
}

export function createPathStreamSession(ports: PathLabSessionPorts) {
  const store: RuntimeStore<PathLabView> = createRuntimeStore(createInitialPathLabView())
  const client = createApiClient({ fetch: ports.fetch })
  let requestGeneration = 0
  let controller: AbortController | undefined
  let streamState: StreamSessionState | undefined

  const view = () => store.getSnapshot().view
  const replace = (next: PathLabView) => {
    store.hydrateFromGet(next)
  }
  const patch = (update: Partial<PathLabView>) => {
    replace({ ...view(), ...update })
  }

  const run = async (body: Record<string, unknown>) => {
    controller?.abort()
    requestGeneration += 1
    const generation = requestGeneration
    const nextController = new AbortController()
    controller = nextController
    const startedAt = ports.now()
    store.setInflight('path-stream', 'loading')
    patch({
      runState: 'pending',
      status: body.kind === 'answer' || body.kind === 'reviseAnswer'
        ? '选择已确认，正在继续生成路径…'
        : '正在检索公开证据并生成学习路线…',
      error: '',
      requestStartedAt: startedAt,
      elapsedMs: 0,
    })

    const timeoutMs = ports.generateTimeoutMs ?? PATH_STREAM_TIMEOUT_MS
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const requestSignal = AbortSignal.any([nextController.signal, timeoutSignal])
    const traceId = `path-stream-${generation}`

    const consume = async () => {
      for await (const decoded of client.postNdjson({
        url: PATH_STREAM_URL,
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
        body: JSON.stringify(body),
        signal: requestSignal,
        traceId,
      })) {
        if (generation !== requestGeneration) return
        if (!decoded.ok) {
          if (nextController.signal.aborted) return
          if (timeoutSignal.aborted) {
            store.setInflight('path-stream', 'terminal-error')
            patch({
              runState: 'error',
              status: '本次生成未完成',
              error: PATH_GENERATE_UNAVAILABLE_MESSAGE,
              requestStartedAt: undefined,
            })
            return
          }
          store.setInflight('path-stream', 'terminal-error')
          patch({
            runState: 'error',
            status: '本次生成未完成',
            error: decoded.error.code === 'TRANSPORT_FAILED'
              ? PATH_GENERATE_UNAVAILABLE_MESSAGE
              : (decoded.error.message || PATH_GENERATE_UNAVAILABLE_MESSAGE),
            requestStartedAt: undefined,
          })
          return
        }
        const raw = decoded.value.raw
        const type = typeof raw.type === 'string' ? raw.type : ''
        const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId : streamState?.sessionId
        const revision = typeof raw.revision === 'number' ? raw.revision : streamState?.revision ?? null
        if (sessionId) streamState = { sessionId, revision }
        if (type === 'stage.started' || type === 'stage.completed') {
          const stage = typeof raw.stage === 'string' ? raw.stage : ''
          patch({
            status: stage ? `正在执行 ${stage}` : view().status,
            elapsedMs: ports.now() - startedAt,
          })
          continue
        }
        if (type === 'choice.ready' || type === 'choice.reminder') {
          const clarification = asClarification(raw.question)
          if (!clarification) {
            store.setInflight('path-stream', 'terminal-error')
            patch({
              runState: 'error',
              status: '本次生成未完成',
              error: '路径澄清题无法校验，不能继续。',
              requestStartedAt: undefined,
            })
            return
          }
          store.setInflight('path-stream', 'idle')
          patch({
            runState: 'clarifying',
            clarification,
            selectedOptionId: undefined,
            status: `请完成第 ${clarification.step} 题；答完最多 ${clarification.total} 题后立即生成`,
            error: '',
            elapsedMs: ports.now() - startedAt,
            requestStartedAt: undefined,
          })
          return
        }
        if (type === 'path.ready') {
          if (!isLearningPathRendererDocument(raw.document)) {
            store.setInflight('path-stream', 'terminal-error')
            patch({
              runState: 'error',
              status: '本次生成未完成',
              error: '路径文档未通过 renderer 校验，不能发布这条路线。',
              requestStartedAt: undefined,
            })
            return
          }
          store.setInflight('path-stream', 'ready')
          replace({
            ...view(),
            document: raw.document,
            elapsedMs: ports.now() - startedAt,
            requestStartedAt: undefined,
            runState: 'ready',
            status: `路径已生成：${raw.document.structure.subjects.length} 个载体，${raw.document.structure.concepts.length} 个最终概念`,
            error: '',
            clarification: undefined,
            clarificationGoal: '',
            clarificationAnswers: [],
            clarificationHistory: [],
            selectedOptionId: undefined,
          })
          return
        }
        if (type === 'request.failed') {
          const message = typeof raw.message === 'string' && raw.message.trim()
            ? raw.message.trim()
            : PATH_GENERATE_UNAVAILABLE_MESSAGE
          store.setInflight('path-stream', 'terminal-error')
          patch({
            runState: 'error',
            status: '本次生成未完成',
            error: message,
            requestStartedAt: undefined,
          })
          return
        }
      }
      if (generation !== requestGeneration || nextController.signal.aborted) return
      if (view().runState === 'pending') {
        store.setInflight('path-stream', 'terminal-error')
        patch({
          runState: 'error',
          status: '本次生成未完成',
          error: PATH_GENERATE_UNAVAILABLE_MESSAGE,
          requestStartedAt: undefined,
        })
      }
    }

    await Promise.race([
      consume(),
      waitForAbort(timeoutSignal).then(() => {
        if (generation !== requestGeneration || view().runState !== 'pending') return
        store.setInflight('path-stream', 'terminal-error')
        patch({
          runState: 'error',
          status: '本次生成未完成',
          error: PATH_GENERATE_UNAVAILABLE_MESSAGE,
          requestStartedAt: undefined,
        })
      }),
    ])
    if (generation === requestGeneration) controller = undefined
  }

  return {
    store,
    abort() {
      if (!controller) return
      controller.abort()
      controller = undefined
      store.setInflight('path-stream', 'cancelled')
      patch({
        runState: 'aborted',
        status: '已停止本次生成；目标草稿仍保留，可修改后重试',
        requestStartedAt: undefined,
      })
    },
    submitNewGoal(rawGoal: string) {
      const sessionId = crypto.randomUUID()
      streamState = { sessionId, revision: null }
      patch({
        clarification: undefined,
        clarificationGoal: rawGoal,
        clarificationAnswers: [],
        clarificationHistory: [],
        selectedOptionId: undefined,
      })
      void run({
        kind: 'start',
        requestId: crypto.randomUUID(),
        sessionId,
        goal: rawGoal,
      })
    },
    selectOption(optionId: string) {
      patch({ selectedOptionId: optionId })
    },
    teardown() {
      controller?.abort()
      controller = undefined
      store.teardown()
    },
    continueClarification(fallbackGoal: string) {
      const current = view()
      if (!current.clarification || !current.selectedOptionId || current.runState === 'pending') return
      const option = current.clarification.options.find((item) => item.id === current.selectedOptionId)
      if (!option || !streamState?.sessionId || streamState.revision === null) return
      const nextAnswers = [
        ...current.clarificationAnswers.filter((answer) => answer.question_id !== current.clarification?.questionId),
        { question_id: current.clarification.questionId, option_id: option.id },
      ]
      patch({
        clarificationAnswers: nextAnswers,
        clarificationHistory: [
          ...current.clarificationHistory.filter((item) => item.prompt.questionId !== current.clarification?.questionId),
          { prompt: current.clarification, option },
        ],
        clarificationGoal: current.clarificationGoal || fallbackGoal,
      })
      void run({
        kind: 'answer',
        requestId: crypto.randomUUID(),
        sessionId: streamState.sessionId,
        expectedRevision: streamState.revision,
        questionId: current.clarification.questionId,
        optionId: option.id,
      })
    },
  }
}

export type PathStreamSession = ReturnType<typeof createPathStreamSession>
