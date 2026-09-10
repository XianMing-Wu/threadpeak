import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
import {ProductTools} from './tools.ts'
import {createFlows,selectPathOption,selectPathCustomAnswer} from './flows.ts'
import {createProductApp} from './http.ts'
import {createZhihuGate,limitZhihuProvider} from './zhihu-gate.ts'
import {DIRECT_ROUTE_VERSION,RouteInterviewSchema,ROUTE_INTERVIEW_OUTPUT,validateCatalogNames,validateDirectRoutePlan,routeTaskFocus} from '../path-generation/direct-route.ts'
import {compileStagedPlan} from '../path-generation/staged-plan.ts'
import {projectRouteToDocument} from '../path-generation/project-document.ts'
import {plan} from '../../tests/fixtures/goal-agents.mjs'
const questions=()=>JSON.parse(ROUTE_INTERVIEW_OUTPUT)
const response=x=>({kind:'completed',text:JSON.stringify(x)})
const directPlan=()=>{const p=plan();for(const c of p.stages.flatMap(s=>s.flatMap(c=>c.concepts))){c.attachmentRefs=[];c.goalAlignment.materialAnchors=[]}return {...p,stages:p.stages.map(carriers=>({parallel:false,carriers}))}}
const hit=summary=>({evidenceId:'METADATA_ID',title:'METADATA_TITLE',url:'https://www.zhihu.com/answer/123',authorName:'METADATA_AUTHOR',summary,comments:['METADATA_COMMENT']})
async function fixture(t,{slowCatalog=false,failCatalog=false}={}){
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),seen=[],events=[];let release,entered,fail=failCatalog,active=0,max=0
 const barrier=new Promise(r=>release=r),waiting=new Promise(r=>entered=r)
 const gate=createZhihuGate(db,15)
 const zhihu=limitZhihuProvider({search:async(query)=>{
  active++;max=Math.max(max,active);const e={query,start:Date.now()};events.push(e)
  try{if(query.includes('目录')){entered();if(slowCatalog)await barrier;if(fail&&query.includes('课程2')){fail=false;return {kind:'failed',code:'MODEL_UNAVAILABLE',message:'test',retryable:false}}}await new Promise(r=>setTimeout(r,25));return {kind:'hits',items:[hit(query.includes('目录')?'补查目录内容':'首轮建议内容：课程1、课程2、课程3、课程4')]}}finally{e.end=Date.now();active--}
 }},gate)
 const llm={complete:async r=>{const c=JSON.parse(r.messages[1].content);seen.push({r,c,at:Date.now()});assert.equal(JSON.stringify(c).includes('METADATA_'),false)
  if(c.workflow===DIRECT_ROUTE_VERSION){assert.equal(c.exploration,undefined);assert.equal(c.firstSearch.summary,Array(2).fill('首轮建议内容：课程1、课程2、课程3、课程4').join('\n'));assert.equal(c.catalogSearch.summary,Array(4).fill('补查目录内容').join('\n'));assert.equal(c.questionSets[0].selectedOptions.length+Object.keys(c.questionSets[0].customAnswers).length,2);assert.match(r.messages[2].content,/用户实际表达/);return response(directPlan())}
  if(c.catalogCarriers){assert.equal(c.catalogSearch,undefined);return response(questions())}
  if(c.firstSearch){assert.equal(r.thinkingDepth,'fast');return response({carriers:['课程1','课程2','课程3','课程4']})}
  return response({queries:[0,1,2,3].map(i=>({id:`q${i}`,text:`入门课程推荐${i}`,purpose:'寻找不同学法',angle:i<2?'normal_learning':'pitfall_or_dispute'}))})
 }}
 const worker=new DurableWorker(store,createFlows(new ProductTools(llm,zhihu,500000)),1,()=>{});t.after(async()=>{release();await worker.stop();await db.close()})
 const state={goal:'做一个网页',depth:'deep',attachments:[],status:'running',questionSets:[],conversation:[{messageId:'goal',role:'user',content:'做一个网页'}]}
 const resource=await store.create('owner','path','flow',state);await store.enqueue('owner',resource.id,'path.start','start',{depth:'deep'})
 return {db,store,worker,resource,seen,events,release,waiting,max:()=>max}
}
async function until(fn){for(let i=0;i<200;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,5))}throw Error('timeout')}
const answer=(f,q,custom=false)=>f.store.answerPath('owner',f.resource.id,`answer:${q.id}`,{questionId:q.id,...custom?{customAnswer:'我会自己调整布局，但还不会排查问题。'}:{optionId:q.options[0].id},depth:'deep'},r=>custom?selectPathCustomAnswer(r,q.id,'我会自己调整布局，但还不会排查问题。'):selectPathOption(r,q.id,q.options[0].id))

test('questions become answerable during catalog IO; two batches wait for peers; final route publishes once with all evidence and answers',async t=>{
 const f=await fixture(t,{slowCatalog:true}),running=f.worker.execute(await f.store.claim());await f.waiting
 const state=await until(async()=>{const r=await f.store.resource('owner',f.resource.id);return r.body.questionSets.length?r.body:undefined})
 assert.equal(state.status,'awaiting_answers');assert.equal(state.research.ready,false);assert.equal(f.seen.filter(s=>s.c.catalogCarriers).length,1)
 const qs=state.questionSets[0].questions;await answer(f,qs[0]);await answer(f,qs[1],true);await answer(f,qs[1],true)
 assert.equal((await f.store.resource('owner',f.resource.id)).body.questionSets[0].customAnswers[qs[1].id],'我会自己调整布局，但还不会排查问题。')
 assert.equal(f.seen.filter(s=>s.c.workflow).length,0)
 f.release();await running
 const next=await f.store.claim();assert.equal(next.kind,'path.answer');await f.worker.execute(next)
 const result=await f.store.snapshot('owner',f.resource.id);assert.equal(result.data.status,'published');assert.equal(result.job.status,'completed');assert.equal(result.data.exploration,undefined);assert.equal(f.seen.filter(s=>s.c.workflow).length,1)
 const catalogs=f.events.filter(e=>e.query.includes('目录'));assert.equal(catalogs.length,4);assert.ok(catalogs[2].start>=Math.max(catalogs[0].end,catalogs[1].end));assert.ok(catalogs[3].start>=Math.max(catalogs[0].end,catalogs[1].end));assert.equal(f.max(),2)
 assert.equal((await f.db.query("SELECT count(*)::integer AS n FROM tp_resources WHERE kind='learning'"))[0].n,0)
 assert.equal((await f.db.query("SELECT count(*)::integer AS n FROM tp_path_answer_commands"))[0].n,2)
 await answer(f,qs[0]);assert.equal(await f.store.claim(),undefined)
})

test('catalog failure retains the published interview and successful searches; resume does not lose answers or repeat peers',async t=>{
 const f=await fixture(t,{failCatalog:true});await f.worker.execute(await f.store.claim())
 const before=await f.store.snapshot('owner',f.resource.id);assert.equal(before.job.status,'waiting');assert.equal(before.data.questionSets.length,1)
 for(const q of before.data.questionSets[0].questions)await answer(f,q)
 await f.store.resume('owner',f.resource.id);await f.worker.execute(await f.store.claim());await f.worker.execute(await f.store.claim())
 const done=await f.store.snapshot('owner',f.resource.id);assert.equal(done.data.status,'published');assert.equal(f.seen.filter(s=>s.c.catalogCarriers).length,1)
 assert.equal(f.events.filter(e=>e.query.startsWith('课程1 ')).length,1);assert.equal(f.events.filter(e=>e.query.startsWith('课程2 ')).length,2)
})

test('HTTP accepts selections while preparation is running and preserves the question reason on reload',async t=>{
 const f=await fixture(t,{slowCatalog:true}),app=await createProductApp({store:f.store,worker:f.worker,providersReady:true,identity:{production:false}});t.after(()=>app.close())
 const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0],owner=(await f.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
 await f.db.query('UPDATE tp_resources SET owner_id=$2 WHERE id=$1',[f.resource.id,owner]);await f.db.query('UPDATE tp_jobs SET owner_id=$2 WHERE resource_id=$1',[f.resource.id,owner])
 const running=f.worker.execute(await f.store.claim());await f.waiting
 const view=await until(async()=>{const res=await app.inject({url:`/api/path-runs/${f.resource.id}`,headers:{cookie}});return res.json().status==='awaiting_answers'?res.json():undefined})
 assert.equal(view.preparing,true);assert.ok(view.questionSets[0].questions[0].reason)
 const q=view.questionSets[0].questions[0],saved=await app.inject({method:'POST',url:`/api/path-runs/${f.resource.id}/select`,headers:{cookie,'idempotency-key':'http-save'},payload:{questionId:q.id,optionId:q.options[0].id}})
 assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().status,'awaiting_answers')
 const reload=await app.inject({url:`/api/path-runs/${f.resource.id}`,headers:{cookie}});assert.equal(reload.json().questionSets[0].selectedOptionIds[q.id],q.options[0].id)
 f.release();await running
})

test('2-4 questions explain route effects; explicit parallel marker compiles only one or two carriers without LLM edges',()=>{
 assert.equal(RouteInterviewSchema.safeParse({...questions(),questions:questions().questions.slice(0,1)}).success,false)
 assert.equal(validateCatalogNames({carriers:['A','B','C','D']}).carriers.length,4);assert.throws(()=>validateCatalogNames({carriers:['A','B','C','D','E']}));assert.throws(()=>validateCatalogNames({carriers:['A']},{kind:'collections'}))
 const p=directPlan(),carrier=p.stages[0].carriers[0],item=n=>({...carrier,title:n,concepts:carrier.concepts.map(c=>({...c,title:n}))})
 p.stages=[{parallel:false,carriers:[item('A')]},{parallel:true,carriers:[item('B'),item('C')]},{parallel:false,carriers:[item('D')]}]
 const parsed=validateDirectRoutePlan(p,{attachments:[]}),route=compileStagedPlan(parsed,'new'),names=new Map(route.carriers.map(c=>[c.id,c.title]))
 assert.deepEqual(route.carrierEdges.map(e=>[names.get(e.fromCarrierId),names.get(e.toCarrierId)]),[['A','B'],['A','C'],['B','D'],['C','D']]);assert.equal(projectRouteToDocument(route).ok,true)
 assert.throws(()=>validateDirectRoutePlan({...p,edges:[]},{attachments:[]}));p.stages[1].parallel=false;assert.throws(()=>validateDirectRoutePlan(p,{attachments:[]}))
})


test('the last answer arriving during a partial answer job still schedules exactly one final plan',async t=>{
 const f=await fixture(t);await f.worker.execute(await f.store.claim())
 const qs=(await f.store.resource('owner',f.resource.id)).body.questionSets[0].questions
 await answer(f,qs[0]);await f.store.enqueue('owner',f.resource.id,'path.answer','existing-partial-job',{depth:'deep'});const original=f.store.commit.bind(f.store),entered=Promise.withResolvers(),release=Promise.withResolvers();let pause=true
 f.store.commit=async(...args)=>{if(pause&&args[0].kind==='path.answer'){pause=false;entered.resolve();await release.promise}return original(...args)}
 const partial=f.worker.execute(await f.store.claim());await entered.promise
 await answer(f,qs[1]);release.resolve();await partial
 const final=await f.store.claim();assert.equal(final.kind,'path.answer');await f.worker.execute(final)
 assert.equal((await f.store.snapshot('owner',f.resource.id)).data.status,'published');assert.equal(f.seen.filter(c=>c.c.workflow).length,1);assert.equal(await f.store.claim(),undefined)
})

import {pathTrace} from './path-trace.ts'
test('progress distinguishes the two catalog batches and the parallel interview without R2b',()=>{
 const checkpoint=value=>({hash:'test',value}),job={id:'j',kind:'path.start',status:'running',checkpoints:{'R1@goal-v1:test':checkpoint({}),'R-S:0:goal-choices-v2@goal-v1':checkpoint([]),'R-S:1:goal-choices-v2@goal-v1':checkpoint([]),'R2-names:v6@goal-v1:test':checkpoint({carriers:['A','B','C','D']})}},state={workflow:DIRECT_ROUTE_VERSION,status:'awaiting_answers',questionSets:[]}
 const early=pathTrace([job],state);assert.ok(early.some(s=>s.id.endsWith('R3:v6')));assert.equal(early.filter(s=>s.id.includes('R-Catalog')).length,2);assert.ok(!early.some(s=>/R2b/.test(s.id)))
 job.checkpoints['R-Catalog:v6:1@goal-v1']=checkpoint([]);job.checkpoints['R-Catalog:v6:2@goal-v1']=checkpoint([])
 assert.equal(pathTrace([job],state).filter(s=>s.id.includes('R-Catalog')).length,4)
})

test('catalog names resolve to the provided summary or user material; aliases and guessed editions are not invented',()=>{
 const sources=['推荐 GAMES 101 与《一本教程》。']
 assert.deepEqual(validateCatalogNames({carriers:['GAMES101','一本教程']},undefined,sources).carriers,['GAMES101','一本教程'])
 assert.throws(()=>validateCatalogNames({carriers:['一本教程第三版']},undefined,sources),/真实存在/)
 assert.throws(()=>validateCatalogNames({carriers:['另一门课']},undefined,sources),/真实存在/)
})

test('route focus repeats literal user conditions without upgrading recommendations or unselected options',()=>{
 const input={goal:'做一个网页',goalContext:{rawGoal:'做一个网页',userStatements:[{text:'修改时我会继续请AI帮忙'},{text:'修改时我会继续请AI帮忙'}]},questionSets:[{routeEffect:'必须学完全部课程',unselected:'想成为前端专家'}],firstSearch:{summary:'宣传：零学习成本'}}
 const focus=routeTaskFocus(input,'plan')
 assert.match(focus,/做一个网页/);assert.equal(focus.split('修改时我会继续请AI帮忙').length-1,1)
 assert.match(focus,/attachments为空/)
 assert.ok(!focus.includes('必须学完全部课程'));assert.ok(!focus.includes('零学习成本'));assert.ok(!focus.includes('想成为前端专家'))
})



test('new routes require four teaching-summary fields and compile them unchanged',()=>{
 const raw=directPlan(),concept=raw.stages[0].carriers[0].concepts[0],summary=structuredClone(concept.learningSummary)
 const route=compileStagedPlan(validateDirectRoutePlan(raw,{attachments:[]}),'summary-route')
 assert.deepEqual(route.concepts[0].learningSummary,summary)
 delete concept.learningSummary
 assert.throws(()=>validateDirectRoutePlan(raw,{attachments:[]}),/learningSummary/)
 concept.learningSummary={...summary,boundary:''}
 assert.throws(()=>validateDirectRoutePlan(raw,{attachments:[]}))
})
