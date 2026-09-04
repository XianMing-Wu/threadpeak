export type AssistantMode = 'route' | ''

export function normalizeAssistantMode(value: unknown): AssistantMode {
  if (value === 'route') return value
  return ''
}
