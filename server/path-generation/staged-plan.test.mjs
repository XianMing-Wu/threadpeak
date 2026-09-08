import test from 'node:test';import assert from 'node:assert/strict'
import {compileStagedPlan,StagedPlanSchema,validateGoalPlan} from './staged-plan.ts'
import {projectRouteToDocument} from './project-document.ts'
const item=name=>({title:name,description:'当前阶段的学习目的',concepts:[{title:name+'概念',description:'限定该概念的完整学习范围',hasDispute:false}]})
test('A, (B,C), D compiles exact sequence and parallel edges without model-authored IDs',()=>{
 const plan={title:'路线',stages:[[item('A')],[item('B'),item('C')],[item('D')]]},r=compileStagedPlan(plan,'scope'),name=new Map(r.carriers.map(c=>[c.id,c.title]))
 assert.deepEqual(r.carrierEdges.map(e=>[name.get(e.fromCarrierId),name.get(e.toCarrierId)]),[['A','B'],['A','C'],['B','D'],['C','D']]);assert.deepEqual(compileStagedPlan(plan,'scope'),r);assert.equal(projectRouteToDocument(r).ok,true)
})
test('every bounded stage-width combination compiles into a valid renderer document',()=>{
 for(let code=0;code<256;code++){let n=code;const stages=Array.from({length:4},(_,s)=>{const width=n%4+1;n=Math.floor(n/4);return Array.from({length:width},(_,i)=>item(`${s}-${i}`))});const r=compileStagedPlan({title:'阶段组合',stages},'case-'+code),p=projectRouteToDocument(r);assert.equal(p.ok,true,'case '+code);assert.equal(new Set(r.concepts.map(c=>c.id)).size,r.concepts.length);assert.equal(r.carrierEdges.length,stages.slice(1).reduce((sum,stage,i)=>sum+stage.length*stages[i].length,0))}
})
test('empty stages and invalid content return to the same planner instead of fabricating route nodes',()=>{assert.equal(StagedPlanSchema.safeParse({title:'路线',stages:[[]]}).success,false);assert.throws(()=>compileStagedPlan({title:'路线',stages:[[item('A')],[]]},'scope'))})
test('attachment refs attach only relevant owned sources and cannot invent external IDs',()=>{
 const a=item('A');a.concepts[0].attachmentRefs=['F2'];const r=compileStagedPlan({title:'路线',stages:[[a,item('B')]]},'scope',['owned-a','owned-b'])
 assert.deepEqual(r.concepts[0].attachmentSourceIds,['owned-b']);assert.deepEqual(r.concepts[1].attachmentSourceIds,[])
 a.concepts[0].attachmentRefs=['F3'];assert.throws(()=>compileStagedPlan({title:'路线',stages:[[a]]},'scope',['owned-a','owned-b']))
 assert.equal(StagedPlanSchema.safeParse({title:'路线',stages:[[item('A')]],edges:[]}).success,false)
})
test('new planning rejects old wire objects and incomplete stages without adding fields',()=>{
 const input={goalContext:{rawGoal:'读懂收藏',userStatements:[]},attachments:[]}
 for(const output of [{},{version:'1.0',title:'路线',carriers:[],concepts:[]},{title:'路线',stages:[[item('A')]]}])assert.throws(()=>validateGoalPlan(output,input))
})
