import test from 'node:test';import assert from 'node:assert/strict'
import {compileStagedPlan,StagedPlanSchema,salvageGoalPlan,validateGoalPlan} from './staged-plan.ts'
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
test('salvageGoalPlan turns dumped R4 JSON and missing alignment into a compilable plan',()=>{
  const dumped={
    version:'1.0',title:'线性代数入门',extra:true,
    carriers:[{id:'c1',title:'线性代数',description:'基础'},{id:'c2',title:'矩阵',description:'表示'}],
    concepts:[
      {id:'n1',carrierId:'c1',title:'向量空间',detailedDescription:'先建立对象',hasDispute:false,attachmentSourceIds:[]},
      {id:'n2',carrierId:'c1',title:'线性映射',detailedDescription:'保运算',hasDispute:true,attachmentSourceIds:['owned']},
      {id:'n3',carrierId:'c2',title:'矩阵表示',detailedDescription:'坐标',hasDispute:false,attachmentSourceIds:[]},
    ],
    carrierEdges:[{fromCarrierId:'c1',toCarrierId:'c2'}],
    conceptEdges:[{fromConceptId:'n1',toConceptId:'n2'},{fromConceptId:'n2',toConceptId:'n3'}],
    entryConceptIds:['n1'],
  }
  const prepared={attachments:[{ref:'F1',sourceId:'owned',content:'坐标表示基下的分量。'}],goalContext:{rawGoal:'以学校考试为目标的线性代数入门',userStatements:[]}}
  const plan=validateGoalPlan(salvageGoalPlan(dumped,prepared),prepared)
  const route=compileStagedPlan(plan,'scope',['owned'])
  assert.equal(projectRouteToDocument(route).ok,true)
  assert.ok(plan.stages.flat().some(carrier=>carrier.title==='线性代数'))
  assert.ok(plan.stages.flatMap(stage=>stage.flatMap(carrier=>carrier.concepts)).some(concept=>concept.title==='线性映射'))
  const messy={title:'路线',stages:[[{title:'入门',concepts:[{title:'坐标'}]}]],learningGoal:{outcome:'读懂收藏',motivation:'我自己编的动机',successCriteria:['会举例'],startingPoint:'',constraints:[],nonGoals:[],assumptions:['收入稳定'],openQuestions:[]}}
  const repaired=validateGoalPlan(salvageGoalPlan(messy,{goalContext:{rawGoal:'读懂收藏',userStatements:[]},attachments:[]}),{goalContext:{rawGoal:'读懂收藏',userStatements:[]},attachments:[]})
  assert.equal(repaired.learningGoal.assumptions.length,0)
  assert.equal(repaired.learningGoal.motivation,'')
  assert.ok(repaired.stages[0][0].concepts[0].goalAlignment)
})
