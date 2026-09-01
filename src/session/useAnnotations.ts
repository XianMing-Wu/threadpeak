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
import { resolveAskAuthor } from './resolve-ask-author'

function persist(store: AnnotationStore) {
  writeAnnotationStore(store)
  return store
}

export function useAnnotations(scopeId: string) {
  const [store, setStore] = useState<AnnotationStore>(readAnnotationStore)

  useEffect(() => {
    const sync = () => setStore(readAnnotationStore())
    window.addEventListener(annotationEventName(), sync)
    return () => window.removeEventListener(annotationEventName(), sync)
  }, [])

  const commit = (next: AnnotationStore) => setStore(persist(next))
  const annotations = annotationsInScope(store.items, scopeId)
  const active = annotations.find((item) => item.id === store.activeId) ?? null

  const create = (quote: string, question: string, nodeId: string) => {
    const ordinal = nextOrdinal(store.items, scopeId)
    const resolution = resolveAskAuthor()
    const created = {
      ...createAskAuthorsAnnotation(quote, question, nodeId, ordinal, scopeId),
      status: 'unavailable' as const,
      reply: null,
      error: resolution.message,
    }
    commit({
      items: [...store.items, created],
      activeId: created.id,
      panelOpen: true,
    })
    return created
  }

  return {
    annotations,
    active,
    panelOpen: store.panelOpen && Boolean(active),
    create,
    open: (id: string) => commit({ ...store, activeId: id, panelOpen: true }),
    close: () => commit({ ...store, panelOpen: false }),
    reopen: () => commit({ ...store, panelOpen: true }),
    clear: () => commit({
      items: store.items.filter((item) => (item.scopeId || 'legacy') !== scopeId),
      activeId: null,
      panelOpen: false,
    }),
  }
}

export type { AskAuthorsAnnotation }
