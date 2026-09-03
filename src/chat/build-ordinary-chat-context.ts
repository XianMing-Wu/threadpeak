export type OrdinaryChatTurnInput = {
  role: 'user' | 'assistant'
  text: string
}

export type OrdinaryChatAttachmentInput = {
  sourceId: string
  fileName: string
  content: string
}

export type OrdinaryChatContext = {
  currentMessage: string
  conversation: {
    messageId: string
    role: 'user' | 'assistant'
    kind: 'text'
    content: string
  }[]
  attachments: OrdinaryChatAttachmentInput[]
}

export function buildOrdinaryChatContext(input: {
  turns: readonly OrdinaryChatTurnInput[]
  currentMessage: string
  attachments?: readonly OrdinaryChatAttachmentInput[]
}): OrdinaryChatContext {
  const currentMessage = input.currentMessage.trim()
  const last = input.turns.at(-1)
  const prior = currentMessage && last?.role === 'user' && last.text === currentMessage
    ? input.turns.slice(0, -1)
    : input.turns
  return {
    currentMessage,
    conversation: prior.map((turn, index) => ({
      messageId: `m-${index}`,
      role: turn.role,
      kind: 'text',
      content: turn.text,
    })),
    attachments: [...(input.attachments ?? [])],
  }
}
