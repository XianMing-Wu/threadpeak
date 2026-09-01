import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { RuntimeStore } from '@threadpeak/runtime-store'
import { ensurePrototypeRuntimeListeners, getPrototypeRuntimeStore } from './prototype-runtime'
import { projectLibraryReadModel, type LibraryReadModel } from './library-read-model'

export function useRuntimeSelector<TView, TSelected>(
  store: RuntimeStore<TView>,
  selector: (view: TView) => TSelected,
): TSelected {
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const cacheRef = useRef<{ selected: TSelected } | undefined>(undefined)

  const subscribe = useCallback((onStoreChange: () => void) => store.subscribe(onStoreChange), [store])
  const getSnapshot = () => {
    const selected = selectorRef.current(store.getSnapshot().view)
    if (cacheRef.current && Object.is(selected, cacheRef.current.selected)) return cacheRef.current.selected
    cacheRef.current = { selected }
    return selected
  }

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useLibrarySelector<TSelected>(selector: (view: LibraryReadModel) => TSelected): TSelected {
  const store = getPrototypeRuntimeStore()
  useEffect(() => {
    ensurePrototypeRuntimeListeners()
    store.hydrateFromGet(projectLibraryReadModel())
  }, [store])
  return useRuntimeSelector(store, selector)
}
