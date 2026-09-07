import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {openDatabase,migrate} from './database.ts'
import {cacheZhihuDirect,instrumentProviders,cacheUserId} from './provider-runtime.ts'
import {providerScope} from './provider-scope.ts'
import {createZhihuGate,limitZhihuProvider,ZHIHU_START_INTERVAL_MS} from './zhihu-gate.ts'
import {pause} from './limits.ts'
import {createAgentLlmProvider} from '../agent-runtime/llm-provider.ts'
import {createAgentZhihuProvider} from '../agent-runtime/zhihu-provider.ts'
import {contextJson} from './context.ts'
import {validateAnswerMath} from './math-output.ts'
import {prepareMarkdown} from '../../packages/contracts/src/markdown-source.ts'

const config={zhihuAccessSecret:'test-secret',zhihuApiBaseUrl:'https://developer.zhihu.com/api/v1',deepseekApiKey:'test-key',deepseekBaseUrl:'https://api.deepseek.com',deepseekModelName:'deepseek-v4-flash'}
const input={messages:[{role:'system',content:'同一合同'},{role:'user',content:'目标：读懂公式。材料版本：v1'}],thinkingDepth:'fast'}
const scope=(owner,fn)=>providerScope.run({ownerId:owner,jobId:'test-job',step:'test-step'},fn)
const good={kind:'completed',text:'真实适配器形状的离线测试响应',cacheable:true}
async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return db}

test('shared scheduler separates request starts while allowing two bodies in flight',async t=>{
  const db=await fixture(t),starts=[];let active=0,max=0
  assert.equal(ZHIHU_START_INTERVAL_MS,2100)
  const work=async()=>{starts.push(Date.now());active++;max=Math.max(max,active);await pause(430);active--}
  await Promise.all(Array.from({length:4},()=>createZhihuGate(db,60).run(undefined,work)))
  assert.equal(max,2);assert.equal(starts.length,4)
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=60)
  const abort=new AbortController();abort.abort()
  await assert.rejects(createZhihuGate(db,60).run(abort.signal,()=>assert.fail('cancelled request sent')))
})

test('direct cache merges identical calls across wrappers and reuses only within owner, complete request and namespace',async t=>{
  const db=await fixture(t);let calls=0,searches=0
  const raw={search:async()=>{searches++;return {kind:'empty'}},direct:async()=>{calls++;await pause(30);return good}}
  const a=cacheZhihuDirect(raw,db,'credential-1'),b=cacheZhihuDirect(raw,db,'credential-1')
  const pair=await Promise.all([scope('alice',()=>a.direct(input)),scope('alice',()=>b.direct(input))])
  assert.equal(calls,1);assert.deepEqual(pair.map(r=>r.cache).sort(),['hit','miss'])
  assert.equal((await scope('alice',()=>b.direct(input))).cache,'hit')
  await scope('bob',()=>b.direct(input))
  await scope('alice',()=>b.direct({...input,thinkingDepth:'deep'}))
  await scope('alice',()=>b.direct({...input,messages:[{role:'user',content:'目标：复现。材料版本：v2'}]}))
  await scope('alice',()=>cacheZhihuDirect(raw,db,'credential-2').direct(input))
  assert.equal(calls,5)
  await a.search('same',10);await a.search('same',10);assert.equal(searches,2)
  await db.query('UPDATE tp_provider_cache SET expires_at=0')
  assert.equal((await scope('alice',()=>b.direct(input))).cache,'miss');assert.equal(calls,6)
  assert.equal((await db.query("SELECT * FROM tp_provider_slots WHERE pool LIKE 'direct-cache:%'")).length,0)
})

test('failed, incomplete and cancelled direct calls never become cache hits',async t=>{
  const db=await fixture(t)
  for(const result of [{kind:'failed',code:'ZHIHU_RATE_LIMITED'}, {...good,cacheable:false},{...good,text:''}]){
    let calls=0;const p=cacheZhihuDirect({search:async()=>({kind:'empty'}),direct:async()=>{calls++;return result}},db,JSON.stringify(result))
    await scope('alice',()=>p.direct(input));await scope('alice',()=>p.direct(input));assert.equal(calls,2)
  }
  const abort=new AbortController(),p=cacheZhihuDirect({direct:async()=>{abort.abort();return good}},db,'cancel')
  await assert.rejects(scope('alice',()=>p.direct({...input,signal:abort.signal})))
  assert.equal((await db.query('SELECT * FROM tp_provider_cache')).length,0)
})

test('direct cache survives database reopen, with no second upstream request',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tp-direct-cache-'));let db=await openDatabase({directory});await migrate(db)
  try{
    const raw={direct:async()=>good},first=cacheZhihuDirect(raw,db,'same-provider')
    assert.equal((await scope('alice',()=>first.direct(input))).cache,'miss')
    await db.close();db=await openDatabase({directory});await migrate(db)
    const reopened=cacheZhihuDirect({direct:async()=>assert.fail('cache lost at restart')},db,'same-provider')
    assert.equal((await scope('alice',()=>reopened.direct(input))).cache,'hit')
  }finally{await db.close();await rm(directory,{recursive:true,force:true})}
})

test('cancellation during cache persistence rolls back the cache transaction',async t=>{
  const db=await fixture(t),abort=new AbortController()
  const wrapped={...db,transaction:fn=>db.transaction(tx=>fn({...tx,query:async(sql,params)=>{
    const rows=await tx.query(sql,params);if(sql.startsWith('INSERT INTO tp_provider_cache('))abort.abort();return rows
  }}))}
  const p=cacheZhihuDirect({direct:async()=>good},wrapped,'cancel-at-commit')
  await assert.rejects(scope('alice',()=>p.direct({...input,signal:abort.signal})))
  assert.equal((await db.query('SELECT * FROM tp_provider_cache')).length,0)
})

test('truncated model output retains actual usage but is not published as a completed answer',async()=>{
  const usage={prompt_tokens:100,prompt_cache_hit_tokens:64,prompt_cache_miss_tokens:36}
  const p=createAgentLlmProvider({config,http:async()=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'length',message:{content:'半截'}}],usage})})})
  const r=await p.complete({...input,json:false});assert.equal(r.kind,'failed');assert.equal(r.code,'OUTPUT_TRUNCATED');assert.deepEqual(r.usage,usage)
})

test('DeepSeek records actual nonstream and stream KV usage and sends stable opaque owner ID',async t=>{
  const db=await fixture(t),requests=[],usage={prompt_tokens:1050,prompt_cache_hit_tokens:1024,prompt_cache_miss_tokens:26,completion_tokens:2,total_tokens:1052}
  const raw=createAgentLlmProvider({config,http:async(_url,init)=>{
    const body=JSON.parse(init.body);requests.push(body)
    if(!body.stream)return {ok:true,status:200,text:async()=>JSON.stringify({id:'req-1',choices:[{finish_reason:'stop',message:{content:'完成'}}],usage})}
    return {ok:true,status:200,body:new ReadableStream({start(c){
      const events=[{id:'req-2',choices:[{delta:{content:'完'},finish_reason:null}]},{id:'req-2',choices:[{delta:{content:'成'},finish_reason:null}]},{id:'req-2',choices:[{delta:{},finish_reason:'stop'}],usage}]
      c.enqueue(new TextEncoder().encode(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n'));c.close()
    }})}
  }})
  const p=instrumentProviders(db,config,raw,{search:async()=>({kind:'empty'}),direct:async()=>good}),drafts=[]
  for(const onText of [undefined,s=>drafts.push(s)]){
    const result=await scope('alice',()=>p.llm.complete({...input,json:false,onText}))
    assert.equal(result.kind,'completed');assert.deepEqual(result.usage,usage)
  }
  assert.deepEqual(drafts,['完','完成'])
  assert.equal(requests[0].user_id,requests[1].user_id);assert.equal(requests[0].user_id,cacheUserId('alice'))
  assert.notEqual(cacheUserId('alice'),cacheUserId('bob'));assert.doesNotMatch(requests[0].user_id,/alice/)
  assert.deepEqual(requests[1].stream_options,{include_usage:true});assert.equal(requests[0].cache_control,undefined)
  const rows=await db.query('SELECT * FROM tp_provider_calls');assert.equal(rows.length,2)
  assert.ok(rows.every(r=>r.body.usage.prompt_cache_hit_tokens===1024&&!r.body.messages))
})

test('missing usage stays unknown; cache hits do not count the original upstream usage twice',async t=>{
  const db=await fixture(t),p=instrumentProviders(db,config,{complete:async()=>({kind:'completed',text:'ok'})},{search:async()=>({kind:'empty'}),direct:async()=>({...good,usage:{prompt_tokens:9}})})
  await scope('alice',()=>p.llm.complete({...input,json:false}))
  await scope('alice',()=>p.zhihu.direct(input));await scope('alice',()=>p.zhihu.direct(input))
  const rows=await db.query('SELECT body FROM tp_provider_calls ORDER BY created_at')
  assert.equal(rows[0].body.usage,undefined);assert.equal(rows.at(-1).body.cache,'hit');assert.equal(rows.at(-1).body.usage,undefined)
})

test('Zhihu uses the documented depth models and distinguishes rate, quota, auth and business errors',async t=>{
  const db=await fixture(t),bodies=[];let payload={},status=200
  const raw=createAgentZhihuProvider({config,clock:{unixSeconds:()=>1},http:async(_url,init)=>{if(init.body)bodies.push(JSON.parse(init.body));return {ok:status===200,status,text:async()=>JSON.stringify(payload)}}})
  payload={choices:[{message:{content:'完成'},finish_reason:'stop'}]}
  assert.equal((await raw.direct(input)).cacheable,true);await raw.direct({...input,thinkingDepth:'deep'})
  assert.deepEqual(bodies.map(b=>b.model),['zhida-fast-1p5','zhida-thinking-1p5']);assert.ok(bodies.every(b=>b.thinking===undefined&&b.stream===false))
  for(const [http,code,expected,retryable] of [[429,'rate_limit_exceeded','ZHIHU_RATE_LIMITED',true],[429,'insufficient_quota','ZHIHU_QUOTA_EXCEEDED',false],[401,'invalid_key','AUTH_INVALID',false]]){
    status=http;payload={error:{code,message:'must not persist raw error'}}
    const result=await raw.direct(input);assert.equal(result.code,expected);assert.equal(result.retryable,retryable);assert.equal(result.diagnostic.upstreamCode,code);assert.equal(result.diagnostic.message,undefined)
  }
  status=200;payload={Code:30001,Msg:'frequency'}
  const result=await limitZhihuProvider(raw,createZhihuGate(db,0)).search('q',10)
  assert.equal(result.code,'ZHIHU_RATE_LIMITED')
  assert.ok((await db.query("SELECT * FROM tp_provider_cooldowns WHERE pool='zhihu'"))[0].until_at>Date.now())
})

test('stable context prefix precedes changing conversation and current question without losing content',()=>{
  const materials=[{id:'F1',content:'完整材料',version:2}],scope={cards:[{ref:'C1',content:'正文'}]}
  const a={conversation:[{role:'user',content:'前一个问题'}],materials,read_card_scope:scope,goalContext:{outcome:'目标'},currentQuestion:'问题一'}
  const b={...a,conversation:[{role:'user',content:'新的问题'}],currentQuestion:'问题二'}
  const x=contextJson(a),y=contextJson(b),prefix=x.slice(0,x.indexOf('"conversation"'))
  assert.ok(prefix.includes('完整材料'));assert.ok(y.startsWith(prefix));assert.deepEqual(JSON.parse(x),a)
  assert.equal(contextJson({materials,read_card_scope:scope}),contextJson({read_card_scope:scope,materials}))
})

test('programming newline separators are readable code while explicit invalid math is still rejected',()=>{
  const text=String.raw`先按段落（\n\n），再按换行（\n），制表符 \t 和 \r\n；希腊字母 $\nu$ 与 \nabla。`
  const p=prepareMarkdown(text);assert.equal(p.math.length,2);assert.ok(p.markdown.includes('`\\n\\n`'));assert.doesNotThrow(()=>validateAnswerMath(text))
  assert.throws(()=>validateAnswerMath(String.raw`明确公式 $\n\n$`))
  const code='```js\nconst separator = "\\n\\n";\n```';assert.equal(prepareMarkdown(code).markdown,code)
})
