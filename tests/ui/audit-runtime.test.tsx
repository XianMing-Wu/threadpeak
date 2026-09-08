import {afterEach,expect,test,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react'
import {PageBoundary} from '../../src/components/PageBoundary'
import {foregroundDelay,pollResource,taskPollInterval} from '../../src/learning-v2/poll'
import {refreshProductLibrary,clearProductLibrary} from '../../src/learning-v2/library'
import {ensureSession,productRequest} from '../../src/learning-v2/client'
vi.mock('../../src/learning-v2/client',async importOriginal=>({...await importOriginal<typeof import('../../src/learning-v2/client')>(),ensureSession:vi.fn().mockResolvedValue(undefined),productRequest:vi.fn()}))
vi.mock('../../src/workspace/store',()=>({hydrateProductLibrary:vi.fn()}))
afterEach(()=>{cleanup();clearProductLibrary();vi.restoreAllMocks();vi.useRealTimers()})
test('library gathers all pages before publishing and rejects stale account pages',async()=>{
 const item=(id:string)=>({id,resourceId:id,kind:'chat',title:id,query:id,updatedAt:1})
 vi.mocked(productRequest).mockResolvedValueOnce({paths:[],knowledge:[],conversations:[item('one')],nextCursor:'next'}).mockResolvedValueOnce({paths:[],knowledge:[],conversations:[item('two')]})
 const data=await refreshProductLibrary();expect(data.conversations.map(c=>c.id)).toEqual(['one','two']);expect(productRequest).toHaveBeenLastCalledWith('/api/v2/library?cursor=next')
 clearProductLibrary()
 vi.mocked(productRequest).mockImplementationOnce(async()=>{clearProductLibrary();return {paths:[],knowledge:[],conversations:[item('stale')]} as never})
 await expect(refreshProductLibrary()).rejects.toThrow('账号已改变')
 expect(ensureSession).toHaveBeenCalled()
})
test('adaptive polling and focus/visibility/command wakes keep one cancellable wait',async()=>{
 vi.useFakeTimers();vi.spyOn(document,'hidden','get').mockReturnValue(false)
 expect(taskPollInterval('running')).toBe(1000);expect(taskPollInterval('completed')).toBe(5000)
 for(const name of ['focus','threadpeak:resource-change']){
  const finished=vi.fn();const pending=foregroundDelay(30000).then(finished);window.dispatchEvent(new Event(name));await pending;expect(finished).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0)
 }
 const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);expect(taskPollInterval()).toBe(30000)
 const woke=vi.fn(),pending=foregroundDelay(30000).then(woke);document.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();expect(woke).not.toHaveBeenCalled();hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));await pending
 const abort=new AbortController(),cancelled=foregroundDelay(30000,abort.signal);abort.abort(Error('stop'));await expect(cancelled).rejects.toThrow('stop');expect(vi.getTimerCount()).toBe(0)
 let status='running',count=0;const waits:number[]=[]
 await pollResource(async()=>{count++;if(count===2)status='completed';if(count===3)return false},{signal:new AbortController().signal,intervalMs:()=>taskPollInterval(status),wait:async ms=>{waits.push(ms)}})
 expect(waits).toEqual([1000,5000])
})
test('page error boundary offers a working retry without remounting the app shell',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{})
 let fail=true
 function Page(){if(fail)throw Error('render failed');return <p>内容恢复</p>}
 render(<PageBoundary><Page/></PageBoundary>)
 expect(screen.getByRole('alert').textContent).toContain('这个页面暂时未能显示')
 fail=false;await act(async()=>fireEvent.click(screen.getByRole('button',{name:'重试显示'})))
 expect(screen.getByText('内容恢复')).toBeTruthy()
})
