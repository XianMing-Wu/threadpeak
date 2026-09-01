export type AskAuthorResolution = {
  kind: 'unavailable'
  reason: 'missing-ask-author-provider'
  title: string
  message: string
}

export function resolveAskAuthor(): AskAuthorResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-ask-author-provider',
    title: '无法完成本次问博主',
    message: '问博主还没有接通真实的知乎检索与作者评审。不能用固定作者或预写回答冒充成功。',
  }
}
