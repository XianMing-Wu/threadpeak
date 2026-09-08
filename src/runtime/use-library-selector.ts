import { useEffect } from 'react'
import { type LibraryReadModel } from './library-read-model'
import { attachLibraryProjection,getLibraryProjectionStore } from './library-projection-store'
import { useRuntimeSelector } from './use-runtime-selector'

export function useLibrarySelector<TSelected>(selector: (view: LibraryReadModel) => TSelected): TSelected {
  const store = getLibraryProjectionStore()
  useEffect(() => {
    return attachLibraryProjection()
  }, [store])
  return useRuntimeSelector(store, selector)
}
