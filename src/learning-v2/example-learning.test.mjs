import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {showcaseRoutes,SHOWCASE_VERSION,homeSuggestions} from '../showcase/content.ts'
import {showcaseBlueprints,showcaseLearning,showcaseSources} from '../showcase/catalog.ts'
import {buildPathDocument} from '../pathDocument.ts'
import {validateTree,LearningSchema} from '@threadpeak/contracts/learning-v2'
import {paragraphsMarkdown} from '@threadpeak/contracts/learning-markdown'
import {validateRendererDocument} from '../path-3d/validate-renderer-document.ts'
import {resolvePath3DView} from '../path-3d/resolved-path-document.ts'
import {preflightLearningPath} from '../vendor/learning-path-3d/index.js'
import {prepareMarkdown} from '../lib/markdown-source.ts'
import {renderMath} from '@threadpeak/contracts/math-normalize'
const review=JSON.parse(readFileSync(new URL('../../qa/evidence/showcase/source-review.json',import.meta.url),'utf8'))
const workflows=JSON.parse(readFileSync(new URL('../../qa/evidence/showcase/workflows.json',import.meta.url),'utf8'))
const sha=text=>createHash('sha256').update(text).digest('hex')
const goals=[
 '我想要找到一份agent开发工程师的工作，但是我现在不知道该如何学，请帮我规划',
 '我想要快速理解transformer，请给我规划一下',
 '我想要自己可以使用强化学习对开源模型进行后训练，请给我一个学习路径',
 '我想要从零完整理解二维傅立叶变换和二维卷积之间的关联',
 '我想要学习如何理财，帮我系统规划一下',
 '想要系统的了解明代历史',
]

test('six exact homepage goals and three fully run example scenarios share one catalog',()=>{
 assert.deepEqual(homeSuggestions.map(s=>s.prompt),goals)
 assert.deepEqual(homeSuggestions.map(s=>s.label),goals)
 assert.deepEqual(showcaseRoutes.map(r=>r.prompt),[goals[0],goals[5],goals[4]])
 assert.equal(showcaseRoutes.flatMap(r=>r.concepts).length,23)
 assert.equal(workflows.routes.length,3);assert.equal(workflows.learnings.length,23)
 for(const w of workflows.learnings){assert.equal(w.initialized,true);assert.equal(w.job,'completed');assert.ok(w.llmCalls>=3);assert.ok(w.zhihuCalls>=2);assert.ok(w.maximumConcurrentZhihu<=2)}
 for(const r of showcaseRoutes){
  assert.ok(r.interviews.length>=2&&r.interviews.length<=4)
  for(const q of r.interviews){assert.equal(q.options.length,3);assert.ok(q.answer.length>10)}
  for(const text of [r.outcome,r.startingPoint,r.omitted])assert.ok(text.length>15)
  assert.deepEqual(r.stages.flat().flatMap(s=>s.conceptIds).sort(),r.concepts.map(c=>c.id).sort())
  assert.ok(r.concepts.some(c=>c.id===r.featuredConceptId))
 }
})

test('every selected source retains its real search summary and original identity',()=>{
 assert.equal(review.conceptCount,23)
 for(const c of showcaseRoutes.flatMap(r=>r.concepts)){
  const audit=review.entries.find(e=>e.conceptId===c.id)
  assert.ok(audit?.queries.length>=2&&audit.rejectionReason,c.id)
  assert.ok(audit.realSteps.some(s=>s.startsWith('step-L-answer_compose')))
  const articles=showcaseSources[c.id];assert.equal(articles.length,audit.selected.length)
  for(const a of articles){
   const proof=audit.selected.find(s=>s.id===a.id)
   assert.equal(sha(a.summary),proof.summarySha256,c.id)
   assert.equal(a.url,proof.url);assert.equal(a.author,proof.author)
   assert.match(new URL(a.url).hostname,/(^|\.)zhihu\.com$/)
   assert.ok(audit.candidates.some(s=>s.selected&&s.url===a.url),a.url)
  }
 }
})

for(const route of showcaseRoutes)test(`${route.id}: every concept opens a complete, goal-aligned learning tree`,()=>{
 for(const c of route.concepts){
  const s=showcaseLearning(route.id,c.id)
  assert.doesNotThrow(()=>LearningSchema.parse(s));assert.doesNotThrow(()=>validateTree(s.nodes))
  assert.equal(s.goalContext.rawGoal,route.prompt)
  assert.equal(s.goalContext.conceptAlignment.purpose,c.purpose)
  assert.deepEqual(s.learningSummary,c.learningSummary)
  for(const key of ['focus','boundary','routeConnection','materialConnection'])assert.ok(c.learningSummary[key].length>15)
  assert.ok(s.initialAnswer.length>=3)
  assert.equal(s.initialMarkdown,paragraphsMarkdown(s.initialAnswer,s.articles))
  const nodes=new Map(s.nodes.map(n=>[n.id,n])),sourceIds=new Set(s.articles.map(a=>a.id))
  for(const p of s.conversations.flatMap(c=>c.messages).flatMap(m=>m.paragraphs??[])){
   assert.equal(p.parents.length,1);assert.equal(p.basisId,p.parents[0])
   assert.deepEqual(nodes.get(p.id).parents,p.parents)
   assert.equal(nodes.get(p.id).text,p.text)
   if(!p.author)assert.ok(p.sources.every(id=>sourceIds.has(id)),p.id)
  }
  for(const p of s.initialAnswer)assert.ok(p.sources.length>0&&p.sources.every(id=>sourceIds.has(id)))
  const copy=showcaseLearning(route.id,c.id);copy.nodes[0].text='changed locally'
  assert.notEqual(showcaseLearning(route.id,c.id).nodes[0].text,'changed locally')
 }
})

test('every route has a real parallel split and all-required join accepted by the 3D renderer',()=>{
 for(const b of showcaseBlueprints){
  const document=buildPathDocument({...b,id:b.documentId}),s=document.structure
  assert.ok(document.id.endsWith(SHOWCASE_VERSION))
  const valid=validateRendererDocument(document);assert.equal(valid.ok,true,JSON.stringify(valid))
  assert.equal(preflightLearningPath(document).ok,true,b.id)
  assert.equal(resolvePath3DView({routeId:b.id,route:{...b,document}}).kind,'ready')
  assert.equal(resolvePath3DView({routeId:b.id,route:{...b,owner:'mine',document}}).kind,'unavailable')
  const parallel=b.stages.find(stage=>stage.length===2);assert.ok(parallel,b.id)
  const index=b.stages.indexOf(parallel),edges=s.flow.map(e=>[e.fromSubjectId,e.toSubjectId])
  for(const id of parallel){
   for(const prev of b.stages[index-1])assert.ok(edges.some(([a,z])=>a===prev&&z===id))
   for(const next of b.stages[index+1])assert.ok(edges.some(([a,z])=>a===id&&z===next))
  }
  assert.ok(!edges.some(([a,z])=>parallel.includes(a)&&parallel.includes(z)))
  assert.deepEqual(s.flowGroups.map(g=>[g.type,g.policy]),[['split','parallel'],['join','all-required']])
 }
 assert.equal(showcaseLearning('missing','missing'),undefined)
 assert.equal(resolvePath3DView({routeId:'missing'}).kind,'unavailable')
})

test('three representative concepts include a real follow-up and distinct author cards',()=>{
 for(const r of showcaseRoutes){
  const s=showcaseLearning(r.id,r.featuredConceptId),messages=s.conversations.flatMap(c=>c.messages)
  assert.ok(messages.filter(m=>m.role==='user').length>=3)
  const authors=s.nodes.filter(n=>n.author),audit=review.entries.find(e=>e.conceptId===s.conceptId)
  assert.ok(authors.length>=1&&authors.length<=3,r.id)
  assert.equal(new Set(authors.map(n=>n.id)).size,authors.length)
  assert.equal(new Set(authors.map(n=>n.author.id)).size,authors.length)
  for(const n of authors){
   const proof=audit.authorCards.find(a=>a.id===n.id)
   assert.equal(sha(n.text),proof.summarySha256)
   assert.equal(n.author.evidenceId,proof.evidenceId)
   assert.ok(n.author.matchReason&&n.author.coverageLimit)
  }
 }
})

test('teaching formulas render and complete program samples stay in code fences',()=>{
 let formulas=0,code=0
 for(const r of showcaseRoutes)for(const c of r.concepts){
  const s=showcaseLearning(r.id,c.id)
  for(const p of s.conversations.flatMap(c=>c.messages).flatMap(m=>m.paragraphs??[]).filter(p=>!p.author)){
   const source=p.text,prepared=prepareMarkdown(source)
   assert.doesNotMatch(source,/\\`\\`\\`/)
   assert.equal((source.match(/^```/gm)??[]).length%2,0,c.id)
   for(const m of prepared.math){assert.equal(renderMath(m.tex,m.display).kind,'rendered',`${c.id}: ${m.tex}`);formulas++}
   for(const match of source.matchAll(/```(?:python|js|javascript)\n([\s\S]*?)```/g)){
    assert.equal(prepareMarkdown(match[0]).math.length,0,c.id)
    assert.ok(prepared.markdown.includes(match[1]),c.id);code++
   }
  }
 }
 assert.ok(formulas>0);assert.ok(code>=4)
})
