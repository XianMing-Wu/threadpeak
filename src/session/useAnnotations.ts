import { useEffect, useState } from 'react'
import {
  annotationEventName,
  annotationsInScope,
  createAskAuthorsAnnotation,
  nextOrdinal,
  readAnnotationStore,
  writeAnnotationStore,
  type AnnotationStore,
  type AskAuthorsAnnotation,
} from './ask-authors'
import { requestAskAuthor } from './request-ask-author'

function persistReady(store: AnnotationStore) {
  writeAnnotationStore({
    ...store,
    items: store.items.filter((item) => item.status === 'ready' && item.reply?.source === 'zhihu-live'),
  })
  return store
}

export function useAnnotations(scopeId: string) {
  const [store, setStore] = useState<AnnotationStore>(readAnnotationStore)

  useEffect(() => {
    const sync = () => setStore(readAnnotationStore())
    window.addEventListener(annotationEventName(), sync)
    return () => window.removeEventListener(annotationEventName(), sync)
  }, [])

  const commit = (next: AnnotationStore, persist: boolean) => {
    setStore(persist ? persistReady(next) : next)
  }
  const annotations = annotationsInScope(store.items, scopeId)
  const active = annotations.find((item) => item.id === store.activeId) ?? null

  const create = (quote: string, question: string, nodeId: string) => {
    const ordinal = nextOrdinal(store.items, scopeId)
    const created = createAskAuthorsAnnotation(quote, question, nodeId, ordinal, scopeId)
    commit({
      items: [...store.items, created],
      activeId: created.id,
      panelOpen: true,
    }, false)
    void requestAskAuthor({ question, quote }).then((result) => {
      setStore((current) => {
        const items = current.items.map((item) => {
          if (item.id !== created.id) return item
          if (result.kind === 'authors' && result.authors[0]) {
            return {
              ...item,
              status: 'ready' as const,
              reply: result.authors[0],
              error: undefined,
            }
          }
          const error = result.kind === 'direct'
            ? '没有可信作者时刘看山直达不能写入博主批注。'
            : result.kind === 'unavailable'
              ? result.message
              : '无法完成本次问博主。'
          return {
            ...item,
            status: 'unavailable' as const,
            reply: null,
            error,
          }
        })
        const next = { ...current, items, activeId: created.id, panelOpen: true }
        if (items.some((item) => item.id === created.id && item.status === 'ready')) persistReady(next)
        return next
      })
    })
    return created
  }

  return {
    annotations,
    active,
    panelOpen: store.panelOpen && Boolean(active),
    create,
    open: (id: string) => commit({ ...store, activeId: id, panelOpen: true }, false),
    close: () => commit({ ...store, panelOpen: false }, false),
    reopen: () => commit({ ...store, panelOpen: true }, false),
    clear: () => commit({
      items: store.items.filter((item) => (item.scopeId || 'legacy') !== scopeId),
      activeId: null,
      panelOpen: false,
    }, true),
  }
}

export type { AskAuthorsAnnotation }
