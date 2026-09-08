import {afterEach,expect,test,vi} from 'vitest'
import {switchWorkspace,readAccountBackup,accountRecoveryAvailable,accountStorageForExport} from '../../src/learning-v2/account-storage'
import {ensureSession,productRequest,resetSession} from '../../src/learning-v2/client'
const workspace='tp-server-workspace'
afterEach(()=>{localStorage.clear();sessionStorage.clear();resetSession();vi.restoreAllMocks()})
function quota(bytes:number){
 const write=Storage.prototype.setItem
 return vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){
  const total=Object.keys(this).filter(k=>k!==key).reduce((n,k)=>n+k.length+this.getItem(k)!.length,0)+key.length+String(value).length
  if(total>bytes)throw new DOMException('full','QuotaExceededError')
  return write.call(this,key,value)
 })
}
test('full localStorage cannot lock login: old drafts commit to IndexedDB before clearing',async()=>{
 const draft='"draft\\'.repeat(1000)
 localStorage.setItem(workspace,'alice');localStorage.setItem('tp-private',draft);sessionStorage.setItem('threadpeak-draft','unsent')
 quota(draft.length+100)
 const calls:string[]=[]
 vi.stubGlobal('fetch',async(url:string)=>{calls.push(url);return new Response(JSON.stringify(url==='/api/v2/session'?{workspaceId:'bob'}:{ok:true}),{status:200})})
 await ensureSession();expect(await productRequest('/api/v2/library')).toEqual({ok:true})
 expect(calls).toEqual(['/api/v2/session','/api/v2/library']);expect(localStorage.getItem(workspace)).toBe('bob')
 expect(localStorage.getItem('tp-private')).toBeNull();expect(sessionStorage.getItem('threadpeak-draft')).toBeNull()
 const backup=await readAccountBackup('alice');expect(backup?.local['tp-private']).toBe(draft);expect(backup?.session['threadpeak-draft']).toBe('unsent')
 await switchWorkspace('alice');expect(localStorage.getItem('tp-private')).toBe(draft);expect(sessionStorage.getItem('threadpeak-draft')).toBe('unsent')
})
test('partial restoration leaves login usable, exposes recovery and preserves missing drafts across later switches',async()=>{
 localStorage.setItem(workspace,'alice');localStorage.setItem('tp-private','x'.repeat(4000))
 await switchWorkspace('bob');const limited=quota(200)
 await switchWorkspace('alice');expect(localStorage.getItem(workspace)).toBe('alice');expect(localStorage.getItem('tp-private')).toBeNull();expect(accountRecoveryAvailable()).toBe(true)
 await switchWorkspace('bob');expect(accountRecoveryAvailable()).toBe(false)
 limited.mockRestore();await switchWorkspace('alice');expect(localStorage.getItem('tp-private')).toBe('x'.repeat(4000));expect(accountRecoveryAvailable()).toBe(false)
})
test('when both persistent stores fail, the actionable error leaves every original byte and account boundary intact',async()=>{
 localStorage.setItem(workspace,'alice');localStorage.setItem('tp-private','draft')
 vi.stubGlobal('indexedDB',{open:()=>{throw new DOMException('denied','SecurityError')}});quota(50)
 await expect(switchWorkspace('bob')).rejects.toThrow('请先导出本地备份')
 expect(localStorage.getItem('tp-private')).toBe('draft');expect(localStorage.getItem(workspace)).toBe('alice')
 expect(accountRecoveryAvailable()).toBe(true);expect((await accountStorageForExport()).local['tp-private']).toBe('draft')
})

import {clearProductLibrary,refreshProductLibrary} from '../../src/learning-v2/library'
test('library establishes the new account before choosing its generation, so login needs no second manual refresh',async()=>{
 localStorage.setItem(workspace,'alice');localStorage.setItem('tp-private','alice draft');clearProductLibrary()
 const library={paths:[],knowledge:[],conversations:[]}
 vi.stubGlobal('fetch',async(url:string)=>new Response(JSON.stringify(url==='/api/v2/session'?{workspaceId:'bob'}:library),{status:200}))
 await expect(refreshProductLibrary()).resolves.toEqual(library)
 expect(localStorage.getItem('tp-private')).toBeNull();expect(localStorage.getItem(workspace)).toBe('bob')
 clearProductLibrary()
})

test('reload reconstructs pending recovery from IndexedDB without calling session HTTP',async()=>{
 localStorage.setItem(workspace,'alice');localStorage.setItem('tp-private','x'.repeat(4000));await switchWorkspace('bob')
 const limited=quota(200);await switchWorkspace('alice')
 vi.resetModules()
 const fresh=await import('../../src/learning-v2/account-storage')
 expect(fresh.accountRecoveryAvailable()).toBe(false)
 const fetch=vi.fn(()=>Promise.reject(Error('offline')));vi.stubGlobal('fetch',fetch)
 await fresh.refreshAccountRecovery();expect(fresh.accountRecoveryAvailable()).toBe(true);expect(fetch).not.toHaveBeenCalled()
 expect((await fresh.accountStorageForExport()).local['tp-private']).toBe('x'.repeat(4000))
 localStorage.setItem(workspace,'bob');await fresh.refreshAccountRecovery();expect(fresh.accountRecoveryAvailable()).toBe(false)
 limited.mockRestore()
})
