import { useEffect, useState } from 'react'
import { recordAskAuthorsOnNetwork } from './author-network'
import {
  annotationEventName,
  annotationsInScope,
  createAskAuthorsAnnotation,
  nextOrdinal,
  readAnnotationStore,
  resolveBloggerReply,
  writeAnnotationStore,
  type AnnotationStore,
  type AskAuthorsAnnotation,
} from './ask-authors'

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

  useEffect(() => {
    const pending = store.items.filter((item) => item.status === 'answering')
    if (pending.length === 0) return
    const timers = pending.map((item) => window.setTimeout(() => {
      setStore((current) => persist({
        ...current,
        items: current.items.map((entry) => {
          if (entry.id !== item.id || entry.status !== 'answering') return entry
          const ready = { ...entry, status: 'ready' as const, reply: resolveBloggerReply(entry.quote, entry.question) }
          recordAskAuthorsOnNetwork(ready)
          return ready
        }),
      }))
    }, 720))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [store.items])

  const commit = (next: AnnotationStore) => setStore(persist(next))
  const annotations = annotationsInScope(store.items, scopeId)
  const active = annotations.find((item) => item.id === store.activeId) ?? null

  const create = (quote: string, question: string, nodeId: string) => {
    const ordinal = nextOrdinal(store.items, scopeId)
    const created = createAskAuthorsAnnotation(quote, question, nodeId, ordinal, scopeId)
    recordAskAuthorsOnNetwork(created)
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
