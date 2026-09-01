export type AuthorNetworkResolution = {
  kind: 'unavailable'
  reason: 'missing-author-network-projector'
  title: string
  message: string
}

export function resolveAuthorNetwork(): AuthorNetworkResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-author-network-projector',
    title: '无法打开这次博主网络',
    message: '博主网络还没有接通真实的关系投影。不能用 sessionStorage 或示例星图冒充已提交网络。',
  }
}
