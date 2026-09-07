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
      throw new Error('SUMMARY_UNAVAILABLE')
    }
    const summary = completed.text.trim()
    if (estimateTokens(summary) <= targetTokens) return `[来源摘要 sourceId=${sourceId}]\n${summary}`
    throw new Error('SUMMARY_REQUIRES_REDUCTION')
  }
}
