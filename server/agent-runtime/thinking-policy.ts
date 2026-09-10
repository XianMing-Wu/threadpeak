import type { LlmCompleteInput } from './types.ts'

export const THINKING_POLICY_VERSION = 'fast-off-deep-low-v2'
export function thinkingParameters(input: Pick<LlmCompleteInput, 'thinkingDepth' | 'thinking'>) {
  const enabled = input.thinkingDepth === 'deep' && input.thinking !== 'disabled'
  return enabled
    ? { thinking: { type: 'enabled' as const }, reasoning_effort: 'low' as const }
    : { thinking: { type: 'disabled' as const } }
}
export function reasoningReserve(input: Pick<LlmCompleteInput, 'thinkingDepth' | 'thinking'>) {
  return thinkingParameters(input).thinking.type === 'enabled' ? 8192 : 0
}
