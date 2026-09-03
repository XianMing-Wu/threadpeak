import { carrierTitleFromConcept, readableLayerTitle, titleFromPathLayer, type PathLayerDocument } from './layer-title.ts'

const WORKSPACE_KEY = 'threadpeak-workspace-v1'

export function resolveNetworkLayerTitle(
  value: string | undefined,
  routes?: readonly { document?: PathLayerDocument }[],
) {
  const raw = value?.trim() ?? ''
  const readable = readableLayerTitle(raw)
  if (readable) return readable
  if (!raw) return ''
  for (const document of documentsOf(routes)) {
    const title = titleFromPathLayer(document, raw)
    if (title) return title
  }
  return ''
}

export function resolveNetworkCarrierTitle(
  input: {
    carrierTitle?: string
    carrierId?: string
    conceptId?: string
    conceptTitle?: string
  },
  routes?: readonly { document?: PathLayerDocument }[],
) {
  const fromTitle = resolveNetworkLayerTitle(input.carrierTitle, routes)
  if (fromTitle) return fromTitle
  const fromId = resolveNetworkLayerTitle(input.carrierId, routes)
  if (fromId) return fromId
  for (const document of documentsOf(routes)) {
    const title = carrierTitleFromConcept(document, input.conceptId, input.conceptTitle)
    if (title) return title
  }
  return ''
}

function documentsOf(routes?: readonly { document?: PathLayerDocument }[]) {
  if (routes) return routes.map((item) => item.document).filter((item): item is PathLayerDocument => Boolean(item))
  try {
    const raw = globalThis.localStorage?.getItem(WORKSPACE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { routes?: Array<{ document?: PathLayerDocument }> }
    return Array.isArray(parsed.routes)
      ? parsed.routes.map((item) => item.document).filter((item): item is PathLayerDocument => Boolean(item))
      : []
  } catch {
    return []
  }
}
