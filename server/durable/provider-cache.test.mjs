import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {instrumentProviders,cacheUserId} from './provider-runtime.ts'
import {providerScope} from './provider-scope.ts'
import {createZhihuGate,limitZhihuProvider,ZHIHU_START_INTERVAL_MS} from './zhihu-gate.ts'
import {pause,withPermit} from './limits.ts'
import {createAgentLlmProvider} from '../agent-runtime/llm-provider.ts'
import {createAgentZhihuProvider} from '../agent-runtime/zhihu-provider.ts'
import {contextJson} from './context.ts'
import {validateAnswerMath} from './math-output.ts'
import {prepareMarkdown} from '@threadpeak/contracts/markdown-source'

const config={zhihuAccessSecret:'test-secret',zhihuApiBaseUrl:'https://developer.zhihu.com/api/v1',deepseekApiKey:'test-key',deepseekBaseUrl:'https://api.deepseek.com',deepseekModelName:'deepseek-v4-flash'}
const input={messages:[{role:'system',content:'同一合同'},{role:'user',content:'目标：读懂公式。材料版本：v1'}],thinkingDepth:'fast'}
const scope=(owner,fn)=>providerScope.run({ownerId:owner,jobId:'test-job',step:'test-step'},fn)
const good={kind:'completed',text:'真实适配器形状的离线测试响应',cacheable:true}
async function fixture(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return db}

test('shared scheduler separates starts and queues the third request with two bodies in flight',async t=>{
  const db=await fixture(t),starts=[];let now=100,active=0,max=0
  assert.equal(ZHIHU_START_INTERVAL_MS,2100)
  const entered=Array.from({length:3},()=>Promise.withResolvers()),release=Array.from({length:3},()=>Promise.withResolvers())
  const blocked=Promise.withResolvers(),wake=Promise.withResolvers()
  const work=i=>async()=>{starts.push(now);active++;max=Math.max(max,active);entered[i].resolve();await release[i].promise;active--}
  const options={now:()=>now,intervalMs:60,wait:async ms=>{if(ms===60)now+=ms;else{blocked.resolve();await wake.promise}}}
  const a=withPermit(db,'zhihu',2,undefined,work(0),options);await entered[0].promise
  const b=withPermit(db,'zhihu',2,undefined,work(1),options);await entered[1].promise
  const c=withPermit(db,'zhihu',2,undefined,work(2),options);await blocked.promise
  assert.equal(active,2);assert.equal(starts.length,2)
  release[0].resolve();await a;wake.resolve();await entered[2].promise
  release[1].resolve();release[2].resolve();await Promise.all([b,c])
  assert.equal(max,2);assert.deepEqual(starts,[100,160,220])
  const abort=new AbortController();abort.abort()
  await assert.rejects(createZhihuGate(db,60).run(abort.signal,()=>assert.fail('cancelled request sent')))
})

test('instrumented providers expose only search APIs and never resurrect retired direct cache data',async t=>{
 const db=await fixture(t);let calls=0
 const p=instrumentProviders(db,config,{complete:async()=>good},{search:async()=>{calls++;return {kind:'empty'}},direct:async()=>assert.fail('retired transport called')})
 assert.equal(p.zhihu.direct,undefined)
 await scope('alice',()=>p.zhihu.search('问题',10));await scope('alice',()=>p.zhihu.search('问题',10))
 assert.equal(calls,2);assert.equal((await db.query('SELECT * FROM tp_provider_cache')).length,0)
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

test('missing usage stays unknown for both LLM and uncached searches',async t=>{
  const db=await fixture(t),p=instrumentProviders(db,config,{complete:async()=>({kind:'completed',text:'ok'})},{search:async()=>({kind:'empty'}),direct:async()=>({...good,usage:{prompt_tokens:9}})})
  await scope('alice',()=>p.llm.complete({...input,json:false}))
  await scope('alice',()=>p.zhihu.search('问题',10));await scope('alice',()=>p.zhihu.search('问题',10))
  const rows=await db.query('SELECT body FROM tp_provider_calls ORDER BY created_at')
  assert.equal(rows[0].body.usage,undefined);assert.equal(rows.at(-1).body.cache,undefined);assert.equal(rows.at(-1).body.usage,undefined)
})

test('Zhihu search distinguishes rate, quota, auth and business errors',async t=>{
  const db=await fixture(t),bodies=[];let payload={},status=200
  const raw=createAgentZhihuProvider({config,clock:{unixSeconds:()=>1},http:async(_url,init)=>{if(init.body)bodies.push(JSON.parse(init.body));return {ok:status===200,status,text:async()=>JSON.stringify(payload)}}})
  assert.equal(raw.direct,undefined)
  for(const [http,code,expected,retryable] of [[429,'rate_limit_exceeded','ZHIHU_RATE_LIMITED',true],[429,'insufficient_quota','ZHIHU_QUOTA_EXCEEDED',false],[401,'invalid_key','AUTH_INVALID',false]]){
    status=http;payload={error:{code,message:'must not persist raw error'}}
    const result=await raw.search('问题',10);assert.equal(result.code,expected);assert.equal(result.retryable,retryable);assert.equal(result.diagnostic.upstreamCode,code);assert.equal(result.diagnostic.message,undefined)
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
