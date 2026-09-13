import test from 'node:test'
import assert from 'node:assert/strict'
import {parseAnswerJson} from './answer-normalization.ts'
import {validateComposition} from './answer-composition.ts'
import {paragraphDraft} from '../durable/stream-draft.ts'
const view={cards:[{ref:'C1',title:'材料',content:'完整实际材料'}]}
test('completed prose repairs illegal escapes and joins numbered continuations without dropping text',()=>{
 const raw=String.raw`{"sourceReview":[{"ref":"C1","contribution":"解释输入和输出"}],"sections":[{"after":"C1","title":"输入输出","text":"路径 C:\work\project，算式 \(x\)。","text3":"最后核对输出。","text2":"接着检查中间过程。","metadata":"展示无关信息"}]}`
 const answer=validateComposition(parseAnswerJson(raw),view,8,true)
 assert.equal(answer.sections[0].text,String.raw`路径 C:\work\project，算式 \(x\)。`+'\n\n接着检查中间过程。\n\n最后核对输出。')
 assert.match(paragraphDraft(raw,true),/接着检查中间过程/)
})
test('literal newlines inside strings survive, valid escapes stay unchanged, and unfinished JSON never becomes success',()=>{
 const raw='{"sections":[{"after":"C1","title":"标题","text":"第一行\n第二行"}]}'
 assert.equal(parseAnswerJson(raw).sections[0].text,'第一行\n第二行')
 const original={sections:[{after:'C1',title:'公式',text:String.raw`\frac{x}{2}`}]}
 assert.deepEqual(parseAnswerJson(JSON.stringify(original)),original)
 for(const broken of ['{"sections":[{"text":"未完成','{"sections":[{"text":"完整内段"}'] )assert.throws(()=>parseAnswerJson(broken))
})
test('format normalization cannot invent source reviews, permit foreign references or discard non-string continuations',()=>{
 for(const section of [{after:'C9',title:'标题',text:'正文'},{after:'C1',title:'标题',text:'正文',text2:{body:'不能丢弃'}}])assert.throws(()=>validateComposition({sourceReview:[{ref:'C1',contribution:'依据'}],sections:[section]},view,8,true))
 assert.throws(()=>validateComposition({sections:[{after:'C1',title:'标题',text:'正文'}]},view,8,true))
})

test('complete formal envelopes normalize comments, commas, key quotes, single quotes and escaped prose',()=>{
 const value={sections:[{after:'C1',title:'标题',text:'正文包含 "quote" 和 🧑🏽‍💻。'}]},raw=JSON.stringify(value)
 const variants=[raw,'说明\n```json\n'+raw+'\n```\n以上。',raw.replace('"sections"','sections'),raw.replace('"after":"C1"',"'after':'C1'"),raw.replace('"title"','/* title */"title"'),raw.replace('"title"','// 注释\n"title"'),raw.replace('"C1",','"C1" '),raw.replace('}]}','},],}'),raw.replaceAll('\\"quote\\"','"quote"')]
 for(const input of variants)assert.deepEqual(parseAnswerJson(input),value,input)
})

test('literal backslashes, Unicode, code fences, nested examples and every escape survive normalization',()=>{
 const bodies=[String.raw`C:\work\file.md; \w+; \q; \alpha`,String.raw`{"sections":[{"text":"代码中的示例，不是实际输出"}]}`,'```json\n{"a":"\\n"}\n```','中文 é 🧑🏽‍💻 \t\n\r\b\f','$$x=1$$\n$$y=2$$','中文引号“保留”，英文引号"保留"。','https://example.test/a//b /* 这是正文 */','{}[]😀'.repeat(10000)]
 for(const text of bodies){const value={sections:[{after:'C1',title:'标题',text}]};assert.deepEqual(parseAnswerJson(JSON.stringify(value)),value)}
})

test('bounded repairs refuse incomplete formal output and executable wrappers without evaluating data',()=>{
 for(const raw of ['', 'only reasoning', '{"sections":[{"after":"C1","text":"半段', '{"sections":[{"after":"C1","text":"全文"}]', '{'+ ' '.repeat(2_000_001),'{a:'.repeat(90)+'1'+ '}'.repeat(90)]){
  assert.throws(()=>parseAnswerJson(raw))
 }
 const hostile=parseAnswerJson('{"__proto__":{"polluted":true},"sections":[]}');assert.equal({}.polluted,undefined);assert.equal(hostile.sections.length,0)
})

test('presentation-only headings and one explicit answer wrapper do not regenerate prose or change code',()=>{
 const result=validateComposition({answer:{sections:[{after:'c 1',title:'## 标题',text:'# 一级\n\n## 二级\n\n```md\n# 保留代码\n```'}]}},view,8,false)
 assert.equal(result.sections[0].title,'标题');assert.equal(result.sections[0].after,'C1');assert.equal(result.sections[0].text,'### 一级\n\n### 二级\n\n```md\n# 保留代码\n```')
})

test('internal review extras and exact duplicates do not rewrite complete prose or weaken citation scope',()=>{
 const cards=Array.from({length:6},(_,i)=>({ref:`C${i+1}`,title:`材料${i+1}`,content:`实际内容${i+1}`})),sourceReview=cards.map(c=>({ref:c.ref,contribution:'实际资料的阅读记录'})),sections=[{after:'C2',title:'一节讲解',text:'已有完整正文。'}]
 for(const extra of ['routeContext','C0','F1','C99','学习目标',null]){
  const actual=validateComposition({sourceReview:[...sourceReview,{ref:extra,contribution:'附加上下文备注'},sourceReview[0]],sections},{cards},8,true)
  assert.deepEqual(actual,{sourceReview,sections})
 }
 for(const notation of ['[C2]','`c2`','Ｃ２','C02'])assert.equal(validateComposition({sourceReview,sections:[{...sections[0],after:notation}]},{cards},8,true).sections[0].after,'C2')
 assert.throws(()=>validateComposition({sourceReview:sourceReview.slice(1),sections},{cards},8,true),'missing actual review must not be fabricated')
 assert.throws(()=>validateComposition({sourceReview,sections:[{...sections[0],after:'F1'}]},{cards},8,true),'unknown paragraph parents are not reading-log metadata')
})
