export function hasSettledMineConceptGraph(graph?: {
  nodes: ReadonlyArray<{
    id: string
    turns: ReadonlyArray<{ paragraphs: readonly string[] }>
  }>
}): boolean {
  const root = graph?.nodes.find((node) => node.id === 'root')
  if (!root) return false
  return root.turns.some((turn) => turn.paragraphs.some((paragraph) => {
    const text = paragraph.trim()
    if (!text) return false
    return !(text.includes('这是你第一次进入') && text.includes('而不是套用别的路线的讲稿'))
  }))
}
