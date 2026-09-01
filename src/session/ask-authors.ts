import type { AnchorRect } from './popup-position'

export const MAX_ANNOTATION_QUESTION_LENGTH = 500

export interface SelectionAnchor {
  text: string
  rect: AnchorRect
  nodeId?: string
}

export interface BloggerReply {
  name: string
  bio: string
  title: string
  url: string
  text: string
}

export interface AskAuthorsAnnotation {
  id: string
  scopeId: string
  ordinal: number
  nodeId: string
  quote: string
  question: string
  status: 'answering' | 'ready' | 'unavailable'
  reply: BloggerReply | null
  error?: string
}

export type AnnotationStore = {
  items: AskAuthorsAnnotation[]
  activeId: string | null
  panelOpen: boolean
}

const ANNOTATION_KEY = 'threadpeak-annotations'
const ANNOTATION_EVENT = 'threadpeak-annotations'

export function emptyAnnotationStore(): AnnotationStore {
  return { items: [], activeId: null, panelOpen: false }
}

export function readAnnotationStore(): AnnotationStore {
  try {
    const raw = sessionStorage.getItem(ANNOTATION_KEY)
    if (!raw) return emptyAnnotationStore()
    const parsed = JSON.parse(raw) as Partial<AnnotationStore>
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isAnnotation) : []
    return {
      items,
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      panelOpen: parsed.panelOpen === true,
    }
  } catch {
    return emptyAnnotationStore()
  }
}

export function writeAnnotationStore(store: AnnotationStore) {
  sessionStorage.setItem(ANNOTATION_KEY, JSON.stringify(store))
  window.dispatchEvent(new Event(ANNOTATION_EVENT))
}

function isAnnotation(value: unknown): value is AskAuthorsAnnotation {
  if (!value || typeof value !== 'object') return false
  const item = value as AskAuthorsAnnotation
  return typeof item.id === 'string' && typeof item.ordinal === 'number' && typeof item.quote === 'string' && (typeof item.scopeId === 'string' || item.scopeId === undefined)
}

export function annotationEventName() {
  return ANNOTATION_EVENT
}

export function annotationsForText(text: string, annotations: readonly AskAuthorsAnnotation[]) {
  return annotations.filter((item) => item.quote && text.includes(item.quote))
}

export function readSelectionAnchor(
  root: Node | null,
  findNodeId?: (node: Node) => string | undefined,
): SelectionAnchor | null {
  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''
  if (!text || !root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return null
  const box = selection.getRangeAt(0).getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return null
  return {
    text,
    rect: { left: box.left, top: box.top, width: box.width, height: box.height },
    nodeId: findNodeId?.(selection.anchorNode),
  }
}

export function isZhihuUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'zhihu.com' || url.hostname.endsWith('.zhihu.com'))
  } catch {
    return false
  }
}

export function annotationsInScope(items: readonly AskAuthorsAnnotation[], scopeId: string) {
  return items.filter((item) => (item.scopeId || 'legacy') === scopeId)
}

export function nextOrdinal(items: readonly AskAuthorsAnnotation[], scopeId: string) {
  return annotationsInScope(items, scopeId).reduce((max, item) => Math.max(max, item.ordinal), 0) + 1
}

export function createAskAuthorsAnnotation(
  quote: string,
  question: string,
  nodeId: string,
  ordinal: number,
  scopeId: string,
): AskAuthorsAnnotation {
  return {
    id: `ann-${Date.now()}-${ordinal}`,
    scopeId,
    ordinal,
    nodeId,
    quote,
    question,
    status: 'answering',
    reply: null,
  }
}
