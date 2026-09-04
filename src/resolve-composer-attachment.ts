export type ComposerAttachmentResolution = {
  kind: 'unavailable'
  reason: 'missing-attachment-provider'
  title: string
  message: string
}

export type ComposerSourcesResolution = {
  kind: 'unavailable'
  reason: 'missing-sources-provider'
  title: string
  message: string
}

export function resolveComposerAttachment(): ComposerAttachmentResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-attachment-provider',
    title: '无法添加附件',
    message: '这份附件还不能使用。请重新添加。',
  }
}

export function resolveComposerSources(): ComposerSourcesResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-sources-provider',
    title: '无法设置资料范围',
    message: '资料范围还没有生效。请重新选择。',
  }
}
