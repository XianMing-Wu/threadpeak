export type OrdinaryAnswerResolution = {
  kind: 'unavailable'
  reason: 'missing-answer-provider'
  title: string
  message: string
}

export function resolveOrdinaryAnswer(): OrdinaryAnswerResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-answer-provider',
    title: '无法生成本次回答',
    message: '普通回答还没有接通真实的 R5 模型服务。不能用预写 Mock 冒充成功。',
  }
}
