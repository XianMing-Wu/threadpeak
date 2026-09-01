export type AssistantMode = 'route' | 'visual' | 'authors' | ''

export function normalizeAssistantMode(value: unknown): AssistantMode {
  if (value === 'route' || value === 'visual' || value === 'authors') return value
  return ''
}
