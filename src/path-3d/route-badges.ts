/** Visual categories come from IDs and entity kinds, never from titles or progress. */
export function routeBadgeEntries(structure: {
  entrySubjectId: string
  goalSubjectIds: readonly string[]
  subjects: readonly { id: string }[]
  concepts: readonly { id: string }[]
}) {
  const goals = new Set(structure.goalSubjectIds)
  return [
    ...structure.subjects.map(({id}) => [id, id === structure.entrySubjectId ? 'start' : goals.has(id) ? 'goal' : 'carrier'] as const),
    ...structure.concepts.map(({id}) => [id, 'concept'] as const),
  ]
}
