export const ZHIHU_SEARCH_QUERY_MAX = 200
export const ZHIHU_SEARCH_PACKS = 2

/** This same validated packing is used by the author planner and its dispatcher. */
export function packAuthorSearchQueries(queries:readonly string[]):PackedSearchQuery[] {
  if(queries.length<2||queries.length>3||queries.some(q=>!q.trim()||q.trim().length>90))throw new Error('请给出 2–3 条问法，每条不超过 90 字。')
  return packZhihuSearchQueries(queries.map((text,i)=>({id:String(i),text})))
}

export type PackableSearchQuery = {
  id: string
  text: string
  angle?: string
}

export type PackedSearchQuery = {
  queryId: string
  query: string
  sourceIds: string[]
}

export function joinSearchTexts(texts: readonly string[], max = ZHIHU_SEARCH_QUERY_MAX): string {
  const parts = texts.map((item) => item.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  const combined = parts.join(' ')
  if (combined.length > max) throw new Error('检索问法合并后超过 200 字，请保留所有角度并简写各条问法。')
  return combined
}

export function packZhihuSearchQueries(
  queries: readonly PackableSearchQuery[],
  packs: 1 | 2 = ZHIHU_SEARCH_PACKS,
): PackedSearchQuery[] {
  const usable = queries.filter((item) => item.id.trim() && item.text.trim())
  if (usable.length === 0) return []
  if (packs === 1 || usable.length === 1) {
    return [{
      queryId: usable[0].id,
      query: joinSearchTexts(usable.map((item) => item.text)),
      sourceIds: usable.map((item) => item.id),
    }]
  }
  const normal = usable.filter((item) => item.angle === 'normal_learning')
  const pitfall = usable.filter((item) => item.angle === 'pitfall_or_dispute')
  const groups = normal.length > 0 && pitfall.length > 0
    ? [normal, pitfall]
    : [usable.slice(0, Math.ceil(usable.length / 2)), usable.slice(Math.ceil(usable.length / 2))]
  return groups.filter((group) => group.length > 0).map((group) => ({
    queryId: group[0].id,
    query: joinSearchTexts(group.map((item) => item.text)),
    sourceIds: group.map((item) => item.id),
  }))
}
