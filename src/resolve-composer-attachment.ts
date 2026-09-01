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
    message: '附件还没有接通已提交的来源。不能把本地文件名当成已上传 PDF 或 evidence pack。',
  }
}

export function resolveComposerSources(): ComposerSourcesResolution {
  return {
    kind: 'unavailable',
    reason: 'missing-sources-provider',
    title: '无法设置资料范围',
    message: '资料范围还没有接通已提交的来源。不能把知乎或已上传 PDF 当成已生效的检索范围。',
  }
}
