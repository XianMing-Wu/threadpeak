import { useEffect, useRef, useState } from 'react'
import {
  annotationEventName,
  annotationsInScope,
  applyAskAuthorResult,
  createAskAuthorsAnnotation,
  nextOrdinal,
  readAnnotationStore,
  writeAnnotationStore,
  type AnnotationStore,
  type AskAuthorsAnnotation,
} from './ask-authors'
import { requestAskAuthor } from './request-ask-author'

function isPersistableReady(item: AskAuthorsAnnotation) {
  return item.status === 'ready' && (item.reply?.source === 'zhihu-live' || item.reply?.source === 'liu-kanshan-direct')
}

function persistReady(store: AnnotationStore) {
  writeAnnotationStore({
    ...store,
    items: store.items.filter(isPersistableReady),
    panelOpen: false,
  })
  return store
}

export function useAnnotations(scopeId: string, onSettled?: (item: AskAuthorsAnnotation) => void) {
  const [store, setStore] = useState<AnnotationStore>(readAnnotationStore)
  const storeRef = useRef(store)
  storeRef.current = store
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    const sync = () => {
      setStore((current) => {
        const persisted = readAnnotationStore()
        const persistedIds = new Set(persisted.items.map((item) => item.id))
        const inflight = current.items.filter((item) => item.status === 'answering' && !persistedIds.has(item.id))
        return {
          items: [...persisted.items, ...inflight],
          activeId: current.activeId,
          panelOpen: current.panelOpen,
        }
      })
    }
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
      const applied = applyAskAuthorResult(created, result)
      setStore((current) => {
        const items = current.items.map((item) => (item.id === created.id ? applied : item))
        const next = { ...current, items, activeId: created.id, panelOpen: true }
        if (isPersistableReady(applied)) persistReady(next)
        return next
      })
      if (isPersistableReady(applied)) onSettledRef.current?.(applied)
    })
    return created
  }

  return {
    annotations,
    active,
    panelOpen: store.panelOpen && Boolean(active),
    create,
    open: (id: string) => {
      const current = storeRef.current
      if (current.panelOpen && current.activeId === id) {
        commit({ ...current, panelOpen: false, activeId: null }, false)
        return
      }
      commit({ ...current, activeId: id, panelOpen: true }, false)
    },
    close: () => commit({ ...storeRef.current, panelOpen: false, activeId: null }, false),
    reopen: () => {
      const current = storeRef.current
      const scoped = annotationsInScope(current.items, scopeId)
      const activeId = current.activeId && scoped.some((item) => item.id === current.activeId)
        ? current.activeId
        : scoped[0]?.id ?? null
      commit({ ...current, activeId, panelOpen: Boolean(activeId) }, false)
    },
    clear: () => commit({
      items: store.items.filter((item) => (item.scopeId || 'legacy') !== scopeId),
      activeId: null,
      panelOpen: false,
    }, true),
  }
}

export type { AskAuthorsAnnotation }
