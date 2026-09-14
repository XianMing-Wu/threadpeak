import test from 'node:test'
import assert from 'node:assert/strict'
import {recoverStructuredValue,readableExcerpt} from './output-recovery.ts'
import {parseAgentOutput} from '../agent-runtime/schemas.ts'
import {RouteInterviewSchema,validateCatalogNames} from '../path-generation/direct-route.ts'
import {LEARNING_TOOL_SPECS} from './agent-specs.ts'
import {AuthorPlanSchema,authorEvidenceScope,validateAuthorMatches} from './authors-search.ts'
import {authorCardCandidates} from './author-card-selection.ts'
import {readCardScope} from '../knowledge/card-tools.ts'
import {validateComposition,citationCatalog,attachComposition} from '../knowledge/answer-composition.ts'
import {validateAnswerMath,repairAnswerPresentation} from './math-output.ts'

const cards=[{id:'owned-1',title:'矩阵乘法',content:'矩阵乘法使用行与列的点积。必须先检查内维度相等。'},{id:'owned-2',title:'向量',content:'向量由有序的数构成，顺序具有含义。'}],scope=readCardScope(cards)
const originals=[{evidenceId:'real-1',authorId:'author-one',authorName:'真实作者一',title:'矩阵运算',summary:'矩阵乘法使用行列点积。实际计算应核对维度。',url:'https://www.zhihu.com/question/123/answer/456',uses:[]},{evidenceId:'real-2',authorId:'author-one',authorName:'真实作者一',title:'同作者另一文',summary:'矩阵也可表达连续变换。',url:'https://www.zhihu.com/question/123/answer/457',uses:[]},{evidenceId:'real-3',authorId:'author-two',authorName:'真实作者二',title:'其他说明',summary:'向量可作为矩阵的一列。',url:'https://www.zhihu.com/question/123/answer/458',uses:[]}]
const catalog=authorCardCandidates(originals),authorScope=authorEvidenceScope(originals)
const common={goal:'理解矩阵运算',currentQuestion:'矩阵乘法与向量是什么关系？',goalContext:{rawGoal:'理解矩阵运算',userStatements:[]},concept:{title:'矩阵乘法'},searchScope:{kind:'zhihu'},attachments:[],firstSearch:{summary:'课程甲介绍点积。'}}
const answer={sections:[{after:'C2',title:'先看向量',text:'向量由有序的数构成。'},{after:'C1',title:'再看矩阵',text:'行与列做点积，先检查内维度。'}]}
const checks=[
 ['R1',common,v=>assert.equal(parseAgentOutput('R1',v).ok,true)],
 ['R2-names:v6',common,v=>validateCatalogNames(v,common.searchScope,[common.firstSearch.summary])],
 ['R3:v6',common,v=>RouteInterviewSchema.parse(v)],
 ...[1,2,3].map(activeRound=>['R3b',{...common,activeRound},v=>assert.equal(parseAgentOutput('R3b',v,{activeRound}).ok,true)]),
 ...['L-search-plan','A-card-plan'].map(name=>[name,common,v=>LEARNING_TOOL_SPECS[name].schema.parse(v)]),
 ['L-source-select',{...common,candidates:originals},v=>{LEARNING_TOOL_SPECS['L-source-select'].schema.parse(v);assert.ok(v.evidenceIds.every(id=>originals.some(o=>o.evidenceId===id)))}],
 ['A-card-select:refs-v2',{...common,candidates:catalog.candidates,excludedAuthorIds:[]},v=>{LEARNING_TOOL_SPECS['A-card-select'].schema.parse(v);catalog.resolve(v.selections)}],
 ['N1:brief-v4',common,v=>AuthorPlanSchema.parse(v)],
 ['N2:fit-v6',{...common,candidates:authorScope},v=>validateAuthorMatches(v,{candidates:authorScope},originals)],
 ['L-answer:compose-v4',{...common,mode:'first_learning',answerBounds:{maxCards:8},read_card_scope:scope.view},v=>{validateComposition(v,scope.view,8,true);v.sections.forEach(s=>validateAnswerMath(s.text))}],
 ['L-answer:attach-v4',{...common,answerSections:answer.sections.map((s,i)=>({ref:`P${i+1}`,...s})),citationCatalog:citationCatalog(scope.view)},v=>{const out=attachComposition(scope,answer,citationCatalog(scope.view),v);assert.deepEqual(out.map(p=>p.basisId),['owned-2','owned-1'])}],
]
const malformed=['','null','[]','42','"plain"','解释而非JSON','```json\n{','{"result":{"queries":["a","b"]}',JSON.stringify({queries:[null,{},1,'x'.repeat(700)],questions:[{},null],sections:[{after:'C999',text:'无来源内容'}],placements:[{section:'P1',after:'C999',evidenceRefs:['E999']}],selections:[{evidenceId:'E999',sourceRef:'E999',passageRefs:['P999']}],carriers:[null,'不存在的书']}),'{"__proto__":{"polluted":true}}','{result:{data:{output:{questions:[]}}}}','{selections:[{sourceRef:"E1",passageRefs:["P999"]}]}','{"queries":false,"questions":false,"sections":false}','{"questions":[{"prompt":"哪个？","options":[{},null]}]}']

test('every active structural step recovers diverse malformed outputs without provider replay',()=>{
 for(const [name,input,validate] of checks)for(const raw of malformed){
  const before=structuredClone(input)
  let result;try{result=recoverStructuredValue(name,raw,input);validate(result)}catch{result=recoverStructuredValue(name,raw,input,true);validate(result)}
  assert.deepEqual(input,before)
 }
 assert.equal({}.polluted,undefined)
})
test('each truncation offset of a multi-card answer preserves scope and produces a readable composition',()=>{
 const raw=JSON.stringify(answer),input={...common,mode:'first_learning',answerBounds:{maxCards:8},read_card_scope:scope.view}
 for(let i=0;i<=raw.length;i++){
  const result=recoverStructuredValue('L-answer:compose-v4',raw.slice(0,i),input)
  validateComposition(result,scope.view,8,true)
  assert.ok(result.sections.every(s=>['C1','C2'].includes(s.after)))
 }
})
test('same-author selections deduplicate; excluded identity cannot re-enter through malformed IDs',()=>{
 const input={...common,candidates:catalog.candidates,excludedAuthorIds:['author-one']}
 const out=recoverStructuredValue('A-card-select',JSON.stringify({selections:[{evidenceId:'E1'},{evidenceId:'E2'},{evidenceId:'E3'}]}),input)
 assert.deepEqual(out.selections.map(s=>s.evidenceId),['E3'])
})
test('source bindings and code variables stay intact when normalizing presentation',()=>{
 const raw=JSON.stringify({sections:[{after:'C1',title:'示例',text:'代码变量 C1 和 P1 保留。\n\n```python\nC1 = "\\n"\n```'}]})
 const out=recoverStructuredValue('L-answer:compose-v4',raw,{...common,read_card_scope:scope.view})
 assert.match(out.sections[0].text,/C1 =/)
 const broken='文字\n\n$$\\unknownmacro{a}$$\n\n```python\nx = "$$  $$"\n```'
 const repaired=repairAnswerPresentation(broken)
 assert.match(repaired,/unknownmacro/);assert.match(repaired,/x = "\$\$  \$\$"/)
 assert.doesNotThrow(()=>validateAnswerMath(repaired))
})
test('extractive fallback includes original statements from different positions',()=>{
 const original='条件甲适用初学者。\n重复铺陈。\n条件乙适用已有基础者。\n另一种限制。\n结论仍需核验。'
 const summary=readableExcerpt(original,70)
 for(const line of summary.split('\n'))assert.ok(original.includes(line))
 assert.match(summary,/条件乙/);assert.match(summary,/结论仍需核验/)
})

 test('a string cut mid-sentence is not published as a complete claim',()=>{
 const raw='{"sections":[{"after":"C1","title":"结论","text":"矩阵乘法一定'
 const out=recoverStructuredValue('L-answer:compose-v4',raw,{...common,read_card_scope:scope.view})
 assert.ok(out.sections.every(s=>!s.text.includes('矩阵乘法一定')))
 })

test('source excerpts preserve decimals and attribution repair preserves code and formulas',async()=>{
 const {repairSourceAttributions}=await import('./output-recovery.ts')
 const source='基础风险是0.1%，变化后为0.2%。时间为1.5年。'
 const excerpt=readableExcerpt(source,200)
 assert.ok(excerpt.includes('0.1%'));assert.ok(excerpt.includes('0.2%'));assert.ok(excerpt.includes('1.5年'))
 const value='C1 里提到向量，C1 和 C2 都说明维度。根据 C2 提供的内容。变量 `C1` 和 $C2$ 原样。\n```js\nconst C1 = 3\n```'
 const fixed=repairSourceAttributions(value,[{ref:'C1',title:'向量'},{ref:'C2',title:'维度'}])
 assert.ok(fixed.includes('《向量》 里提到'));assert.ok(fixed.includes('根据 《维度》'))
 assert.ok(fixed.includes('`C1` 和 $C2$'));assert.ok(fixed.includes('const C1 = 3'))
})

test('direct author fit requires direct coverage of every current need, not topic overlap',()=>{
 const base={sourceRef:'E1',passageRefs:['P1'],fit:'direct',reason:'包含相关解释',canHelpWith:'理解概念',limitation:'没有实际复盘记录',question:'是否有实践记录？',messageBody:'我想了解实际调整过程。'}
 const input={candidates:authorScope,needRefs:[{ref:'N1',text:'实际尝试'},{ref:'N2',text:'失败复盘'}]}
 for(const needsCoverage of [undefined,[],[{needRef:'N1',support:'direct'},{needRef:'N2',support:'none'}],[{needRef:'N1',support:'direct'},{needRef:'N1',support:'direct'}]]){
  const result=validateAuthorMatches({selections:[{...base,needsCoverage}],unresolved:''},input,originals)
  assert.equal(result.selections[0].fit,'related')
 }
 const result=validateAuthorMatches({selections:[{...base,coverageLimitations:[],needsCoverage:[{needRef:'N1',support:'direct'},{needRef:'N2',support:'direct'}]}],unresolved:''},input,originals)
 assert.equal(result.selections[0].fit,'direct')
 const missing=validateAuthorMatches({selections:[{...base,coverageLimitations:['缺少实际场景'],contactLimitations:['联系意愿未知'],needsCoverage:[{needRef:'N1',support:'direct'},{needRef:'N2',support:'direct'}]}],unresolved:''},input,originals)
 assert.equal(missing.selections[0].fit,'related');assert.match(missing.selections[0].limitation,/缺少实际场景/)
})
