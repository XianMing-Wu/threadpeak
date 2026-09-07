import { SUMMARY_POLICY } from './semantic-chunks.ts'
import { estimateTokens } from './tokens.ts'
import type { LlmProvider, Summarizer, ThinkingDepth } from './types.ts'

export function createLlmSummarizer(ports: {
  llm: LlmProvider
  thinkingDepth?: ThinkingDepth
  purpose?: unknown
  window?: number
}): Summarizer {
  const thinkingDepth = ports.thinkingDepth ?? 'fast'
  return async ({ sourceId, text, targetTokens }) => {
    const system=SUMMARY_POLICY
    const content=JSON.stringify({source:sourceId,purpose:ports.purpose??{},maximumCharacters:Math.max(24,Math.floor(targetTokens/3)),text})
    const output=Math.min(16384,Math.max(512,targetTokens)+(thinkingDepth==='deep'?8192:0))
    if(Buffer.byteLength(system+content,'utf8')+output+2048>(ports.window??64000))throw new Error('CONTEXT_REQUIRES_PARTITION')
    const completed = await ports.llm.complete({
      json: false,
      thinkingDepth,
      maxTokens: output,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content,
        },
      ],
    })
    if (completed.kind === 'failed') {
      throw new Error('SUMMARY_UNAVAILABLE')
    }
    const summary = completed.text.trim()
    if (summary && estimateTokens(summary) <= targetTokens) return summary
    throw new Error('SUMMARY_REQUIRES_REDUCTION')
  }
}
