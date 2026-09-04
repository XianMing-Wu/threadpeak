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
    message: '现在无法完成问博主。请稍后再试。',
  }
}
