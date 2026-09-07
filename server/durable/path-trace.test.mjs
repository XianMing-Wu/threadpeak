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
  assert.deepEqual(trace.map(s=>s.title),['已确认学习偏好','已安排顺序与并列阶段','学习路线已生成'])
  assert.ok(trace.every(s=>s.status==='done'))
})
