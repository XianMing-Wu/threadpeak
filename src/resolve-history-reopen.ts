export type HistoryReopenResolution = {
  kind: 'unavailable'
  reason: 'missing-history-provider'
  title: string
  message: string
}

export function resolveHistoryReopen(): HistoryReopenResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-history-provider',
    title: '无法重开这次历史',
    message: '历史还没有接通真实的已提交会话。不能用 localStorage 正文冒充精确重开。',
  }
}
