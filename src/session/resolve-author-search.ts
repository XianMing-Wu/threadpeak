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
    message: '博主网络还没有接通真实的关系投影。network-first 不能在网络失败时改走知乎，也不能用本地 GraphRAG 或固定作者凑数。',
  }
}
