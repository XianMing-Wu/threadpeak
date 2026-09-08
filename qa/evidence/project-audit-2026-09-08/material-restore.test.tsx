// Reproduction of existing behavior, excluded from the normal acceptance suite.
import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,renderHook,waitFor} from '@testing-library/react'
import {useMaterials} from '../../../src/materials/use-materials'
vi.mock('../../../src/learning-v2/client',async importOriginal => ({
  ...await importOriginal<typeof import('../../../src/learning-v2/client')>(),
  ensureSession:vi.fn().mockResolvedValue(undefined),
  productRequest:vi.fn().mockRejectedValue(new Error('temporary network failure')),
}))
afterEach(() => {cleanup();sessionStorage.clear()})
test('audit reproduction: a transient restoration failure erases selected material IDs',async () => {
  sessionStorage.setItem('tp-home-materials',JSON.stringify(['saved-material']))
  const {result} = renderHook(() => useMaterials())
  await waitFor(() => expect(result.current.loaded).toBe(true))
  expect(result.current.files).toEqual([])
  expect(sessionStorage.getItem('tp-home-materials')).toBe('[]')
  expect(result.current.error).toBe('')
  expect(result.current.ready).toBe(true)
})
