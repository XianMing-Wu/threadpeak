/** localStorage reads clone objects; only changed content warrants a write/event. */
export function hostDocumentChanged(current: unknown, next: unknown): boolean {
  return current !== next && JSON.stringify(current) !== JSON.stringify(next)
}
