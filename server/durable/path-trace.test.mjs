import test from 'node:test'
import assert from 'node:assert/strict'
import {pathTrace} from './path-trace.ts'
const checkpoint=value=>({hash:'hash',value})
test('route progress retains each named step and exposes parallel searches',()=>{
  const job={id:'job',kind:'path.start',status:'running',checkpoints:{R1:checkpoint({})}}
  const state={status:'running',questionSets:[]}
  let trace=pathTrace([job],state)
  assert.equal(trace.filter(s=>s.status==='running').length,2)
  assert.deepEqual(trace.map(s=>s.title),['理解学习目标','正在搜索学习方法','正在搜索争议与误区'])
  job.checkpoints['R-S:0']=checkpoint([{},{}]);job.status='waiting';trace=pathTrace([job],state)
  assert.equal(trace[1].extra,'2 条资料');assert.equal(trace[1].status,'done');assert.equal(trace[2].status,'failed')
  job.checkpoints['R-S:1']=checkpoint([]);job.checkpoints.R2=checkpoint({});job.checkpoints.R3=checkpoint({});job.status='completed'
  const done=pathTrace([job],state);assert.equal(done.length,5);assert.ok(done.every(s=>s.status==='done'&&s.title!=='已完成'))
  assert.deepEqual(pathTrace(JSON.parse(JSON.stringify([job])),state),done)
})
test('published route records confirmed preferences, compilation and publication separately',()=>{
  const trace=pathTrace([{id:'build',kind:'path.answer',status:'completed',checkpoints:{'R4-plan':checkpoint({})}}],{status:'published',questionSets:[{status:'active',selectedOptionIds:{q:'a'},questions:[{id:'q'}]}]})
  assert.deepEqual(trace.map(s=>s.title),['已记下你的想法','已安排顺序与并列阶段','学习路线已生成'])
  assert.ok(trace.every(s=>s.status==='done'))
})

test('v7 catalog batches, historical v6 and complete web groups settle without phantom spinners',()=>{
 for(const version of ['v7','v6'])for(const web of [false,true]){
  const cps={'R1@goal-v1:hash':checkpoint({}),'R2-names:v6@goal-v1:hash':checkpoint({carriers:['信号与系统','数字图像处理','第三本书','第四本书']}),'R3:v6@goal-v1:hash':checkpoint({})}
  const suffix=web?':url-v2@goal-v1':'@goal-v1'
  for(let i=0;i<2;i++)cps[`R-S:${i}:goal-choices-v2${suffix}`]=checkpoint([])
  const job={id:'job',kind:'path.start',status:'running',checkpoints:cps};const state={workflow:'route-direct-v6',status:'awaiting_answers',questionSets:[]}
  let trace=pathTrace([job],state);assert.equal(trace.filter(s=>s.kind==='search'&&s.status==='running').length,2)
  for(let i=1;i<=2;i++)cps[`R-Catalog:${version}:${i}${suffix}`]=checkpoint([{}])
  trace=pathTrace([job],state);assert.equal(trace.filter(s=>s.kind==='search'&&s.status==='running').length,2);assert.equal(trace.find(s=>s.title==='补查信号与系统').status,'done')
  for(let i=3;i<=4;i++)cps[`R-Catalog:${version}:${i}${suffix}`]=checkpoint([{}])
  trace=pathTrace([job],state);assert.ok(trace.every(s=>s.status==='done'));assert.equal(trace.filter(s=>s.kind==='search').length,6)
 }
})

test('route thinking follows the latest attempt, preserves interrupted history and never infers success from job completion',()=>{
 const old={id:'old',step:'R4',kind:'think',title:'安排顺序',status:'waiting',thought:'先前尝试',startedAt:1,updatedAt:10}
 const recovered={...old,id:'new',status:'done',thought:'本次结果',startedAt:2,updatedAt:3}
 const job={id:'build',kind:'path.answer',status:'completed',checkpoints:{'R4-plan':checkpoint({})},activities:[old,recovered]}
 const trace=pathTrace([job],{status:'published',questionSets:[]}).filter(s=>s.kind==='think')
 assert.equal(trace.length,1);assert.equal(trace[0].status,'done');assert.match(trace[0].thought,/先前尝试/);assert.match(trace[0].thought,/本次结果/)
 job.activities=[old]
 assert.equal(pathTrace([job],{status:'published',questionSets:[]}).find(s=>s.kind==='think').status,'failed')
})
