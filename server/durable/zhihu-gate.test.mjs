import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {createZhihuGate,limitZhihuProvider,retryAfterUntil} from './zhihu-gate.ts'
import {ZhihuDataClient} from './zhihu-data.ts'
import {ZhihuLogin} from './zhihu-oauth.ts'
import {pause} from './limits.ts'

async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return db}

test('search, global search, direct, user data, PDF and OAuth share two permits through body consumption across gate instances',async t=>{
  const db=await fixture(t),gate=createZhihuGate(db,0),gate2=createZhihuGate(db,0)
  let active=0,maximum=0;const requests=[]
  const fetcher=async url=>{
    const path=new URL(url).pathname;requests.push(path);active++;maximum=Math.max(maximum,active)
    const payload=path.endsWith('access_token')?{access_token:'real-test-token',expires_in:3600}:path==='/profile'?{id:'user-1'}:{Code:0,Data:{items:[]}}
    // Headers resolve immediately; another permit cannot start until the body ends.
    return new Response(new ReadableStream({async start(controller){await pause(40);controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)));active--;controller.close()}}))
  }
  const raw={search:async q=>{await(await fetcher(`https://developer.zhihu.com/search/${q}`)).text();return {kind:'empty'}},globalSearch:async()=>{await(await fetcher('https://developer.zhihu.com/global')).text();return {kind:'empty'}},direct:async()=>{await(await fetcher('https://developer.zhihu.com/direct')).text();return {kind:'completed',text:'回答'}}}
  const provider=limitZhihuProvider(raw,gate),data=new ZhihuDataClient('test-secret',fetcher,undefined,undefined,gate2)
  const login=new ZhihuLogin(db,{mode:'real',appId:'app',appKey:'test-key',redirectUri:'http://127.0.0.1/api/auth/zhihu/callback',origin:'http://127.0.0.1',userInfoUrl:'https://openapi.zhihu.com/profile',userIdPath:'id',tokenSecret:'x'.repeat(32),production:false},fetcher,createZhihuGate(db,0))
  const start=await login.start(),state=new URL(start.authorizeUrl).searchParams.get('state'),binding=start.cookie.split(';')[0].split('=')[1]
  await Promise.all([
    ...['first','second','third'].map(q=>provider.search(q,10)),provider.globalSearch('全网',20),provider.direct({messages:[]}),
    data.user('favlists','test-token',{}),data.json('/api/pdf/task',{body:{id:'pdf'}}),data.pdfResult('https://result.bcebos.com/result',new AbortController().signal),
    login.callback('code',state,binding),
  ])
  assert.equal(maximum,2);assert.equal(active,0);assert.equal(requests.length,10)
  for(const q of ['first','second','third'])assert.equal(requests.filter(p=>p===`/search/${q}`).length,1)
  const slots=await db.query("SELECT * FROM tp_provider_slots WHERE pool='zhihu'")
  assert.equal(slots.length,2);assert.ok(slots.every(s=>!s.token&&Number(s.lease_until)===0))
})

test('429 cooldown persists across gates; shorter Retry-After cannot shorten it, queued cancellation never calls upstream',async t=>{
  const db=await fixture(t),gate=createZhihuGate(db,0),start=Date.now()
  const data=new ZhihuDataClient('test',async()=>new Response('',{status:429,headers:{'Retry-After':'0.6'}}),undefined,undefined,gate)
  await assert.rejects(data.user('favlists','test',{}),e=>e.code==='ZHIHU_HTTP_429')
  const [first]=await db.query("SELECT until_at FROM tp_provider_cooldowns WHERE pool='zhihu'")
  await createZhihuGate(db,0).observe(new Response('',{status:429,headers:{'Retry-After':'0.1'}}))
  const [second]=await db.query("SELECT until_at FROM tp_provider_cooldowns WHERE pool='zhihu'")
  assert.equal(Number(second.until_at),Number(first.until_at))
  let called=0;const abort=new AbortController()
  const queued=createZhihuGate(db,0).run(abort.signal,async()=>{called++}),rejected=assert.rejects(queued)
  abort.abort();await rejected;assert.equal(called,0)
  await createZhihuGate(db,0).run(undefined,async()=>{assert.ok(Date.now()>=Number(first.until_at));called++})
  assert.equal(called,1);assert.ok(Date.now()-start>=600)
  await assert.rejects(gate.run(undefined,async()=>{throw Error('transport failure')}),/transport failure/)
  assert.ok((await db.query("SELECT * FROM tp_provider_slots WHERE pool='zhihu'")).every(s=>!s.token))
})

test('Retry-After supports seconds and HTTP dates with a conservative fallback',()=>{
  const now=Date.parse('2026-09-07T12:00:00Z')
  assert.equal(retryAfterUntil('30',now),now+30_000)
  assert.equal(retryAfterUntil('Mon, 07 Sep 2026 12:01:00 GMT',now),now+60_000)
  for(const value of [null,'invalid','-5','0','Sun, 06 Sep 2026 12:00:00 GMT'])assert.equal(retryAfterUntil(value,now),now+10_000)
})
