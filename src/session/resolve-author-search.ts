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
    message: '博主搜索还没有接通真实的 network-first 检索。不能用本地 GraphRAG 或固定作者冒充成功。',
  }
}
