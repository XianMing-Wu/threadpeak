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
    message: '现在无法生成这次回答。请稍后再试。',
  }
}
