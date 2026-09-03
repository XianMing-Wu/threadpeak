import { DEFAULT_LIMITS, JSON_AGENT_IDS, SHARED_SYSTEM_PREFIX } from './constants.ts'
import {
  attachmentContentTokens,
  cloneContext,
  compressAttachmentsOnce,
  compressNonAttachment,
  protectedSourceIds,
} from './compress.ts'
import { OUTPUT_STRUCTURE_TEXT, systemPromptFor } from './prompts.ts'
import { estimateCall, estimateTokens } from './tokens.ts'
import type {
  AgentId,
  ChatMessage,
  L0aAngle,
  PreparedCall,
  RuntimeLimits,
  Summarizer,
  TokenEstimator,
} from './types.ts'

export type PrepareInput = {
  agentId: AgentId
  context: unknown
  angle?: L0aAngle
  limits?: RuntimeLimits
  summarizer: Summarizer
  estimator?: TokenEstimator
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value)
}

export function assembleMessages(agentId: AgentId, context: unknown, angle?: L0aAngle): ChatMessage[] {
  const taskPrompt = systemPromptFor(agentId, angle)
  const output = OUTPUT_STRUCTURE_TEXT[agentId]
  const system = [
    SHARED_SYSTEM_PREFIX,
    taskPrompt,
    JSON_AGENT_IDS.has(agentId) ? `输出结构：\n${output}` : output,
  ].join('\n\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: stableStringify(context) },
  ]
}

function currentMessageIds(context: unknown): string[] {
  if (!context || typeof context !== 'object') return []
  const root = context as Record<string, unknown>
  const ids: string[] = []
  if (typeof root.currentMessage === 'string') ids.push('current-message')
  return ids
}

export async function prepareAgentCall(input: PrepareInput): Promise<PreparedCall> {
  const limits = input.limits ?? DEFAULT_LIMITS
  const estimator = input.estimator ?? estimateTokens
  const context = cloneContext(input.context)
  let compressed = false
  let messages = assembleMessages(input.agentId, context, input.angle)
  let estimated = estimateCall(messages, input.agentId, limits.totalTokens, estimator)

  if (estimated < limits.totalTokens) {
    return {
      agentId: input.agentId,
      messages,
      context,
      compressed: false,
      estimatedTokens: estimated,
      originalUnchanged: true,
    }
  }

  const initialAttachmentTokens = attachmentContentTokens(context, estimator)
  const initialNonAttachment = Math.max(0, estimated - initialAttachmentTokens)
  const compressAttachmentsFirst = initialNonAttachment < limits.attachmentBranchTokens
  let didAttachments = false
  const protect = [...protectedSourceIds(input.agentId, context), ...currentMessageIds(context)]

  for (let step = 0; step < 24; step += 1) {
    messages = assembleMessages(input.agentId, context, input.angle)
    estimated = estimateCall(messages, input.agentId, limits.totalTokens, estimator)
    if (estimated < limits.totalTokens) break

    const overhead = estimated - estimator(messages[1]?.content ?? '')
    const contextTarget = Math.max(32, limits.totalTokens - overhead - 8)
    if (compressAttachmentsFirst && !didAttachments) {
      const attachmentTarget = Math.max(8, contextTarget - Math.max(0, initialNonAttachment - overhead))
      await compressAttachmentsOnce(context, attachmentTarget, input.summarizer, estimator)
      didAttachments = true
      compressed = true
      continue
    }
    await compressNonAttachment(
      input.agentId,
      context,
      contextTarget,
      input.summarizer,
      estimator,
      protect,
    )
    compressed = true
  }

  messages = assembleMessages(input.agentId, context, input.angle)
  estimated = estimateCall(messages, input.agentId, limits.totalTokens, estimator)
  if (estimated >= limits.totalTokens) {
    const user = messages[1]
    if (user) {
      const overhead = estimated - estimator(user.content)
      const allowed = Math.max(32, limits.totalTokens - overhead - 8)
      user.content = user.content.slice(0, Math.max(32, Math.floor(user.content.length * (allowed / Math.max(1, estimator(user.content))))))
      messages = [messages[0]!, user]
      compressed = true
    }
  }

  return {
    agentId: input.agentId,
    messages,
    context,
    compressed,
    estimatedTokens: estimateCall(messages, input.agentId, limits.totalTokens, estimator),
    originalUnchanged: true,
  }
}
