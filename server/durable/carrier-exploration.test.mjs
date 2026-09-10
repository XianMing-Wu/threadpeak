import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext} from './worker.ts'
import {ProductTools} from './tools.ts'
import {carrierDiscovery,carrierExpansion,batchDiscovery,batchCompletion} from '../../tests/fixtures/goal-agents.mjs'
import {validateCarrierDiscovery,validateCarrierExpansion,assembleExploration,explorationForPlanning,mergeSearchSummaries} from '../path-generation/carrier-exploration.ts'
import {validateBatchDiscovery,validateBatchCompletion,packCatalogNames} from '../path-generation/batch-exploration.ts'
import {parseAgentOutput} from '../agent-runtime/schemas.ts'
const material={sourceId:'owned-file',fileName:'目标资料',content:'坐标表示基下的分量。'}
const evidence=(summary='测试课程第一课讲坐标与基。')=>({evidenceId:'METADATA_ONLY_ID',title:'METADATA_ONLY_TITLE',summary,url:'https://example.com/METADATA_ONLY_URL',authorName:'METADATA_ONLY_AUTHOR',authorId:null,comments:['METADATA_ONLY_COMMENT'],avatar:'METADATA_ONLY_IMAGE'})
const groups=[{queryId:'METADATA_ONLY_QUERY',query:'METADATA_ONLY_QUERY_TEXT',results:[evidence('方式A：先读课程再练习。'),evidence('方式B：先画坐标再补理论。')]}]
const input={goal:'学习目标资料中的坐标',goalContext:{rawGoal:'学习目标资料中的坐标',userStatements:[]},searchScope:{kind:'zhihu'},searchGroups:groups,attachments:[material]}
const modelInput={goal:input.goal,goalContext:input.goalContext,searchScope:input.searchScope,attachments:input.attachments,firstSearch:{summary:mergeSearchSummaries(groups)}}
async function context(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());const store=new DurableStore(db),r=await store.create('owner','test','carriers',{});await store.enqueue('owner',r.id,'test','carriers',{depth:'fast'});return new TaskContext(store,await store.claim(60000),new AbortController().signal)}

test('R1 preserves purpose and rejects missing purpose or oversized individual questions',()=>{
 const value={queries:[0,1,2,3].map(i=>({id:`Q${i+1}`,text:`坐标学习方式${i}`,angle:i<2?'normal_learning':'pitfall_or_dispute',purpose:'发现学习载体与不同选择'}))}
 assert.deepEqual(parseAgentOutput('R1',value).value,value)
 delete value.queries[0].purpose;assert.equal(parseAgentOutput('R1',value).ok,false)
 value.queries[0].purpose='发现载体';value.queries[0].text='长'.repeat(46);assert.equal(parseAgentOutput('R1',value).ok,false)
})

test('both search rounds pass only all summaries joined with newlines; raw results stay intact',()=>{
 const original=structuredClone(groups),text=mergeSearchSummaries(groups)
 assert.equal(text,'方式A：先读课程再练习。\n方式B：先画坐标再补理论。')
 assert.equal(text.includes('METADATA_ONLY'),false);assert.deepEqual(groups,original)
 const long='二维卷积🌐\n'.repeat(1000)
 assert.equal(mergeSearchSummaries([{...groups[0],results:[evidence(long),evidence('第二条总结')]}]),long+'\n第二条总结')
 assert.equal(mergeSearchSummaries([]),'')
})

test('name extraction is non-thinking and collection scope cannot schedule external catalogs',async t=>{
 const ctx=await context(t);ctx.job.input.depth='deep';let count=0
 const tools=new ProductTools({complete:async r=>{count++;assert.equal(r.thinkingDepth,'fast');assert.equal(r.maxTokens,1024);const c=JSON.parse(r.messages[1].content);assert.deepEqual(c.firstSearch,modelInput.firstSearch);assert.equal(JSON.stringify(c).includes('METADATA_ONLY'),false);return {kind:'completed',text:JSON.stringify({carriers:[]})}}},{search:async()=>{throw Error('external forbidden')}})
 assert.deepEqual(await tools.catalogNames(ctx,{...modelInput,searchScope:{kind:'collections'}}),{carriers:[]});assert.deepEqual(await tools.catalogSearches(ctx,[]),[]);assert.equal(count,1)
 const failed=new ProductTools({}, {search:async()=>({kind:'failed',code:'UPSTREAM_DOWN',message:'failed',retryable:false})})
 await assert.rejects(failed.catalogSearches(await context(t),['测试课程']),e=>e.code==='UPSTREAM_DOWN')
})

test('name-only contract and deterministic two-query packing preserve overflow; final content owns the whole candidate set',()=>{
 assert.throws(()=>validateBatchDiscovery({...batchDiscovery(),perspectives:[]},modelInput))
 assert.throws(()=>validateBatchDiscovery({carriers:[{name:'课程'}]},modelInput))
 const names=Array.from({length:8},(_,i)=>`书课${i}`+'名称'.repeat(45)),packed=packCatalogNames(names)
 assert.equal(packed.queries.length,2);assert.ok(packed.queries.every(q=>q.length<=200));assert.equal(packed.unsearchedCarriers.length,4)
 for(const name of names)assert.ok(packed.queries.some(q=>q.includes(name))||packed.unsearchedCarriers.includes(name))
 assert.deepEqual(packCatalogNames([]),{queries:[],unsearchedCarriers:[]})
 const c={...modelInput,catalogCarriers:['测试课程'],unsearchedCarriers:[],catalogSearch:{summary:''}},result=batchCompletion()
 assert.throws(()=>validateBatchCompletion(result,c),/测试课程/)
 result.coverage.excluded=[{name:'测试课程',reason:'该课程不包含目标所需内容'}];assert.doesNotThrow(()=>validateBatchCompletion(result,c))
 result.carriers.push({...result.carriers[0]});assert.throws(()=>validateBatchCompletion(result,c),/载体 ID/)
})

test('metadata references are not part of model output; disputes require real first-round perspective IDs',()=>{
 const d=carrierDiscovery();d.carriers[0].anchors=[];assert.throws(()=>validateCarrierDiscovery(d,modelInput),/anchors/);delete d.carriers[0].anchors
 d.perspectives=[{id:'P1',advice:'可先读课程或先画图',forWhom:'未说明',conditions:'未说明',tradeoffs:'未说明',fitToGoal:'不同入门方式',basis:'inference'}]
 const c=carrierExpansion();c.concepts[0].dispute={status:'observed',dimension:'method',reason:'先读课程与先实践两种方式',perspectiveRefs:['P1']}
 const x={...modelInput,carrier:d.carriers[0],perspectives:d.perspectives,catalogSearch:{summary:''}}
 assert.throws(()=>validateCarrierExpansion(c,x),/首轮真实来源/);d.perspectives[0].basis='source';assert.doesNotThrow(()=>validateCarrierExpansion(c,x))
 c.concepts[0].dispute.perspectiveRefs=['P99'];assert.throws(()=>validateCarrierExpansion(c,x),/本次输入/)
 const named={...x,carrier:{...x.carrier,kind:'course'}};assert.throws(()=>validateCarrierExpansion(carrierExpansion(),named),/具体课程/)
})

test('all goal-relevant candidates survive; excluded topics cannot re-enter through a longer name',()=>{
 const d=carrierDiscovery(),e=carrierExpansion(),x={...modelInput,carrier:d.carriers[0],perspectives:[],catalogSearch:{summary:''}}
 e.concepts=Array.from({length:70},(_,i)=>({...e.concepts[0],id:`K${i+1}`,concept:`待验证目标知识${i+1}`}))
 const checked=validateCarrierExpansion(e,x),result=assembleExploration(d,[{...d.carriers[0],...checked,catalogSearchGroups:[]}])
 assert.equal(result.candidates.length,70);assert.equal(explorationForPlanning(result).carriers[0].concepts.length,70);assert.throws(()=>assembleExploration(d,[]),/全部展开结果/)
 e.concepts[0].concept='z变换的卷积性质';assert.throws(()=>validateCarrierExpansion(e,{...x,goalBoundary:{boundary:'二维傅里叶和卷积',excluded:[{name:'Z变换',reason:'当前目标不需要'}],gaps:[]}}),/同时列入/)
})
