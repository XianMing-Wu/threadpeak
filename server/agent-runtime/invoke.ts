import { AGENT_CHANNELS, DEFAULT_LIMITS, DEFAULT_MAX_OUTPUT_TOKENS, JSON_AGENT_IDS } from './constants.ts'
import { createLlmSummarizer } from './summarizer.ts'
import { prepareAgentCall } from './prepare.ts'
import {
  PUBLIC_STRUCTURE_FAILURE_MESSAGE,
  STRUCTURE_SELF_REPAIR_LIMIT,
  appendStructureRepairTurn,
} from './repair.ts'
import { parseAgentJson, parseAgentOutput, type ParseAgentOutputInput } from './schemas.ts'
import type {
  AgentFailure,
  AgentId,
  ChatMessage,
  L0aAngle,
  LlmCompleteResult,
  LlmProvider,
  RuntimeLimits,
  StructuredAgentId,
  StructuredInvokeResult,
  Summarizer,
  TextAgentId,
  TextInvokeResult,
  ThinkingDepth,
  ZhihuDirectResult,
  ZhihuProvider,
} from './types.ts'

export type InvokePorts = {
  llm: LlmProvider
  zhihu: ZhihuProvider
  summarizer?: Summarizer
}

export type InvokeOptions = {
  thinkingDepth?: ThinkingDepth
  limits?: RuntimeLimits
  signal?: AbortSignal
  parseInput?: ParseAgentOutputInput
  angle?: L0aAngle
  onReasoning?: (text: string) => void
  onText?: (text: string) => void
  repairLimit?: number
}

function fail(agentId: AgentId, code: AgentFailure['code'], message: string): AgentFailure {
  return { kind: 'failed', code, message, agentId }
}

async function runPrepared(ports: InvokePorts, input: {
  agentId: AgentId
  context: unknown
  options: InvokeOptions
}) {
  const summarizer = ports.summarizer ?? createLlmSummarizer({llm:ports.llm,thinkingDepth:input.options.thinkingDepth})
  return prepareAgentCall({
    agentId: input.agentId,
    context: input.context,
    angle: input.options.angle,
    limits: input.options.limits,
    summarizer,
  })
}

async function completeChannel(input: {
  ports: InvokePorts
  agentId: AgentId
  messages: readonly ChatMessage[]
  thinkingDepth: ThinkingDepth
  signal?: AbortSignal
  onReasoning?: (text: string) => void
  onText?: (text: string) => void
}): Promise<LlmCompleteResult | ZhihuDirectResult> {
  const channel = AGENT_CHANNELS[input.agentId]
  if (channel === 'zhihu_direct') {
    return input.ports.zhihu.direct({
      messages: input.messages,
      thinkingDepth: input.thinkingDepth,
      signal: input.signal,
    })
  }
  return input.ports.llm.complete({
    messages: input.messages,
    json: JSON_AGENT_IDS.has(input.agentId),
    thinkingDepth: input.thinkingDepth,
    maxTokens: DEFAULT_MAX_OUTPUT_TOKENS[input.agentId]+(input.thinkingDepth==='deep'?8192:0),
    signal: input.signal,
    onReasoning: input.onReasoning,
    onText: input.onText,
  })
}

export async function invokeStructuredAgent<T>(
  ports: InvokePorts,
  agentId: StructuredAgentId,
  context: unknown,
  options: InvokeOptions = {},
): Promise<StructuredInvokeResult<T>> {
  if (AGENT_CHANNELS[agentId] !== 'llm') {
    return fail(agentId, 'PROVIDER_INVALID', '该 Agent 不是结构化 LLM 调用。')
  }
  const thinkingDepth = options.thinkingDepth ?? 'fast'
  const prepared = await runPrepared(ports, { agentId, context, options })
  const budget = options.limits?.totalTokens ?? DEFAULT_LIMITS.totalTokens
  const repairLimit = options.repairLimit ?? STRUCTURE_SELF_REPAIR_LIMIT
  let lastText = ''
  let lastReason = ''

  for (let attempt = 0; attempt <= repairLimit; attempt++) {
    const messages = attempt === 0
      ? prepared.messages
      : appendStructureRepairTurn(prepared.messages, lastText, lastReason, agentId, budget)
    const completed = await completeChannel({
      ports,
      agentId,
      messages,
      thinkingDepth,
      signal: options.signal,
      onReasoning: attempt === 0 ? options.onReasoning : undefined,
      onText: options.onText,
    })
    if (completed.kind === 'failed') {
      return fail(agentId, 'PROVIDER_UNAVAILABLE', completed.message)
    }
    lastText = completed.text
    const parsedJson = parseAgentJson(completed.text)
    if (!parsedJson.ok) {
      lastReason = parsedJson.message
      continue
    }
    const parsed = parseAgentOutput(agentId, parsedJson.value, options.parseInput)
    if (!parsed.ok) {
      lastReason = parsed.message
      continue
    }
    return {
      kind: 'completed',
      agentId,
      value: parsed.value as T,
      compressed: prepared.compressed,
    }
  }
  return fail(agentId, 'OUTPUT_INVALID', PUBLIC_STRUCTURE_FAILURE_MESSAGE)
}

export async function invokeTextAgent(
  ports: InvokePorts,
  agentId: TextAgentId,
  context: unknown,
  options: InvokeOptions = {},
): Promise<TextInvokeResult> {
  const thinkingDepth = options.thinkingDepth ?? 'fast'
  const prepared = await runPrepared(ports, { agentId, context, options })
  const budget = options.limits?.totalTokens ?? DEFAULT_LIMITS.totalTokens
  let lastText = ''
  let lastReason = ''

  for (let attempt = 0; attempt <= STRUCTURE_SELF_REPAIR_LIMIT; attempt++) {
    const messages = attempt === 0
      ? prepared.messages
      : appendStructureRepairTurn(prepared.messages, lastText, lastReason, agentId, budget)
    const completed = await completeChannel({
      ports,
      agentId,
      messages,
      thinkingDepth,
      signal: options.signal,
      onReasoning: options.onReasoning,
      onText: options.onText,
    })
    if (completed.kind === 'failed') {
      return fail(agentId, 'PROVIDER_UNAVAILABLE', completed.message)
    }
    lastText = completed.text
    const parsed = parseAgentOutput(agentId, completed.text, options.parseInput, options.angle)
    if (!parsed.ok) {
      lastReason = parsed.message
      continue
    }
    return {
      kind: 'completed',
      agentId,
      text: String(parsed.value),
      compressed: prepared.compressed,
    }
  }
  return fail(agentId, 'OUTPUT_INVALID', PUBLIC_STRUCTURE_FAILURE_MESSAGE)
}
