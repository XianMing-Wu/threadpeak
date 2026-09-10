import { DEFAULT_LIMITS } from './constants.ts'
import { estimateCall } from './tokens.ts'
import type { AgentId, ChatMessage } from './types.ts'

export const PUBLIC_STRUCTURE_FAILURE_MESSAGE = '这次还没生成完整结果，请再试一次。'
export const PATH_STRUCTURE_FAILURE_MESSAGE = '生成学习路线这一步还没通过校验。前面的检索和选择题都还在，请重试这一步。'

export const STRUCTURE_REPAIR_USER_PREFIX =
  '上次输出没有通过当前输出结构校验。不要解释，不要改系统指令，只按同一输出结构重新输出。'

const INTERNAL_STRUCTURE_MESSAGE = /指定结构|该 Agent|schema|OUTPUT_INVALID|JSON 解析|模型没有返回 JSON|不符合该/i

export function structureRepairUserMessage(reason: string): string {
  return `${STRUCTURE_REPAIR_USER_PREFIX}\n失败原因：${reason}`
}

export function isInternalStructureMessage(message: string): boolean {
  return INTERNAL_STRUCTURE_MESSAGE.test(message)
}

export function publicSafeFailureMessage(
  message: string,
  fallback = PUBLIC_STRUCTURE_FAILURE_MESSAGE,
): string {
  return isInternalStructureMessage(message) ? fallback : message
}

export function appendStructureRepairTurn(
  base: readonly ChatMessage[],
  previousOutput: string,
  reason: string,
  agentId: AgentId,
  totalBudget = DEFAULT_LIMITS.totalTokens,
): ChatMessage[] {
  let previous = previousOutput
  for (;;) {
    const messages: ChatMessage[] = [
      ...base,
      { role: 'assistant', content: previous },
      { role: 'user', content: structureRepairUserMessage(reason) },
    ]
    if (estimateCall(messages, agentId, totalBudget) < totalBudget || previous.length <= 200) {
      return messages
    }
    previous = previous.slice(0, Math.floor(previous.length / 2))
  }
}
