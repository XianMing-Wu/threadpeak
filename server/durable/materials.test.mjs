import {placeAnswer} from '../../tests/fixtures/card-answer.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase,migrate } from './database.ts'
import { DurableStore,digest,CommandError } from './store.ts'
import { TaskContext,DurableWorker,ToolError } from './worker.ts'
import { ProductTools } from './tools.ts'
import { createFlows } from './flows.ts'
import { createProductApp } from './http.ts'
import { ZhihuDataClient } from './zhihu-data.ts'
import { ZhihuLogin,sealToken,unsealToken,loginConfig } from './zhihu-oauth.ts'
import { textUpload,inheritedArticles,preparePdf } from './materials.ts'
import { readAuthorNetwork } from './authors-network.ts'
const envelope=Data=>new Response(JSON.stringify({Code:0,Data}),{headers:{'content-type':'application/json'}})
const secret='test-only-encryption-key-32-characters-long'
const config={appId:'app',appKey:'test-app-key',redirectUri:'http://localhost/api/auth/zhihu/callback',origin:'http://localhost',tokenSecret:secret,userInfoUrl:'https://openapi.zhihu.com/test-profile-contract',userIdPath:'id',userNamePath:'name',production:false}
async function fixture(t,{api,loginFactory,llm,zhihu}={}){
  const db=await openDatabase();await migrate(db);const store=new DurableStore(db),login=loginFactory?.(db)
  const tools=new ProductTools(llm??{complete:async()=>{throw new Error('Unexpected LLM')}},zhihu??{search:async()=>({kind:'empty'}),direct:async()=>({kind:'completed',text:'直答材料'})})
  const handler=createFlows(tools,api,login),worker=new DurableWorker(store,handler,1,()=>{})
  const app=await createProductApp({store,worker,identity:{production:false},providersReady:true,zhihuData:api,zhihuLogin:login})
  t.after(async()=>{await app.close();await db.close()})
  const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0]
  const own=login?'account:zhihu:test-authorized':(await db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
  if(login)await db.query('UPDATE tp_sessions SET owner_id=$1',[own])
  async function finish(id){for(let i=0;i<300;i++){const s=await store.snapshot(own,id);if(['completed','waiting','cancelled'].includes(s.job?.status))return s;await new Promise(r=>setTimeout(r,10))}throw new Error('job did not finish')}
  return {db,store,app,cookie,own,handler,finish}
}
test('upload .markdown, idempotence, owner isolation and server-owned source content',async t=>{
  const {app,cookie,own,store}=await fixture(t),headers={cookie,'content-type':'application/octet-stream','idempotency-key':'same-material-upload'}
  const body='# 正文\n\n从第一行到最后一行。',upload=await app.inject({method:'POST',url:'/api/v2/materials/upload?name=notes.markdown',headers,payload:Buffer.from(body)})
  assert.equal(upload.statusCode,200,upload.body);assert.equal(upload.json().content,body);assert.equal(upload.json().status,'ready')
  assert.equal((await app.inject({method:'POST',url:'/api/v2/materials/upload?name=notes.markdown',headers,payload:Buffer.from(body)})).json().sourceId,upload.json().sourceId)
  assert.equal((await app.inject({method:'POST',url:'/api/v2/materials/upload?name=notes.markdown',headers,payload:Buffer.from('different')})).statusCode,409)
  const other=await app.inject({method:'POST',url:'/api/auth/guest'}),otherCookie=String(other.headers['set-cookie']).split(';')[0]
  assert.equal((await app.inject({url:`/api/v2/materials/${upload.json().sourceId}`,headers:{cookie:otherCookie}})).statusCode,404)
  // Don't start the worker for route generation; inspect accepted immutable command inputs.
  const record=await store.resource(own,upload.json().sourceId);assert.equal(record.body.rawContent,body)
  assert.throws(()=>textUpload('bad.txt',Buffer.from([0xff,0xfe,0xfd])),e=>e.code==='TEXT_ENCODING')
  assert.throws(()=>textUpload('bad.exe',Buffer.from('text')),e=>e.code==='ATTACHMENT_INVALID')
})
test('PDF async API persists summary and every page, sends no platform credential to signed result URL',async t=>{
  const calls=[]
  const api=new ZhihuDataClient('platform-secret',async(raw,init)=>{
    const url=new URL(raw);calls.push(url.pathname)
    if(url.hostname.endsWith('bcebos.com')){assert.equal(init.headers,undefined);return new Response(JSON.stringify({pages:[{blocks:[{type:'text',content:'第一页正文'}]},{blocks:[{type:'future-kind',content:'最后一页正文'}]}]}))}
    assert.equal(init.headers.Authorization,'Bearer platform-secret')
    if(url.pathname==='/resources/v1/files'){assert.ok(init.body instanceof FormData);return envelope({file_id:'pdf-file'})}
    if(url.pathname==='/api/v1/pdf-parse/tasks'){assert.match(init.headers['Idempotency-Key'],/^threadpeak-pdf-/);return envelope({task_id:'pdf-task'})}
    return envelope({task_status:'succeeded',result:{url:'https://zhihu-openapi.bj.bcebos.com/result.json',summary:'涵盖全部页面的 API 总结'}})
  })
  const {app,cookie,store,own,finish,db}=await fixture(t,{api})
  const upload=await app.inject({method:'POST',url:'/api/v2/materials/upload?name=book.pdf',headers:{cookie,'content-type':'application/octet-stream','idempotency-key':'fixture-material-upload'},payload:Buffer.from('%PDF-1.7\ncontrolled-test')})
  assert.equal(upload.statusCode,200);const id=upload.json().sourceId;assert.equal(upload.json().status,'processing')
  const snapshot=await finish(id);assert.equal(snapshot.job.status,'completed',JSON.stringify(snapshot.job));assert.equal(snapshot.data.content,'涵盖全部页面的 API 总结')
  assert.equal(snapshot.data.rawContent,'第一页正文\n\n最后一页正文');assert.equal((await db.query('SELECT * FROM tp_material_uploads')).length,0)
  assert.equal(calls.filter(c=>c==='/resources/v1/files').length,1)
  assert.equal((await store.resource(own,id)).body.status,'ready')
})
test('PDF without API summary uses real summary port over all parsed text',async t=>{
  let input='';const api=new ZhihuDataClient('key',async(raw)=>{const u=new URL(raw);if(u.hostname.endsWith('bcebos.com'))return new Response(JSON.stringify({pages:[{blocks:[{content:'开头范围。'}]},{blocks:[{content:'结尾限制。'}]}]}));return envelope(u.pathname==='/resources/v1/files'?{file_id:'file'}:u.pathname.endsWith('/tasks')?{task_id:'task'}:{task_status:'succeeded',result:{url:'https://data.bcebos.com/result'}})})
  const {app,cookie,finish}=await fixture(t,{api,llm:{complete:async args=>{input=JSON.parse(args.messages[1].content).text;return {kind:'completed',text:'开头范围与结尾限制。'}}}})
  const res=await app.inject({method:'POST',url:'/api/v2/materials/upload?name=x.pdf',headers:{cookie,'content-type':'application/octet-stream','idempotency-key':'fixture-material-upload'},payload:Buffer.from('%PDF-1.7\ntest')})
  const final=await finish(res.json().sourceId);assert.equal(final.job.status,'completed');assert.match(input,/开头范围/);assert.match(input,/结尾限制/);assert.equal(final.data.content,'开头范围与结尾限制。')
})
test('OAuth state is bound, single use; stable identity and encrypted token never leak in response',async t=>{
  const {db}=await fixture(t),login=new ZhihuLogin(db,config,async(url,init)=>{
    if(url.endsWith('/access_token')){assert.ok(init.body instanceof URLSearchParams);assert.equal(init.body.get('grant_type'),'authorization_code');return new Response(JSON.stringify({access_token:'user-secret-token',expires_in:3600}))}
    assert.equal(init.headers.Authorization,'Bearer user-secret-token');return new Response(JSON.stringify({id:'actual-user-id',name:'测试用户'}))
  })
  const a=await login.start(),state=new URL(a.authorizeUrl).searchParams.get('state'),binding=a.cookie.split(';')[0].slice(15)
  await assert.rejects(login.callback('code',state,'wrong'),e=>e.code==='OAUTH_STATE_INVALID')
  const cookie=await login.callback('code',state,binding);assert.doesNotMatch(cookie,/user-secret|actual-user/)
  await assert.rejects(login.callback('code',state,binding),e=>e.code==='OAUTH_STATE_INVALID')
  const [account]=await db.query('SELECT * FROM tp_zhihu_accounts');assert.doesNotMatch(account.token_cipher,/user-secret/);assert.equal(await login.userToken(account.owner_id),'user-secret-token')
  const again=await login.start();await login.callback('second',new URL(again.authorizeUrl).searchParams.get('state'),again.cookie.split(';')[0].slice(15));assert.equal((await db.query('SELECT * FROM tp_zhihu_accounts')).length,1)
  await db.query('UPDATE tp_zhihu_accounts SET token_expires_at=0');await assert.rejects(login.userToken(account.owner_id),e=>e.code==='ZHIHU_REAUTHORIZE')
  assert.equal(unsealToken(sealToken('x',secret),secret),'x');assert.throws(()=>unsealToken(sealToken('x',secret),secret+'wrong'))
  assert.equal(loginConfig({ZHIHU_OAUTH_APP_ID:'app',ZHIHU_OAUTH_APP_KEY:'key',ZHIHU_OAUTH_REDIRECT_URI:config.redirectUri}),undefined)
})
test('collections import follows pagination with end-user token and groups one author across articles without preference inflation',async t=>{
  let pages=0
  const item=(n)=>({Title:`内容${n}`,Summary:`第${n}篇公开摘要`,Url:`https://zhuanlan.zhihu.com/p/${n}`,LikeCount:n,Author:{Name:'同一作者',UrlToken:'actual-author',Url:'https://www.zhihu.com/people/actual-author'}})
  const api=new ZhihuDataClient('platform',async(raw,init)=>{
    assert.equal(init.headers['X-OAuth-Token'],'user-token');const u=new URL(raw)
    if(u.pathname.endsWith('/favlists'))return envelope({Items:[{Title:'我的数学收藏',UrlToken:123,IsPublic:true}]})
    pages++;return envelope({Items:[item(pages)],Paging:{IsEnd:pages===2,NextOffset:'50'}})
  })
  const {app,cookie,own,db,finish}=await fixture(t,{api,loginFactory:()=>({userToken:async()=> 'user-token'})})
  const res=await app.inject({method:'POST',url:'/api/v2/materials/zhihu',headers:{cookie,'idempotency-key':'fixture-zhihu-import'},payload:{kind:'collection',folderId:'123'}})
  assert.equal(res.statusCode,200,res.body);const snapshot=await finish(res.json().sourceId);assert.equal(snapshot.job.status,'completed',JSON.stringify(snapshot.job));assert.equal(snapshot.data.entries.length,2)
  const network=await readAuthorNetwork(db,own);assert.equal(network.authors.length,1);assert.equal(network.authors[0].evidence.length,2);assert.equal(network.authors[0].topics[0].score,0);assert.equal(network.authors[0].topics[0].uses,0)
  await assert.rejects(api.user('contents','',{}),e=>e.code==='ZHIHU_LOGIN_REQUIRED')
})
test('all route materials appear in every concept, guide first-learning prompts, and survive a new conversation',async t=>{
  const contexts=[];const llm={complete:async({messages})=>{const input=JSON.parse(messages[1].content);contexts.push(input);let out
    if(input.concept&&input.materials)out={queries:['基是什么','基的解释','基的应用']}
    else if(input.citationCatalog)out=placeAnswer(input)
    else if(input.read_card_scope)out={sourceReview:input.read_card_scope.cards.map(c=>({ref:c.ref,contribution:'相关资料'})),sections:[{after:'C1',title:'基的直观解释',text:'用二维具体例子理解坐标。'}]}
    else throw new Error('unexpected input')
    return {kind:'completed',text:JSON.stringify(out)}
  }}
  const direct=[];const {app,cookie,own,store,finish}=await fixture(t,{llm,zhihu:{search:async()=>({kind:'empty'}),direct:async(input)=>{direct.push(JSON.parse(input.messages[1].content.slice(input.messages[1].content.indexOf('\n{')+1)));return{kind:'completed',text:'二维解释'}}}})
  const attachments=[{sourceId:'file-one',fileName:'课程.markdown',mimeType:'text/markdown',content:'二维具体例子，先坐标后换基。'}]
  await store.create(own,'path','route',{status:'published',attachments,document:{id:'doc'},route:{concepts:['one','two'].map(id=>({id,title:'基',detailedDescription:'用例子理解',hasDispute:false}))}})
  for(const conceptId of ['one','two']){
    const r=await app.inject({method:'POST',url:'/api/v2/learning/enter',headers:{cookie},payload:{routeId:'doc',conceptId}})
    assert.equal(r.statusCode,200,r.body);assert.equal(r.json().data.articles.length,1)
    const s=await finish(r.json().id);assert.equal(s.job.status,'completed',JSON.stringify(s.job));assert.equal(s.data.nodes[1].text,attachments[0].content)
    const next=await app.inject({method:'POST',url:`/api/v2/learning/${r.json().id}/commands`,headers:{cookie},payload:{kind:'new-conversation',conversationId:`new-${conceptId}`}})
    assert.equal(next.json().data.articles.length,1);assert.equal(next.json().data.conversations.at(-1).messages.length,0)
  }
  assert.equal(direct.length,0);assert.equal(contexts.filter(c=>c.mode==='first_learning').length,2)
  assert.ok(contexts.filter(c=>c.read_card_scope).every(c=>c.read_card_scope.cards[0].content===attachments[0].content))
  assert.equal(inheritedArticles(attachments)[0].url,undefined)
})

test('recent collections use their non-paged contract and never query developer-owned contents',async t=>{
  const api=new ZhihuDataClient('platform',async(raw,init)=>{assert.equal(init.headers['X-OAuth-Token'],'user-token');assert.equal(new URL(raw).pathname,'/api/v1/user/collections');return envelope({Items:[{Title:'最近收藏的内容',Summary:'公开摘要',Url:'https://www.zhihu.com/answer/27'}]})})
  const {app,cookie,finish}=await fixture(t,{api,loginFactory:()=>({userToken:async()=> 'user-token'})})
  const result=await app.inject({method:'POST',url:'/api/v2/materials/zhihu',headers:{cookie,'idempotency-key':'fixture-zhihu-import'},payload:{kind:'recent'}})
  assert.equal(result.statusCode,200);const snapshot=await finish(result.json().sourceId);assert.equal(snapshot.job.status,'completed');assert.equal(snapshot.data.entries.length,1);assert.equal(snapshot.data.entries[0].authorId,null)
})
test('author identity is reconciled only by an exact content URL, never by a shared display name',async()=>{
  const {knownSourceIdentity}=await import('./authors-network.ts')
  const network={version:3,authors:[{id:'https://www.zhihu.com/people/a',name:'同名',identity:'platform',authorUrl:'https://www.zhihu.com/people/a',topics:[],evidence:[{url:'https://zhuanlan.zhihu.com/p/12?utm_source=original'}]}]}
  const source={authorId:'author-ev-unknown',authorName:'同名',url:'https://zhuanlan.zhihu.com/p/12?utm_source=search'}
  assert.equal(knownSourceIdentity(source,network).authorId,network.authors[0].id)
  assert.equal(knownSourceIdentity({...source,url:'https://zhuanlan.zhihu.com/p/13'},network).authorId,source.authorId)
})
test('expired login cannot fall back to the platform owner when importing a folder',async t=>{
  let calls=0;const api=new ZhihuDataClient('platform',async()=>{calls++;return envelope({Items:[]})})
  const {app,cookie}=await fixture(t,{api,loginFactory:()=>({userToken:async()=>{throw new CommandError('ZHIHU_REAUTHORIZE',401)}})})
  const result=await app.inject({method:'POST',url:'/api/v2/materials/zhihu',headers:{cookie,'idempotency-key':'fixture-zhihu-import'},payload:{kind:'collection',folderId:'123'}})
  assert.equal(result.statusCode,401);assert.equal(calls,0)
})

test('collection Int64 IDs remain exact and list requests obey the official 50-item limit',async t=>{
 const id='9223372036854775806'
 const api=new ZhihuDataClient('platform',async(raw)=>{
  const url=new URL(raw)
  assert.equal(url.searchParams.get('Limit'),'50')
  if(url.pathname.endsWith('/favlists'))return new Response(`{"Code":0,"Data":{"Items":[{"Title":"大编号收藏","IsPublic":true,"UrlToken":${id}}]}}`)
  assert.equal(url.searchParams.get('FavlistUrlToken'),id)
  return envelope({Items:[{Title:'线性代数',Summary:'矩阵是线性变换的表示。',Url:'https://zhuanlan.zhihu.com/p/1'}],Paging:{IsEnd:true}})
 })
 const {app,cookie,finish}=await fixture(t,{api,loginFactory:()=>({userToken:async()=> 'user-token'})})
 const folders=await app.inject({url:'/api/v2/zhihu/folders',headers:{cookie}})
 assert.equal(folders.json().items[0].id,id)
 const imported=await app.inject({method:'POST',url:'/api/v2/materials/zhihu',headers:{cookie,'idempotency-key':'large-folder-id'},payload:{kind:'collection',folderId:id}})
 assert.equal(imported.statusCode,200,imported.body)
 assert.equal((await finish(imported.json().sourceId)).job.status,'completed')
})

test('PDF original bytes survive a task-creation outage, expired file IDs renew, and commit cleans bytes',async t=>{
 const {store,db,own}=await fixture(t)
 const bytes=Buffer.from('%PDF-1.7\nsynthetic-only'),hash=digest(bytes.toString('base64'))
 const r=await store.create(own,'attachment','pdf-recovery',{fileName:'恢复.pdf',mimeType:'application/pdf',content:'',status:'processing',origin:'upload',hash,bytes:bytes.length})
 await db.query('INSERT INTO tp_material_uploads(resource_id,base64) VALUES($1,$2)',[r.id,bytes.toString('base64')])
 await store.enqueue(own,r.id,'material.pdf','pdf-recovery-task',{depth:'fast'})
 const job=await store.claim(),ctx=new TaskContext(store,job,new AbortController().signal)
 let uploads=0,fail=true
 const api={json:async(path,options)=>{
  if(path==='/resources/v1/files'){uploads++;return {file_id:`file-${uploads}`}}
  if(path==='/api/v1/pdf-parse/tasks'){if(fail)throw new ToolError('ZHIHU_HTTP_503');assert.equal(options.body.file_id,'file-2');return {task_id:'task-2'}}
  return {task_status:'succeeded',result:{url:'https://result.bcebos.com/file.json',summary:'全部页面的总结'}}
 },pdfResult:async()=>({pages:[{blocks:[{content:'保留第一页'}]},{blocks:[{content:'保留最后一页'}]}]})}
 await assert.rejects(preparePdf(ctx,{},api),e=>e.code==='ZHIHU_HTTP_503')
 assert.equal((await db.query('SELECT base64 FROM tp_material_uploads WHERE resource_id=$1',[r.id]))[0].base64,bytes.toString('base64'))
 const cp=job.checkpoints['PDF-upload:v2:0'];cp.value.createdAt=Date.now()-24*3600_000
 await store.checkpoint(job,'PDF-upload:v2:0',cp.hash,cp.value)
 fail=false;await preparePdf(ctx,{},api)
 assert.equal(uploads,2);assert.equal((await store.resource(own,r.id)).body.rawContent,'保留第一页\n\n保留最后一页')
 assert.equal((await db.query('SELECT * FROM tp_material_uploads WHERE resource_id=$1',[r.id])).length,0)
})

test('concurrent different uploads with one idempotency key cannot accept the losing bytes',async t=>{
 const {app,cookie,db}=await fixture(t)
 const results=await Promise.all(['first content','second content'].map(content=>app.inject({method:'POST',url:'/api/v2/materials/upload?name=race.txt',headers:{cookie,'content-type':'application/octet-stream','idempotency-key':'same-concurrent-upload'},payload:Buffer.from(content)})))
 assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409])
 assert.equal((await db.query("SELECT * FROM tp_resources WHERE kind='attachment'")).length,1)
})
