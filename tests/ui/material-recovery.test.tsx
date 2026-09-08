import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {act,cleanup,render,renderHook,screen,waitFor} from '@testing-library/react'
import {useMaterials} from '../../src/materials/use-materials'
import {MaterialChips} from '../../src/materials/Materials'
import {ensureSession,productRequest} from '../../src/learning-v2/client'
vi.mock('../../src/learning-v2/client',async importOriginal=>({...await importOriginal<typeof import('../../src/learning-v2/client')>(),ensureSession:vi.fn(),productRequest:vi.fn()}))
const material=(sourceId:string)=>({sourceId,fileName:`${sourceId}.txt`,mimeType:'text/plain',content:'原始资料',origin:'upload',status:'ready'})
beforeEach(()=>{vi.mocked(ensureSession).mockResolvedValue(undefined);vi.mocked(productRequest).mockRejectedValue(new Error('temporary network failure'))})
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks()})
test('partial recovery preserves failed selections, blocks send and retries successfully',async()=>{
 sessionStorage.setItem('tp-home-materials',JSON.stringify(['a','b']))
 vi.mocked(productRequest).mockImplementation(async url=>{if(url.endsWith('/a'))return material('a') as never;throw Error('offline')})
 const {result}=renderHook(()=>useMaterials())
 await waitFor(()=>expect(result.current.restoring).toBe(false))
 expect(result.current.files.map(f=>f.sourceId)).toEqual(['a']);expect(result.current.unresolved).toEqual([{sourceId:'b'}]);expect(result.current.ready).toBe(false)
 expect(JSON.parse(sessionStorage.getItem('tp-home-materials')!)).toEqual(['a','b'])
 vi.mocked(productRequest).mockImplementation(async url=>material(url.endsWith('/a')?'a':'b') as never)
 act(()=>result.current.retryRestore())
 await waitFor(()=>expect(result.current.ready).toBe(true))
 expect(result.current.files.map(f=>f.sourceId)).toEqual(['a','b']);expect(result.current.unresolved).toEqual([])
})
test('only an explicit removal clears an unresolved file selection',async()=>{
 sessionStorage.setItem('tp-home-materials','["saved-material"]')
 function View(){const model=useMaterials();return <><MaterialChips model={model}/><button disabled={!model.ready}>发送</button></>}
 render(<View/>)
 await screen.findByText('部分已选资料暂未恢复，原选择仍然保留。请重新读取或明确移除后发送。')
 expect(sessionStorage.getItem('tp-home-materials')).toBe('["saved-material"]');expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(true)
 await act(async()=>screen.getByRole('button',{name:'移除未恢复资料 1'}).click())
 expect(sessionStorage.getItem('tp-home-materials')).toBe('[]');expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(false)
})
test('failed folder reads retain the binding and never start a duplicate import',async()=>{
 const saved={scope:{kind:'collections',folderIds:['folder']},folders:{folder:'existing-import'}}
 sessionStorage.setItem('tp-home-material-scope',JSON.stringify(saved))
 const {result}=renderHook(()=>useMaterials())
 await waitFor(()=>expect(result.current.restoring).toBe(false))
 expect(result.current.ready).toBe(false);expect(result.current.unresolved).toEqual([{folderId:'folder',sourceId:'existing-import'}])
 expect(JSON.parse(sessionStorage.getItem('tp-home-material-scope')!)).toEqual(saved)
 expect(vi.mocked(productRequest).mock.calls.every(([,options])=>options?.method!=='POST')).toBe(true)
 act(()=>result.current.remove('existing-import'))
 expect(result.current.searchScope).toEqual({kind:'collections',folderIds:[]})
})
test('session failure leaves both stored selections untouched and can be retried',async()=>{
 vi.mocked(ensureSession).mockRejectedValueOnce(Error('offline'))
 sessionStorage.setItem('tp-home-materials','["a"]');sessionStorage.setItem('tp-home-material-scope','{"scope":{"kind":"web"},"folders":{}}')
 const {result}=renderHook(()=>useMaterials())
 await waitFor(()=>expect(result.current.restoreError).not.toBe(''))
 expect(result.current.loaded).toBe(false);expect(result.current.ready).toBe(false);expect(sessionStorage.getItem('tp-home-materials')).toBe('["a"]')
 vi.mocked(productRequest).mockResolvedValue(material('a'))
 act(()=>result.current.retryRestore())
 await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.searchScope.kind).toBe('web')
})

test('account switch fences an old in-flight restoration and retains the new account selections',async()=>{
 sessionStorage.setItem('tp-home-materials','["old-account"]')
 let finish!:(value:unknown)=>void
 vi.mocked(productRequest).mockImplementation(async url=>url.endsWith('/old-account')?await new Promise<unknown>(resolve=>{finish=resolve}) as never:material('new-account') as never)
 const {result}=renderHook(()=>useMaterials())
 await waitFor(()=>expect(finish).toBeTypeOf('function'))
 act(()=>{sessionStorage.setItem('tp-home-materials','["new-account"]');window.dispatchEvent(new Event('threadpeak:account-change'))})
 await waitFor(()=>expect(result.current.ready).toBe(true))
 await act(async()=>finish(material('old-account')))
 expect(result.current.files.map(f=>f.sourceId)).toEqual(['new-account']);expect(sessionStorage.getItem('tp-home-materials')).toBe('["new-account"]')
})

test('account switch does not send the remaining old-account upload queue or restore late uploads',async()=>{
 const pending:{resolve:(value:Response)=>void}[]=[]
 const fetch=vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>pending.push({resolve})))
 vi.stubGlobal('fetch',fetch)
 const {result}=renderHook(()=>useMaterials());await waitFor(()=>expect(result.current.ready).toBe(true))
 let upload!:Promise<void>
 act(()=>{upload=result.current.upload([0,1,2].map(i=>new File(['合成测试内容'],`file-${i}.txt`,{type:'text/plain'})))})
 await waitFor(()=>expect(pending).toHaveLength(2))
 act(()=>{sessionStorage.removeItem('tp-home-materials');window.dispatchEvent(new Event('threadpeak:account-change'))})
 await waitFor(()=>expect(result.current.ready).toBe(true))
 await act(async()=>{pending.forEach((p,i)=>p.resolve({ok:true,json:async()=>material(`old-upload-${i}`)} as Response));await upload})
 expect(fetch).toHaveBeenCalledTimes(2);expect(result.current.files).toEqual([]);expect(sessionStorage.getItem('tp-home-materials')).toBe('[]')
 vi.unstubAllGlobals()
})
