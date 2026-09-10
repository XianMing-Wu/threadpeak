import {afterEach,expect,test,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import {ChatRoutePanel} from '../../src/path-planning/chat-route-panel'
import {createElement,StrictMode} from 'react'
import {openDatabase,migrate} from '../../server/durable/database'
import {DurableStore} from '../../server/durable/store'
import {DurableWorker} from '../../server/durable/worker'
import {ProductTools} from '../../server/durable/tools'
import {createFlows} from '../../server/durable/flows'
import {createProductApp} from '../../server/durable/http'
import {OrdinaryChat} from '../../src/learning-v2/OrdinaryChat'
import {LearningWorkspace} from '../../src/learning-v2/Workspace'
import {MineGraphCanvasPage} from '../../src/knowledge-canvas/mine-graph-canvas'
import {resetSession} from '../../src/learning-v2/client'
import {clearProductLibrary} from '../../src/learning-v2/library'
import {hydrateProductLibrary,getRoute,getConversation,createHomeConversation,saveConversation} from '../../src/workspace/store'
import {PROJECTION_KEY,LEGACY_WORKSPACE_KEY,readMergedSnapshot,readSnapshot,writeProjection} from '../../src/workspace/snapshot-cache'
import {buildPathDocument} from '../../src/pathDocument'
import {switchWorkspace} from '../../src/learning-v2/account-storage'

afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear();resetSession();clearProductLibrary();vi.restoreAllMocks()})
const document=buildPathDocument({id:'doc',title:'服务端路线',description:'目标',goalTitle:'完成目标',goalSummary:'成果',startSummary:'开始',carriers:[{id:'carrier',title:'载体',summary:'载体',concepts:[['concept','概念','说明']]}]})
const empty=()=>({version:1 as const,routes:[],knowledge:[],conversations:[],lessons:{}})
async function backend(){
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,createFlows(new ProductTools({complete:async input=>{input.onText?.('这是 provider 边界的离线回答。');return {kind:'completed',text:'这是 provider 边界的离线回答。'}}},{search:async()=>({kind:'empty'})},64000)),1,()=>{}),app=await createProductApp({store,worker,providersReady:true,identity:{production:false}})
 let cookie='';const calls:string[]=[]
 vi.stubGlobal('fetch',async(url:string,init:RequestInit={})=>{
  calls.push(url)
  const headers={...init.headers,cookie} as Record<string,string>
  const response=await app.inject({url,method:(init.method??'GET') as 'GET',headers,...(typeof init.body==='string'?{payload:init.body}:{})})
  if(response.headers['set-cookie'])cookie=String(response.headers['set-cookie']).split(';')[0]
  return new Response(response.body,{status:response.statusCode,headers:response.headers as Record<string,string>})
 })
 await fetch('/api/auth/guest',{method:'POST'})
 return {store,app,calls,close:async()=>{await app.close();await db.close();vi.unstubAllGlobals()}}
}

test('real OrdinaryChat submits through the actual API and runs the actual workflow and displays the committed provider-boundary answer',async()=>{
 const server=await backend()
 try{
  render(createElement(OrdinaryChat,{chatId:'review-chat',question:'解释一个真实问题',initialDepth:'fast'}))
  await waitFor(()=>expect(screen.getAllByText('解释一个真实问题').length).toBeGreaterThan(1))
  await screen.findByText('这是 provider 边界的离线回答。',{}, {timeout:10000})
  await waitFor(async()=>expect((await server.store.db.query<{status:string}>('SELECT status FROM tp_jobs'))[0].status).toBe('completed'))
  expect(server.calls).toContain('/api/v2/chats/enter')
  const jobs=await server.store.db.query<{kind:string;input:{question:string}}>('SELECT * FROM tp_jobs')
  expect(jobs).toHaveLength(1);expect(jobs[0].kind).toBe('chat.reply')
  expect(server.calls.some(url=>/^\/api\/(answers|learning\/|ask-author)/.test(url))).toBe(false)
 }finally{cleanup();await server.close()}
})
test('real learning component opens the server resource and new conversation retains articles and tree',async()=>{
 const server=await backend()
 try{
  await fetch('/api/v2/session')
  const owner=(await server.store.db.query<{owner_id:string}>('SELECT owner_id FROM tp_sessions'))[0].owner_id
  const state={version:2,routeId:'route',conceptId:'concept',title:'概念',description:'说明',hasDispute:false,initialized:true,phase:'ready',active:'first',articles:[{id:'article',title:'已保存资料',summary:'已有资料正文',author:'资料作者',authorId:null,likes:null,topic:'概念',sourceKind:'upload'}],nodes:[{id:'root',type:'root',title:'概念',text:'旧的根正文',parents:[],sources:[]}],conversations:[{id:'first',title:'已有对话',date:'2026-09-07',messages:[{id:'answer',role:'assistant',text:'已经保存的答案'}]}]}
  const resource=await server.store.create(owner,'learning','scope',state)
  render(createElement(LearningWorkspace,{resourceId:resource.id,routeId:'',conceptId:''}))
  await screen.findByText('已经保存的答案')
  fireEvent.click(screen.getByRole('button',{name:'新对话'}))
  await waitFor(()=>expect(screen.queryByText('已经保存的答案')).toBeNull())
  const saved=await server.store.snapshot(owner,resource.id)
  expect(saved.data.nodes).toEqual(state.nodes);expect(saved.data.articles).toEqual(state.articles);expect(saved.data.conversations).toHaveLength(2)
  expect(saved.data.conversations[0].messages[0].text).toBe('已经保存的答案')
 }finally{cleanup();await server.close()}
})
test('opening a legacy knowledge archive is readable and does not fetch or write storage',()=>{
 const knowledge={id:'old-knowledge',routeId:'old-route',owner:'mine',title:'旧内容',description:'归档',icon:'book',sources:1,type:'旧知识',seedConceptId:'concept',createdAt:1,updatedAt:1,graphs:{concept:{nodes:[{id:'root',accent:'#000',title:'旧卡片',role:'flow',turns:[{question:'旧问题',replyKind:'full',paragraphs:['不可丢失的知识正文']}]}],edges:[]}},graph:{nodes:[],edges:[]}}
 localStorage.setItem(LEGACY_WORKSPACE_KEY,JSON.stringify({...empty(),knowledge:[knowledge]}))
 const raw=localStorage.getItem(LEGACY_WORKSPACE_KEY),fetch=vi.fn().mockRejectedValue(Error('404')),write=vi.spyOn(Storage.prototype,'setItem')
 vi.stubGlobal('fetch',fetch)
 render(createElement(MineGraphCanvasPage,{routeId:'old-route',conceptId:'concept'}))
 expect(screen.getByText('不可丢失的知识正文')).toBeTruthy();expect(fetch).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe(raw)
 vi.unstubAllGlobals()
})
test('projection hydration retains draft fields, uses server title and never overwrites the legacy archive',()=>{
 const legacy=JSON.stringify(empty());localStorage.setItem(LEGACY_WORKSPACE_KEY,legacy)
 const draft=createHomeConversation('过时标题','route');saveConversation(draft.id,{pathRunId:'server-path',value:'尚未发送的输入'})
 hydrateProductLibrary({paths:[{id:'server-path',goal:'目标',document,updatedAt:100}],knowledge:[],conversations:[{id:'server-path',resourceId:'server-path',kind:'path',title:'服务端标题',query:'服务端目标',updatedAt:100,routeId:'server-path'}]})
 expect(getConversation('server-path')?.title).toBe('服务端标题');expect(getConversation('server-path')?.value).toBe('尚未发送的输入')
 expect(getRoute('server-path')?.document).toEqual(document);expect(getRoute('not-real')).toBeUndefined();expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe(legacy)
})
test('damaged legacy/projection bytes survive future writes and reads do not write or repeatedly parse',()=>{
 localStorage.setItem(LEGACY_WORKSPACE_KEY,'{broken legacy');localStorage.setItem(PROJECTION_KEY,'{broken projection')
 const parse=vi.spyOn(JSON,'parse'),write=vi.spyOn(Storage.prototype,'setItem')
 readMergedSnapshot();readMergedSnapshot();expect(parse).toHaveBeenCalledTimes(2);expect(write).not.toHaveBeenCalled()
 writeProjection(empty());expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe('{broken legacy')
 expect(Object.keys(localStorage).some(k=>k.startsWith(PROJECTION_KEY+':recovery:')&&localStorage.getItem(k)==='{broken projection')).toBe(true)
 expect(readSnapshot(PROJECTION_KEY).conversations).toEqual([])
})
test('account switching clears both key prefixes and restores only the matching account archive',async()=>{
 localStorage.setItem('tp-server-workspace','alice');localStorage.setItem('tp-private','alice-only');localStorage.setItem(LEGACY_WORKSPACE_KEY,'alice archive');sessionStorage.setItem('tp-route','draft')
 await switchWorkspace('bob');expect(localStorage.getItem('tp-private')).toBeNull();expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBeNull();expect(sessionStorage.getItem('tp-route')).toBeNull()
 await switchWorkspace('alice');expect(localStorage.getItem('tp-private')).toBe('alice-only');expect(localStorage.getItem(LEGACY_WORKSPACE_KEY)).toBe('alice archive')
})

test('StrictMode mount replay still starts exactly one durable route and preserves recoverable failure',async()=>{
 const server=await backend()
 try{
  const conversation=createHomeConversation('路线挂载恢复回归','route')
  render(createElement(StrictMode,null,createElement(ChatRoutePanel,{conversationId:conversation.id,query:conversation.query,onRouteReady:()=>{}})))
  await screen.findByText('这次还没完成，已收集的资料和选择都已保留。',{}, {timeout:10000})
  const jobs=await server.store.db.query<{status:string}>('SELECT status FROM tp_jobs')
  expect(jobs).toHaveLength(1);expect(jobs[0].status).toBe('waiting')
  expect(screen.queryByText('生成已停止。')).toBeNull()
 }finally{cleanup();await server.close()}
})

import {attachLibraryProjection,getLibraryProjectionStore} from '../../src/runtime/library-projection-store'
test('account change immediately invalidates cached local route projections',async()=>{
 localStorage.setItem('tp-server-workspace','alice')
 hydrateProductLibrary({paths:[{id:'old-account-route',goal:'old',document,updatedAt:1}],knowledge:[],conversations:[]})
 const detach=attachLibraryProjection()
 try{
  expect(getLibraryProjectionStore().getSnapshot().view.routes.mine.length).toBe(1)
  await switchWorkspace('bob')
  expect(getLibraryProjectionStore().getSnapshot().view.routes.mine).toEqual([])
 }finally{detach()}
})

test.each(['knowledge','app'])('offline %s entry discovers a persisted recovery notice without a working session',async(entry)=>{
 localStorage.setItem('tp-server-workspace','offline-owner')
 await new Promise<void>((resolve,reject)=>{
  const open=indexedDB.open('threadpeak-account-backups',1)
  open.onupgradeneeded=()=>open.result.createObjectStore('accounts')
  open.onerror=()=>reject(open.error)
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').put({local:{'tp-private':'retained draft'},session:{},pendingLocal:['tp-private'],pendingSession:[]},'offline-owner');tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}}
 })
 vi.stubGlobal('fetch',()=>Promise.reject(Error('offline')))
 const Page=entry==='knowledge'?(await import('../../src/pages/Collections')).KnowledgePage:(await import('../../src/App')).App
 render(createElement(Page))
 await screen.findByRole('alert')
 expect(await screen.findByRole('button',{name:'导出本地备份'})).toBeTruthy()
})

test('an interview remains usable while catalogs are running and shows why each question matters',async()=>{
 const server=await backend()
 try{
  await fetch('/api/v2/session')
  const owner=(await server.store.db.query<{owner_id:string}>('SELECT owner_id FROM tp_sessions'))[0].owner_id
  const questions=Array.from({length:4},(_,i)=>({id:`q${i}`,prompt:`目标条件${i}`,reason:`这会改变第${i}部分的学习范围`,options:[0,1,2].map(j=>({id:`q${i}-o${j}`,label:`我的条件${i}-${j}`,routeEffect:`影响${j}`}))}))
  const resource=await server.store.create(owner,'path','parallel-ui',{workflow:'route-direct-v6',goal:'做网页',depth:'fast',attachments:[],status:'awaiting_answers',research:{firstSearch:{summary:'选择差异'},catalogSearch:{summary:''},catalogCarriers:['课A','课B'],ready:false},questionSets:[{round:1,status:'active',message:'确认几个会影响路线的条件',questions,selectedOptionIds:{},customAnswers:{}}],conversation:[]})
  await server.store.enqueue(owner,resource.id,'path.start','preparing-ui',{depth:'fast'});await server.store.claim()
  const conversation=createHomeConversation('做网页','route');saveConversation(conversation.id,{pathRunId:resource.id})
  render(createElement(ChatRoutePanel,{conversationId:conversation.id,query:'做网页',onRouteReady:()=>{}}))
  await screen.findByText('这会改变第0部分的学习范围')
  const option=screen.getByRole('button',{name:/我的条件0-0/}) as HTMLButtonElement
  expect(option.disabled).toBe(false);fireEvent.click(option)
  fireEvent.click(screen.getAllByRole('button',{name:'继续'})[0])
  await waitFor(async()=>expect((await server.store.snapshot(owner,resource.id)).data.questionSets[0].selectedOptionIds.q0).toBe('q0-o0'))
  const saved=await server.store.snapshot(owner,resource.id);expect(saved.job?.status).toBe('running');expect(saved.data.research.ready).toBe(false)
 }finally{cleanup();await server.close()}
})

test('server history restores the same route with generate=false, while a missing restore identity cannot create a new run',async()=>{
 const server=await backend()
 try{
  await fetch('/api/v2/session')
  const owner=(await server.store.db.query<{owner_id:string}>('SELECT owner_id FROM tp_sessions'))[0].owner_id
  const questions=Array.from({length:2},(_,i)=>({id:`restore-q${i}`,prompt:`历史问题${i}`,reason:'保留已确认的范围',options:[0,1,2].map(j=>({id:`restore-q${i}-o${j}`,label:`历史条件${i}-${j}`,routeEffect:'调整范围'}))}))
  const resource=await server.store.create(owner,'path','server-history',{workflow:'route-direct-v6',goal:'恢复原路线',depth:'fast',attachments:[],status:'awaiting_answers',questionSets:[{round:1,status:'active',message:'恢复访谈',questions,selectedOptionIds:{},customAnswers:{}}],conversation:[]})
  const view=render(createElement(StrictMode,null,createElement(ChatRoutePanel,{conversationId:'history-entry',resourceId:resource.id,generate:false,query:'恢复原路线',onRouteReady:()=>{}})))
  await screen.findByText('历史问题0')
  expect(server.calls).toContain(`/api/path-runs/${resource.id}`);expect(server.calls).not.toContain('/api/path-runs')
  view.unmount()
  render(createElement(ChatRoutePanel,{conversationId:'missing-history-entry',generate:false,query:'丢失的恢复标识',onRouteReady:()=>{}}))
  await screen.findByText('未找到这次路线的恢复标识，请从历史记录重新打开。')
  expect(await server.store.db.query('SELECT id FROM tp_jobs')).toHaveLength(0)
  expect(await server.store.list(owner,'path')).toHaveLength(1)
 }finally{cleanup();await server.close()}
})
