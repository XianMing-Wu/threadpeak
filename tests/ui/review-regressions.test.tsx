import {afterEach,expect,test,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {App} from '../../src/App'
import {SendControl} from '../../src/components/SendControl'
import {NodePrompt} from '../../src/learning-v2/NodePrompt'
import {serverProgressStorage} from '../../src/path-3d/server-progress-storage'
import {productRequest} from '../../src/learning-v2/client'
import {editPreview} from '../../src/learning-v2/edit-preview'
import {readPathLaunchAttachments,pathLaunchAttachments} from '../../src/path-planning/path-run-client'
import type {GraphNode} from '../../src/learning-v2/model'
vi.mock('../../src/learning-v2/client',async original=>({...await original<typeof import('../../src/learning-v2/client')>(),ensureSession:vi.fn().mockResolvedValue(undefined),productRequest:vi.fn()}))
vi.mock('../../src/components/Shell',()=>({WideShell:({children}:{children:React.ReactNode})=><main>{children}</main>}))
vi.mock('../../src/pages/Collections',async()=>{
 const {useState}=await import('react')
 const Page=()=>{const [selected]=useState(()=>location.hash);return <p>{selected}</p>}
 return {PathsPage:Page,Path3DPage:Page,KnowledgePage:Page,KnowledgeDetailPage:Page}
})
afterEach(()=>{cleanup();sessionStorage.clear();localStorage.clear();vi.resetAllMocks();history.replaceState(null,'','/#home')})

test('same-route query changes re-open the selected resource and an old OAuth failure cannot mask a valid session',async()=>{
 history.replaceState(null,'','/?oauth=failed#paths?tab=mine')
 render(<App/>);await screen.findByText('#paths?tab=mine')
 expect(location.search).toBe('');expect(document.title).toBe('学习路线 · 问山 ThreadPeak')
 act(()=>{location.hash='paths?tab=example';window.dispatchEvent(new Event('hashchange'))})
 await screen.findByText('#paths?tab=example');expect(screen.queryByText('#paths?tab=mine')).toBeNull()
})

test('IME composition blocks pointer sending until committed but never disables explicit stop',()=>{
 const send=vi.fn(),stop=vi.fn(),view=render(<><textarea aria-label="草稿"/><SendControl onSend={send}/></>)
 const input=screen.getByRole('textbox');input.focus();fireEvent.compositionStart(input)
 fireEvent.pointerDown(screen.getByRole('button'));fireEvent.compositionEnd(input);fireEvent.click(screen.getByRole('button'));expect(send).not.toHaveBeenCalled()
 fireEvent.pointerDown(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));expect(send).toHaveBeenCalledOnce()
 view.rerender(<><textarea aria-label="草稿"/><SendControl busy onSend={send} onStop={stop}/></>)
 input.focus();fireEvent.compositionStart(input);fireEvent.click(screen.getByRole('button',{name:'停止生成'}));expect(stop).toHaveBeenCalledOnce()
 fireEvent.compositionEnd(input)
})

test('a floating prompt cycles keyboard focus and restores its opener on close',()=>{
 const node:GraphNode={id:'a',title:'依据',text:'内容',type:'custom',parents:['root'],sources:[]}
 const opener=document.createElement('button');document.body.append(opener);opener.focus()
 const view=render(<NodePrompt mode="ai" nodes={[node]} depth="fast" onDepth={()=>{}} onClose={()=>{}} onSubmit={async()=>false}/>)
 const dialog=screen.getByRole('dialog'),controls=dialog.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[tabindex="0"]')
 controls[0].focus();fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(controls[controls.length-1])
 fireEvent.keyDown(dialog,{key:'Tab'});expect(document.activeElement).toBe(controls[0])
 view.unmount();expect(document.activeElement).toBe(opener);opener.remove()
})

test('null remote progress retains the opaque local blob, and an account switch fences queued writes',async()=>{
 const request=vi.mocked(productRequest),context={signal:new AbortController().signal},input={key:'path:review:doc:one',value:'opaque renderer state'}
 localStorage.setItem('tp-server-workspace','account-a');request.mockResolvedValue({value:null})
 const storage=serverProgressStorage('doc-one');await storage.write(input,context)
 expect(await storage.read({key:input.key},context)).toBe(input.value)
 let release!:(value:unknown)=>void
 request.mockImplementationOnce(async()=>await new Promise<unknown>(resolve=>{release=resolve}) as never)
 const first=storage.write({...input,value:'first'},context);await waitFor(()=>expect(release).toBeTypeOf('function'))
 const second=storage.write({...input,value:'second'},context);const rejected=expect(second).rejects.toThrow('ACCOUNT_CHANGED')
 localStorage.setItem('tp-server-workspace','account-b');release({saved:true});await first;await rejected
 expect(request.mock.calls.filter(([,options])=>options?.method==='PUT')).toHaveLength(2)
})

test('local edit preview and explicit conflict resolution retain a concurrently added card',()=>{
 const base:GraphNode[]=[{id:'root',title:'root',text:'',type:'root',parents:[],sources:[]},{id:'a',title:'a',text:'base',type:'custom',parents:['root'],sources:[]}]
 const local=base.map(n=>n.id==='a'?{...n,text:'my edit'}:n),remote=[...base.map(n=>n.id==='a'?{...n,text:'server edit'}:n),{...base[1],id:'new'}]
 const preview=editPreview(base,local,remote)
 expect(preview.map(n=>n.id)).toEqual(['root','a','new']);expect(preview[1].text).toBe('my edit');expect(remote[1].text).toBe('server edit')
})

test('refresh restores only server material IDs for the immutable launch even after the memory map disappears',()=>{
 sessionStorage.setItem('tp-launch-materials:chat','[{"sourceId":"owned-source"}]')
 pathLaunchAttachments.clear();expect(readPathLaunchAttachments('chat')).toEqual([{sourceId:'owned-source'}])
 sessionStorage.setItem('tp-launch-materials:chat','broken');expect(()=>readPathLaunchAttachments('chat')).toThrow('原选择仍保留')
 expect(sessionStorage.getItem('tp-launch-materials:chat')).toBe('broken')
})
