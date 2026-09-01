import type { ClarificationOption, ClarificationPrompt } from './contracts.ts'

export type ClarificationHistoryItem = Readonly<{
  prompt: ClarificationPrompt
  option: ClarificationOption
}>
