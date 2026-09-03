import { SUMMARIZER_SYSTEM_PROMPT } from './prompts.ts'
import { estimateTokens } from './tokens.ts'
import type { LlmProvider, Summarizer, ThinkingDepth } from './types.ts'

export function createLlmSummarizer(ports: {
  llm: LlmProvider
  thinkingDepth?: ThinkingDepth
}): Summarizer {
  const thinkingDepth = ports.thinkingDepth ?? 'fast'
  return async ({ sourceId, text, targetTokens }) => {
    const completed = await ports.llm.complete({
      json: false,
      thinkingDepth,
      maxTokens: Math.min(1024, Math.max(64, targetTokens * 2)),
      messages: [
        { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            sourceId,
            targetTokens,
            text,
          }),
        },
      ],
    })
    if (completed.kind === 'failed') {
      const prefix = `[来源摘要 sourceId=${sourceId}] `
      return `${prefix}${text.slice(0, Math.max(8, targetTokens))}`
    }
    const summary = completed.text.trim()
    if (estimateTokens(summary) <= targetTokens) return `[来源摘要 sourceId=${sourceId}]\n${summary}`
    return `[来源摘要 sourceId=${sourceId}]\n${summary.slice(0, Math.max(8, targetTokens * 2))}`
  }
}
