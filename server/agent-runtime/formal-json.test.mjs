import test from 'node:test'
import assert from 'node:assert/strict'
import {parseFormalJson,formalRef} from './formal-json.ts'
import {normalizeStepOutput} from './normalize-step-output.ts'
import {groundedCatalogNames,validateCatalogNames} from '../path-generation/direct-route.ts'

test('complete formal JSON preserves diverse strings and escaped code',()=>{
 const parts=['中文😀','\\begin{pmatrix}','"quoted"',"it's",'\n\t\r\b','{}[]','// /* */','\\u3000','C:\\new\\test','line\u0000end']
 for(let i=0;i<parts.length;i++)for(const part of parts){const value={title:parts[i]+part,items:[{text:part},null,true,3.5]};assert.deepEqual(parseFormalJson(JSON.stringify(value)),value)}
 assert.deepEqual(parseFormalJson('```json\n{queries: ["a", "b",], /* note */}\n```'),{queries:['a','b']})
 assert.deepEqual(parseFormalJson('{"text":"公式 \\alpha"}'),{text:'公式 \\alpha'})
})
test('never salvage an inner success from a truncated or conflicting formal response',()=>{
 for(const raw of ['{"data":{"queries":["a","b"]}', '{"a":1}{"a":2}', '{"a":1} [', '{"text":"open', '{"a":[1,2}', '{/*open'])assert.throws(()=>parseFormalJson(raw))
 assert.throws(()=>parseFormalJson('{"a":'.repeat(70)+'0'+'}'.repeat(70)))
})
test('a dangling field quote cannot swallow following calculation blocks',()=>{
 const raw='{"blocks":[{"kind":"text","text":"假设条件。","},{"kind":"calculation","operation":"dot","operands":[[1,2],[3,4]]}]}'
 assert.deepEqual(parseFormalJson(raw),{blocks:[{kind:'text',text:'假设条件。'},{kind:'calculation',operation:'dot',operands:[[1,2],[3,4]]}]})
 assert.deepEqual(parseFormalJson('{"text":",\\\"}"}'),{text:',"}'})
})
test('repair freshly generated IDs without modifying question meaning or answer shape',()=>{
 const q={prompt:'已知与未知？',reason:'选择条件',options:[{label:'条件甲',routeEffect:'甲的影响'},{label:'条件乙',routeEffect:'乙的影响'},{label:'条件丙',routeEffect:'丙的影响'}]}
 const input={round:1,status:'active',message:'目标',questions:[q,structuredClone(q)]},before=structuredClone(input)
 const result=normalizeStepOutput('R3:v6',input)
 assert.deepEqual(input,before);assert.equal(new Set(result.questions.flatMap(q=>[q.id,...q.options.map(o=>o.id)])).size,8)
 assert.equal(result.questions[1].options[2].label,'条件丙')
 assert.deepEqual(normalizeStepOutput('R3b',{kind:'continue_current',reply:'继续',round:1}),{kind:'continue_current',reply:'继续',round:1})
})
test('unambiguous wrappers, exact duplicates and omitted optional narrative need no new model request',()=>{
 assert.deepEqual(normalizeStepOutput('L-search-plan:v2',{data:{queries:[' a ','b','a']}}),{queries:['a','b']})
 const conflict={data:{queries:['a','b']},result:{queries:['c','d']}}
 assert.deepEqual(normalizeStepOutput('N1',conflict),conflict)
 assert.deepEqual(normalizeStepOutput('N2',{selections:[]}),{selections:[],unresolved:''})
 assert.deepEqual(normalizeStepOutput('N2',{selections:[],unresolved:null}),{selections:[],unresolved:null})
})
test('ground optional catalog lookup in actual sources without inventing names or versions',()=>{
 const sources=['原名 Plain Course, 2nd edition。另见课程甲。'],input={carriers:['Plain Course, 2nd edition','课程甲','课程甲','课程乙','翻译的书名']}
 assert.deepEqual(validateCatalogNames(groundedCatalogNames(input,{kind:'zhihu'},sources),{kind:'zhihu'},sources).carriers,['Plain Course, 2nd edition','课程甲'])
 assert.deepEqual(groundedCatalogNames(input,{kind:'collections'},sources),{carriers:[]})
 assert.deepEqual(input.carriers.length,5)
 assert.equal(formalRef('［ ｃ ０２ ］','C'),'C2');assert.equal(formalRef('C999','C'),'C999')
})
