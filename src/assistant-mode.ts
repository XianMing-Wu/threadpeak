export type AssistantMode = 'route' | 'visual' | ''

export function normalizeAssistantMode(value: unknown): AssistantMode {
  if (value === 'route' || value === 'visual') return value
  return ''
}
