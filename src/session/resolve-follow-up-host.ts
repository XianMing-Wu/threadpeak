import { isUsableAssistantTurn } from '../workspace/merge-learning-turns.ts'
import type { LearningTurn } from '../workspace/types'

export type FollowUpHostCard = {
  nodeId: string
  content: string
}

export type FollowUpHostResolution =
  | {
    ok: true
    hostNodeId: string
    explicitQuote: boolean
    quote: { nodeId: string | null; text: string | null }
  }
  | { ok: false; reason: 'empty-question' }

function lastSuccessfulReply(turns: readonly LearningTurn[], root: FollowUpHostCard): { nodeId: string; text: string } {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    if (!isUsableAssistantTurn(turn) || !turn) continue
    return {
      nodeId: turn.nodeId?.trim() || root.nodeId,
      text: turn.text,
    }
  }
  return { nodeId: root.nodeId, text: root.content }
}

function replyCardForUserTurn(turns: readonly LearningTurn[], userIndex: number, rootId: string): string | undefined {
  const reply = turns[userIndex + 1]
  if (!isUsableAssistantTurn(reply)) return undefined
  return reply?.nodeId?.trim() || rootId
}

export function replyHostOfUserTurn(turns: readonly LearningTurn[], userIndex: number, rootId = 'root'): string | undefined {
  const user = turns[userIndex]
  if (!user || user.role !== 'user' || user.failed) return undefined
  return replyCardForUserTurn(turns, userIndex, rootId)
}

export function turnAllowsSelection(turns: readonly LearningTurn[], index: number): boolean {
  const turn = turns[index]
  if (!turn || turn.failed) return false
  if (turn.role === 'assistant') return isUsableAssistantTurn(turn)
  if (turn.role !== 'user') return false
  return Boolean(replyCardForUserTurn(turns, index, 'root'))
}

export function hostsOfRange(startHost: string | undefined, endHost: string | undefined): string | undefined {
  if (startHost && endHost && startHost !== endHost) return undefined
  return startHost || endHost
}

export function resolveFollowUpHost(input: {
  question: string
  quote?: string
  quoteFromId?: string
  turns?: readonly LearningTurn[]
  root?: FollowUpHostCard
}): FollowUpHostResolution {
  const question = input.question.trim()
  if (!question) return { ok: false, reason: 'empty-question' }
  const root = input.root ?? { nodeId: 'root', content: '' }
  const turns = input.turns ?? []
  const latest = lastSuccessfulReply(turns, root)
  const quoteText = input.quote?.trim() ?? ''
  const quoteFromId = input.quoteFromId?.trim() ?? ''

  if (!quoteText && !quoteFromId) {
    return {
      ok: true,
      hostNodeId: latest.nodeId,
      explicitQuote: false,
      quote: {
        nodeId: latest.nodeId,
        text: latest.text.trim() || null,
      },
    }
  }

  if (quoteFromId.startsWith('user:')) {
    const userIndex = Number(quoteFromId.slice(5))
    const hostNodeId = Number.isInteger(userIndex) ? replyCardForUserTurn(turns, userIndex, root.nodeId) : undefined
    return {
      ok: true,
      hostNodeId: hostNodeId || latest.nodeId,
      explicitQuote: true,
      quote: {
        nodeId: hostNodeId || latest.nodeId,
        text: quoteText || null,
      },
    }
  }

  const hostNodeId = quoteFromId || latest.nodeId
  return {
    ok: true,
    hostNodeId,
    explicitQuote: true,
    quote: {
      nodeId: hostNodeId,
      text: quoteText || latest.text.trim() || null,
    },
  }
}
