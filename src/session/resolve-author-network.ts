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
    message: '现在读不到你的博主。请稍后再试。',
  }
}
