export type AuthorSearchResolution = {
  kind: 'unavailable'
  reason: 'missing-author-search-provider'
  title: string
  message: string
}

export function resolveAuthorSearch(): AuthorSearchResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-author-search-provider',
    title: '无法完成本次博主搜索',
    message: '现在连不上博主搜索。请稍后再试。',
  }
}
