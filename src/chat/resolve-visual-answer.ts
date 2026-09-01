export type VisualAnswerResolution = {
  kind: 'unavailable'
  reason: 'missing-visual-provider'
  title: string
  message: string
}

export function resolveVisualAnswer(): VisualAnswerResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-visual-provider',
    title: '无法生成本次图文',
    message: '图文回答还没有接通真实的 VisualizationArtifact。不能用预写图或页面计时冒充成功。',
  }
}
