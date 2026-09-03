import { AGENT_CHANNELS, DEFAULT_MAX_OUTPUT_TOKENS, JSON_AGENT_IDS } from './constants.ts'
import { createStubSummarizer } from './compress.ts'
import { prepareAgentCall } from './prepare.ts'
import { parseAgentJson, parseAgentOutput, type ParseAgentOutputInput } from './schemas.ts'
import type {
  AgentFailure,
  AgentId,
  L0aAngle,
  LlmProvider,
  RuntimeLimits,
  StructuredAgentId,
  StructuredInvokeResult,
  Summarizer,
  TextAgentId,
  TextInvokeResult,
  ThinkingDepth,
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
}

function fail(agentId: AgentId, code: AgentFailure['code'], message: string): AgentFailure {
  return { kind: 'failed', code, message, agentId }
}

async function runPrepared(ports: InvokePorts, input: {
  agentId: AgentId
  context: unknown
  options: InvokeOptions
}) {
  const summarizer = ports.summarizer ?? createStubSummarizer()
  return prepareAgentCall({
    agentId: input.agentId,
    context: input.context,
    angle: input.options.angle,
    limits: input.options.limits,
    summarizer,
  })
}

export async function invokeStructuredAgent<T>(
  ports: InvokePorts,
  agentId: StructuredAgentId,
  context: unknown,
  options: InvokeOptions = {},
): Promise<StructuredInvokeResult<T>> {
  const thinkingDepth = options.thinkingDepth ?? 'fast'
  const prepared = await runPrepared(ports, { agentId, context, options })
  const channel = AGENT_CHANNELS[agentId]
  if (channel !== 'llm') {
    return fail(agentId, 'PROVIDER_INVALID', '该 Agent 不是结构化 LLM 调用。')
  }
  const completed = await ports.llm.complete({
    messages: prepared.messages,
    json: JSON_AGENT_IDS.has(agentId),
    thinkingDepth,
    maxTokens: DEFAULT_MAX_OUTPUT_TOKENS[agentId],
    signal: options.signal,
  })
  if (completed.kind === 'failed') {
    return fail(agentId, 'PROVIDER_UNAVAILABLE', completed.message)
  }
  const parsedJson = parseAgentJson(completed.text)
  if (!parsedJson.ok) return fail(agentId, 'OUTPUT_INVALID', parsedJson.message)
  const parsed = parseAgentOutput(agentId, parsedJson.value, options.parseInput)
  if (!parsed.ok) return fail(agentId, 'OUTPUT_INVALID', parsed.message)
  return {
    kind: 'completed',
    agentId,
    value: parsed.value as T,
    compressed: prepared.compressed,
  }
}

export async function invokeTextAgent(
  ports: InvokePorts,
  agentId: TextAgentId,
  context: unknown,
  options: InvokeOptions = {},
): Promise<TextInvokeResult> {
  const thinkingDepth = options.thinkingDepth ?? 'fast'
  const prepared = await runPrepared(ports, { agentId, context, options })
  const channel = AGENT_CHANNELS[agentId]
  const completed = channel === 'zhihu_direct'
    ? await ports.zhihu.direct({
      messages: prepared.messages,
      thinkingDepth,
      signal: options.signal,
    })
    : await ports.llm.complete({
      messages: prepared.messages,
      json: false,
      thinkingDepth,
      maxTokens: DEFAULT_MAX_OUTPUT_TOKENS[agentId],
      signal: options.signal,
    })
  if (completed.kind === 'failed') {
    return fail(agentId, 'PROVIDER_UNAVAILABLE', completed.message)
  }
  const parsed = parseAgentOutput(agentId, completed.text, options.parseInput, options.angle)
  if (!parsed.ok) return fail(agentId, 'OUTPUT_INVALID', parsed.message)
  return {
    kind: 'completed',
    agentId,
    text: String(parsed.value),
    compressed: prepared.compressed,
  }
}
