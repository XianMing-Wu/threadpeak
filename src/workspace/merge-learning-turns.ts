import type { LearningTurn } from './types'

function isFailureSentinel(reply: string) {
  return reply === 'authors' || reply === 'coach'
}

export function isUsableAssistantTurn(turn?: LearningTurn) {
  return Boolean(turn && turn.role === 'assistant' && !turn.failed && !isFailureSentinel(turn.text))
}

export function mergeSuccessfulLearningTurn(
  prior: readonly LearningTurn[],
  input: {
    userText: string
    reply: string
    extras: Partial<Pick<LearningTurn, 'quote' | 'grow' | 'growSource' | 'quoteFromId' | 'growTitle' | 'growReason' | 'mergeNodeId'>>
  },
): LearningTurn[] {
  const base = prior[prior.length - 1]?.role === 'user' && prior[prior.length - 1]?.text === input.userText
    ? prior.slice(0, -1)
    : prior.slice()
  const userTurn: LearningTurn = { role: 'user', text: input.userText, ...input.extras }
  const assistantTurn: LearningTurn = { role: 'assistant', text: input.reply }
  let pairIndex = -1
  for (let index = base.length - 2; index >= 0; index -= 1) {
    if (base[index]?.role === 'user' && base[index]?.text === input.userText && base[index + 1]?.role === 'assistant') {
      pairIndex = index
      break
    }
  }
  if (pairIndex < 0) return [...base, userTurn, assistantTurn]
  if (isUsableAssistantTurn(base[pairIndex + 1])) {
    return base.map((item, index) => (index === pairIndex ? { ...item, ...input.extras, text: input.userText } : item))
  }
  return base.map((item, index) => {
    if (index === pairIndex) return { ...item, ...input.extras, text: input.userText }
    if (index === pairIndex + 1) return assistantTurn
    return item
  })
}
