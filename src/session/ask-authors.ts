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
  source?: 'zhihu-live' | 'liu-kanshan-direct'
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
  replies?: BloggerReply[]
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
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isPersistedAnnotation) : []
    return {
      items,
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      panelOpen: false,
    }
  } catch {
    return emptyAnnotationStore()
  }
}

export function writeAnnotationStore(store: AnnotationStore) {
  sessionStorage.setItem(ANNOTATION_KEY, JSON.stringify(store))
  window.dispatchEvent(new Event(ANNOTATION_EVENT))
}

const BLOCKED_AUTHOR_NAMES = new Set(['马同学', '李永乐老师', '刘看山'])

export function stripAuthorArticleLink(text: string, url: string) {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return trimmed
    .replace(new RegExp(`(?:\\n{1,2})?详细内容可以阅读我的文章\\s*${escaped}\\s*$`), '')
    .replace(new RegExp(`(?:\\n{1,2})?${escaped}\\s*$`), '')
    .replace(/(?:\n{1,2})?详细内容可以阅读我的文章\s*$/, '')
    .trim()
}

export function formatAuthorAnnotation(summary: string, url: string) {
  return stripAuthorArticleLink(summary, url)
}

export function liuKanshanDirectReply(text: string): BloggerReply {
  return {
    name: '刘看山',
    bio: '不是博主身份',
    title: '刘看山直达',
    url: '',
    text: text.trim(),
    source: 'liu-kanshan-direct',
  }
}

export function isLiuKanshanDirect(reply: BloggerReply | null | undefined): boolean {
  return reply?.source === 'liu-kanshan-direct'
}

function isLiveReply(value: unknown): value is BloggerReply {
  if (!value || typeof value !== 'object') return false
  const reply = value as BloggerReply
  return reply.source === 'zhihu-live'
    && typeof reply.name === 'string'
    && !BLOCKED_AUTHOR_NAMES.has(reply.name)
    && typeof reply.bio === 'string'
    && typeof reply.title === 'string'
    && typeof reply.text === 'string'
    && isZhihuUrl(reply.url)
}

export function applyAskAuthorResult(
  item: AskAuthorsAnnotation,
  result:
    | { kind: 'authors'; authors: readonly BloggerReply[] }
    | { kind: 'direct'; text: string }
    | { kind: 'unavailable'; message: string },
): AskAuthorsAnnotation {
  if (result.kind === 'authors') {
    const authors = result.authors.filter(isLiveReply).slice(0, 2)
    const author = authors[0]
    if (author) {
      return { ...item, status: 'ready', reply: author, replies: authors, error: undefined }
    }
  }
  if (result.kind === 'direct' && result.text.trim()) {
    return { ...item, status: 'ready', reply: liuKanshanDirectReply(result.text), replies: undefined, error: undefined }
  }
  return {
    ...item,
    status: 'unavailable',
    reply: null,
    error: result.kind === 'unavailable' && result.message.trim()
      ? result.message
      : '无法完成本次问博主。',
  }
}

export function isPersistedAnnotation(value: unknown): value is AskAuthorsAnnotation {
  if (!value || typeof value !== 'object') return false
  const item = value as AskAuthorsAnnotation
  if (typeof item.id !== 'string' || typeof item.ordinal !== 'number' || typeof item.quote !== 'string') return false
  if (typeof item.scopeId !== 'string') return false
  if (item.status === 'ready') return isLiveReply(item.reply) || isLiuKanshanDirect(item.reply)
  if (item.status === 'unavailable' || item.status === 'answering') return false
  return false
}

export function annotationEventName() {
  return ANNOTATION_EVENT
}

function compactIndexToRaw(haystack: string, compactIndex: number) {
  let compactPos = 0
  for (let index = 0; index < haystack.length; index += 1) {
    const ch = haystack[index]
    if (ch == null || /\s/.test(ch)) continue
    if (compactPos === compactIndex) return index
    compactPos += 1
  }
  return haystack.length
}

/** Locate a user selection in source or rendered text; whitespace differences do not drop the hit. */
export function findQuoteSpan(haystack: string, quote: string): { start: number; end: number } | null {
  const needle = quote.replace(/\s+/g, ' ').trim()
  if (!needle || !haystack) return null
  const exact = haystack.indexOf(needle)
  if (exact >= 0) return { start: exact, end: exact + needle.length }
  const compactNeedle = needle.replace(/\s+/g, '')
  if (!compactNeedle) return null
  const compactIndex = haystack.replace(/\s+/g, '').indexOf(compactNeedle)
  if (compactIndex < 0) return null
  const start = compactIndexToRaw(haystack, compactIndex)
  const end = compactIndexToRaw(haystack, compactIndex + compactNeedle.length)
  return { start, end: Math.max(end, start + 1) }
}

export function annotationsForText(text: string, annotations: readonly AskAuthorsAnnotation[]) {
  return annotations.filter((item) => Boolean(item.quote && findQuoteSpan(text, item.quote)))
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
  const startHost = findNodeId?.(selection.anchorNode)
  const endHost = selection.focusNode ? findNodeId?.(selection.focusNode) : startHost
  if (startHost && endHost && startHost !== endHost) return null
  return {
    text,
    rect: { left: box.left, top: box.top, width: box.width, height: box.height },
    nodeId: startHost || endHost,
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

export function annotationScopeId(routeId: string, conceptId: string, conversationId = '') {
  const base = `${routeId}::${conceptId}`
  const conversation = conversationId.trim()
  return conversation ? `${base}::${conversation}` : base
}

export function annotationsInScope(items: readonly AskAuthorsAnnotation[], scopeId: string) {
  return items.filter((item) => {
    const id = item.scopeId || 'legacy'
    return id === scopeId || id.startsWith(`${scopeId}::`)
  })
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
