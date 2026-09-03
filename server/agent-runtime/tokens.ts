import { MESSAGE_WRAPPER_TOKENS, OUTPUT_RESERVE_TOKENS } from './constants.ts'
import type { AgentId, ChatMessage, TokenEstimator } from './types.ts'

function isCjk(code: number): boolean {
  return (
    (code >= 0x3400 && code <= 0x4dbf)
    || (code >= 0x4e00 && code <= 0x9fff)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0x20000 && code <= 0x2ceaf)
  )
}

export const estimateTokens: TokenEstimator = (text) => {
  if (!text) return 0
  let tokens = 0
  let asciiRun = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (isCjk(code)) {
      if (asciiRun > 0) {
        tokens += Math.ceil(asciiRun / 4)
        asciiRun = 0
      }
      tokens += 1
      continue
    }
    asciiRun += 1
  }
  if (asciiRun > 0) tokens += Math.ceil(asciiRun / 4)
  return tokens
}

export function estimateMessages(
  messages: readonly ChatMessage[],
  estimator: TokenEstimator = estimateTokens,
): number {
  return messages.reduce((sum, message) => sum + estimator(message.content) + MESSAGE_WRAPPER_TOKENS, 0)
}

export function outputReserveTokens(agentId: AgentId, totalBudget: number): number {
  const configured = OUTPUT_RESERVE_TOKENS[agentId]
  const capped = Math.max(32, Math.floor(totalBudget * 0.15))
  return Math.min(configured, capped)
}

export function estimateCall(
  messages: readonly ChatMessage[],
  agentId: AgentId,
  totalBudget: number,
  estimator: TokenEstimator = estimateTokens,
): number {
  return estimateMessages(messages, estimator) + outputReserveTokens(agentId, totalBudget)
}
