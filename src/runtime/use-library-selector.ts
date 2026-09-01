import { useEffect } from 'react'
import { projectLibraryReadModel, type LibraryReadModel } from './library-read-model'
import { ensurePrototypeRuntimeListeners, getPrototypeRuntimeStore } from './prototype-runtime'
import { useRuntimeSelector } from './use-runtime-selector'

export function useLibrarySelector<TSelected>(selector: (view: LibraryReadModel) => TSelected): TSelected {
  const store = getPrototypeRuntimeStore()
  useEffect(() => {
    ensurePrototypeRuntimeListeners()
    store.hydrateFromGet(projectLibraryReadModel())
  }, [store])
  return useRuntimeSelector(store, selector)
}
