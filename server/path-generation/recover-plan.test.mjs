import test from 'node:test'
import assert from 'node:assert/strict'
import {recoverPlan,readDamagedPlan,compileRecoveredPlan} from './recover-plan.ts'
import {projectRouteToDocument} from './project-document.ts'

const carrier=name=>({title:name,description:`学习${name}`,concepts:[{title:`${name}的核心`,description:`在当前目标中理解${name}`} ]})
const original={title:'目标路线',stages:[{parallel:false,carriers:[carrier('A')]},{parallel:true,carriers:[carrier('B'),carrier('C')]},{parallel:false,carriers:[carrier('D')]}]}

test('explicit string booleans and oversized concept lists preserve the same two independent branches',()=>{
 const value=structuredClone(original)
 value.stages[1].parallel='true'
 value.stages[1].carriers[0].concepts=Array.from({length:15},(_,i)=>({...value.stages[1].carriers[0].concepts[0],title:`B-${i}`}))
 const {recovered,route}=checked(value)
 assert.equal(recovered.linear,false)
 assert.deepEqual(recovered.plan.stages.map(s=>s.length),[1,2,1])
 assert.ok(recovered.plan.stages[1][0].concepts.length<=12)
 assert.ok(projectRouteToDocument(route).value.document.structure.flowGroups.some(g=>g.type==='split'))
})
const input={goal:'理解矩阵变换',goalContext:{rawGoal:'理解矩阵变换，只学数学',userStatements:[{text:'我会四则运算'}]},attachments:[{ref:'F1',sourceId:'owned',fileName:'论文.pdf',content:'矩阵变换保留线性组合。'}]}
function checked(raw,context=input){const r=recoverPlan(raw,context);const route=compileRecoveredPlan(r.plan,'stable-scope',context.attachments?.map(a=>a.sourceId)??[],new Set());assert.equal(projectRouteToDocument(route).ok,true);return {recovered:r,route}}
test('malformed JSON preserves concepts and explicit parallel stages; unknown relations become linear',()=>{
 const raw=JSON.stringify(original).replace('"parallel":false','parallel:false').replace('"title":"A"',"'title':'A'").slice(0,-3)+',]}'
 const {route}=checked(raw),names=new Map(route.carriers.map(c=>[c.id,c.title]))
 assert.deepEqual(route.concepts.map(c=>c.title),['A的核心','B的核心','C的核心','D的核心'])
 assert.deepEqual(route.carrierEdges.map(e=>[names.get(e.fromCarrierId),names.get(e.toCarrierId)]),[['A','B'],['A','C'],['B','D'],['C','D']])
 const unclear=structuredClone(original);delete unclear.stages[1].parallel
 const linear=checked(unclear).route
 assert.equal(linear.carrierEdges.length,3)
 assert.deepEqual(linear.carrierEdges.map(e=>[e.fromCarrierId,e.toCarrierId]),linear.carriers.slice(1).map((c,i)=>[linear.carriers[i].id,c.id]))
})
test('every truncation position produces a valid stable renderer route without inventing source quotes',()=>{
 const json=JSON.stringify(original)
 for(let i=0;i<=json.length;i+=3){
  const {route}=checked(json.slice(0,i))
  assert.ok(route.concepts.length>0)
  assert.ok(route.concepts.every(c=>c.learningSummary&&c.goalAlignment.materialAnchors.length===0))
 }
 assert.deepEqual(checked(json).route,checked(json).route)
})
test('empty, prose, hostile keys and unusual field types remain bounded and use the real goal',()=>{
 for(const value of ['',null,[],{},42,'not JSON','{"__proto__":{"polluted":true}}',{stages:[null,{},false,{carriers:[{title:[],concepts:[null]}]}]}]){
  const {route,recovered}=checked(value)
  assert.equal(recovered.basis,'goal');assert.equal(route.concepts[0].title,input.goalContext.rawGoal)
 }
 assert.equal({}.polluted,undefined)
 assert.doesNotThrow(()=>checked('['.repeat(500)+'}'.repeat(500)))
 assert.deepEqual(readDamagedPlan('{"title":"公式 \\alpha"}')[0].title,'公式 \\alpha')
})
test('only real material anchors and verbatim personal statements survive recovery',()=>{
 const p=structuredClone(original)
 p.learningGoal={outcome:'理解矩阵',successCriteria:['解释变换'],motivation:'用户喜欢编程',startingPoint:'我会四则运算',constraints:['只学数学','每周十小时'],nonGoals:[],assumptions:['用户是工程师']}
 p.stages[0].carriers[0].concepts[0].goalAlignment={materialAnchors:[{ref:'F1',quote:'矩阵变换保留线性组合',role:'direct',connection:'理解变换性质'},{ref:'F2',quote:'未知文献',role:'direct',connection:'假的引用'}]}
 const {route}=checked(p)
 assert.equal(route.learningGoal.motivation,'');assert.deepEqual(route.learningGoal.assumptions,[]);assert.deepEqual(route.learningGoal.constraints,['只学数学'])
 assert.equal(route.concepts[0].goalAlignment.materialAnchors.length,1);assert.equal(route.concepts[0].goalAlignment.materialAnchors[0].sourceId,'owned')
})
test('legacy graph output is recovered in listed order, ignoring cyclic and dangling model edges',()=>{
 const {route}=checked({carriers:[{id:'a',title:'A'},{id:'b',title:'B'}],concepts:[{title:'第一项',carrierId:'a'},{title:'第二项',carrierId:'b'}],carrierEdges:[{fromCarrierId:'b',toCarrierId:'a'},{fromCarrierId:'a',toCarrierId:'a'}]})
 assert.deepEqual(route.concepts.map(c=>c.title),['第一项','第二项']);assert.equal(route.carrierEdges.length,1)
})
test('oversized and wide stages are packed into a finite straight route',()=>{
 const {route}=checked({stages:Array.from({length:30},(_,i)=>({parallel:true,carriers:Array.from({length:3},(_,n)=>carrier(`${i}-${n}`))}))})
 assert.ok(route.concepts.length<=64);assert.ok(route.carriers.length<=16)
 assert.match(route.concepts.at(-1).detailedDescription,/29-2/)
})

test('explicit legacy stage arrays preserve parallel carriers; every bounded stage topology remains renderable',()=>{
 const two=checked({stages:[[carrier('A'),carrier('B')],[carrier('C')]]})
 assert.equal(two.recovered.linear,false);assert.equal(two.route.entryConceptIds.length,2)
 for(let count=1;count<=16;count++){
  checked({stages:Array.from({length:count},(_,i)=>({parallel:i%2===0,carriers:i%2===0?[carrier(`${i}-A`),carrier(`${i}-B`)]:[carrier(`${i}-C`)]}))})
 }
})

test('wide input matrix compiles every malformed variant and preserves known topology and real source bounds',()=>{
 const raw=JSON.stringify(original)
 const variants=[raw,'```json\n'+raw+'\n```','说明：'+raw+'以上。',raw.replaceAll('"parallel":true','parallel: True'),raw.replaceAll('"parallel":true','"parallel":"并列"'),raw.replaceAll('"title"','name'),raw.replaceAll('"concepts"','"topics"'),raw.replaceAll('"description"','"summary"'),raw.replaceAll('},{','},,{'),raw.replaceAll('}]','},]'),raw.replaceAll('"A"','"😀中文é"'),{result:original},{data:original},{plan:original},{route:original}]
 for(const input of variants)assert.ok(checked(input).route.concepts.length>0)
 for(let i=0;i<raw.length;i++)checked(raw.slice(0,i))
 for(const parallel of [true,1,'true','TRUE','并行','并列']){const v=structuredClone(original);v.stages[1].parallel=parallel;assert.deepEqual(checked(v).recovered.plan.stages.map(s=>s.length),[1,2,1])}
 for(const key of ['stages','carriers','concepts'])for(const bad of [null,false,12,'invalid',{},[null,false,{},[]]])checked({[key]:bad})
 for(const goal of ['', '学习', '😀'.repeat(4000), '数学\n代码\tJSON', '我不学编程，只想理解公式。'])checked('',{goal,goalContext:{rawGoal:goal}})
})

test('the task reminder preserves full original intent and gives each exact repeated sentence one final mention',async()=>{
 const {routeTaskFocus}=await import('./direct-route.ts')
 const repeated='我想学习 Python 字符串。',last='当前只需要分清路径和正则的转义。',goal=repeated.repeat(100)+last
 const focus=routeTaskFocus({goal},'plan')
 assert.ok(focus.includes(goal));const reminder=focus.split('用户原话去除完全重复句后的核对')[1]
 assert.ok(reminder);assert.equal(reminder.split(repeated).length-1,1);assert.ok(reminder.endsWith(last))
})
