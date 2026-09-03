export type SubjectDraft = {
  from: string
  to: string
}

export function undirectedPairKey(left: string, right: string): string {
  return left < right ? `${left}\0${right}` : `${right}\0${left}`
}

export function addUniqueDraft(drafts: SubjectDraft[], from: string, to: string): void {
  if (!from || !to || from === to) return
  if (drafts.some((item) => item.from === from && item.to === to)) return
  drafts.push({ from, to })
}

function outgoingMap(drafts: readonly SubjectDraft[]): Map<string, string[]> {
  const outgoing = new Map<string, string[]>()
  for (const edge of drafts) {
    const targets = outgoing.get(edge.from) ?? []
    targets.push(edge.to)
    outgoing.set(edge.from, targets)
  }
  return outgoing
}

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function splitTargetSets(drafts: readonly SubjectDraft[]): string[][] {
  return [...outgoingMap(drafts).values()].filter((targets) => targets.length >= 2)
}

export function splitSiblingPairs(drafts: readonly SubjectDraft[]): Set<string> {
  const pairs = new Set<string>()
  for (const targets of splitTargetSets(drafts)) {
    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        pairs.add(undirectedPairKey(targets[i]!, targets[j]!))
      }
    }
  }
  return pairs
}

export function hasUnbalancedSplitJoin(
  drafts: readonly SubjectDraft[],
  goalIds: readonly string[] = [],
): boolean {
  const goals = new Set(goalIds)
  const outgoing = outgoingMap(drafts)
  for (const siblings of splitTargetSets(drafts)) {
    const siblingSet = new Set(siblings)
    const destSets = siblings.map((id) => (outgoing.get(id) ?? []).filter((to) => !siblingSet.has(to)))
    if (destSets.every((dests) => dests.length === 0)) continue
    const allDests = destSets.flat()
    if (goals.size > 0 && allDests.some((id) => !goals.has(id)) && allDests.some((id) => goals.has(id))) {
      return true
    }
    const [first, ...rest] = destSets
    if (!first || !first.some((dest) => rest.every((dests) => dests.includes(dest)))) return true
  }
  return false
}

export function alignSplitJoins(drafts: readonly SubjectDraft[], goalId: string): SubjectDraft[] {
  const next = drafts.map((edge) => ({ ...edge }))
  const shortcutFrom = new Set<string>()
  for (const siblings of splitTargetSets(next)) {
    const outgoing = outgoingMap(next)
    const siblingSet = new Set(siblings)
    const continuations: string[] = []
    for (const id of siblings) {
      for (const to of outgoing.get(id) ?? []) {
        if (!siblingSet.has(to)) continuations.push(to)
      }
    }
    const uniqueJoins = uniqueIds(continuations)
    const nonGoal = uniqueJoins.filter((id) => id !== goalId)
    const joinTargets = nonGoal.length > 0 ? nonGoal : uniqueJoins
    if (joinTargets.length === 0) continue
    for (const id of siblings) {
      for (const target of joinTargets) addUniqueDraft(next, id, target)
    }
    if (nonGoal.length > 0) {
      for (const id of siblings) shortcutFrom.add(id)
    }
  }
  if (shortcutFrom.size === 0) return next
  return next.filter((edge) => !(shortcutFrom.has(edge.from) && edge.to === goalId))
}

export function hasSplitSiblingEdge(drafts: readonly SubjectDraft[]): boolean {
  const forbidden = splitSiblingPairs(drafts)
  return drafts.some((edge) => forbidden.has(undirectedPairKey(edge.from, edge.to)))
}

function draftKey(edge: SubjectDraft): string {
  return `${edge.from}->${edge.to}`
}

function sameDrafts(left: readonly SubjectDraft[], right: readonly SubjectDraft[]): boolean {
  if (left.length !== right.length) return false
  const keys = new Set(left.map(draftKey))
  return right.every((edge) => keys.has(draftKey(edge)))
}

export function removeSplitSiblingDrafts(drafts: readonly SubjectDraft[]): SubjectDraft[] {
  const forbidden = splitSiblingPairs(drafts)
  return drafts.filter((edge) => !forbidden.has(undirectedPairKey(edge.from, edge.to)))
}

function walkFrom(
  start: string,
  drafts: readonly SubjectDraft[],
  next: (edge: SubjectDraft) => string,
  match: (edge: SubjectDraft, current: string) => boolean,
): Set<string> {
  const seen = new Set<string>()
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.pop()
    if (!current || seen.has(current)) continue
    seen.add(current)
    for (const edge of drafts) {
      if (match(edge, current)) queue.push(next(edge))
    }
  }
  return seen
}

export function connectSubjectReachability(
  drafts: SubjectDraft[],
  entryId: string,
  goalId: string,
  allIds: readonly string[],
): void {
  const reachable = () => walkFrom(entryId, drafts, (edge) => edge.to, (edge, current) => edge.from === current)
  const canReachGoal = () => walkFrom(goalId, drafts, (edge) => edge.from, (edge, current) => edge.to === current)
  for (const id of allIds) {
    if (!reachable().has(id) && id !== entryId) addUniqueDraft(drafts, entryId, id)
  }
  for (const id of allIds) {
    if (!canReachGoal().has(id) && id !== goalId) addUniqueDraft(drafts, id, goalId)
  }
}

/**
 * Host compilation adds a visual parallel-peer between split siblings, so an
 * authored edge on that pair cannot stay. A fork means those siblings are
 * parallel; they must join the same next subject instead of one jumping to the goal.
 */
export function stabilizeHostSubjectDrafts(
  drafts: readonly SubjectDraft[],
  entryId: string,
  goalId: string,
  allIds: readonly string[],
): SubjectDraft[] {
  let current = drafts.map((edge) => ({ ...edge }))
  for (let step = 0; step < 8; step += 1) {
    connectSubjectReachability(current, entryId, goalId, allIds)
    const next = alignSplitJoins(removeSplitSiblingDrafts(current), goalId)
    if (sameDrafts(next, current)) return next
    current = next
  }
  connectSubjectReachability(current, entryId, goalId, allIds)
  return alignSplitJoins(removeSplitSiblingDrafts(current), goalId)
}
