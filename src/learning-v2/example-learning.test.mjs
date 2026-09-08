import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {showcaseRoutes,SHOWCASE_VERSION,homeSuggestions} from '../showcase/content.ts'
import {showcaseBlueprints,showcaseLearning,showcaseSources} from '../showcase/catalog.ts'
import {buildPathDocument} from '../pathDocument.ts'
import {validateTree,LearningSchema} from '@threadpeak/contracts/learning-v2'
import {validateRendererDocument} from '../path-3d/validate-renderer-document.ts'
import {resolvePath3DView} from '../path-3d/resolved-path-document.ts'
import {preflightLearningPath} from '../vendor/learning-path-3d/index.js'
import {prepareMarkdown} from '../lib/markdown-source.ts'
import {renderMath} from '@threadpeak/contracts/math-normalize'
const review=JSON.parse(readFileSync(new URL('../../qa/evidence/showcase/source-review.json',import.meta.url),'utf8'))
const sha=text=>createHash('sha256').update(text).digest('hex')

test('all five investor scenarios have a real goal, a stated starting point, three suggestions and a free response',()=>{
  assert.equal(showcaseRoutes.length,5)
  assert.equal(showcaseRoutes.flatMap(r=>r.concepts).length,22)
  assert.equal(homeSuggestions.length,5)
  for(const r of showcaseRoutes){
    assert.equal(r.interview.options.length,3)
    for(const text of [r.outcome,r.startingPoint,r.omitted,r.interview.answer])assert.ok(text.length>15)
    assert.deepEqual(r.stages.flat().flatMap(s=>s.conceptIds).sort(),r.concepts.map(c=>c.id).sort())
    assert.ok(homeSuggestions.some(s=>s.prompt===r.prompt))
  }
})

test('every concept has explicitly reviewed Zhihu evidence and the original summary hash is unchanged',()=>{
  assert.equal(review.conceptCount,22)
  for(const c of showcaseRoutes.flatMap(r=>r.concepts)){
    const audit=review.entries.find(e=>e.conceptId===c.id)
    assert.ok(audit?.query&&audit.rejectionReason,c.id)
    const articles=showcaseSources[c.id]
    assert.equal(articles.length,audit.selected.length)
    for(const a of articles){
      const proof=audit.selected.find(s=>s.id===a.id)
      assert.equal(sha(a.summary),proof.summarySha256,c.id)
      assert.equal(a.url,proof.url);assert.equal(a.author,proof.author)
      assert.match(new URL(a.url).hostname,/(^|\.)zhihu\.com$/)
      assert.ok(a.curation?.why&&a.curation?.caveat)
      assert.ok(audit.candidates.some(s=>s.selected&&s.url===a.url))
    }
  }
})

for(const route of showcaseRoutes){
  test(`${route.id}: real tree, conversation and goal alignment for every concept`,()=>{
    for(const c of route.concepts){
      const learning=showcaseLearning(route.id,c.id)
      assert.doesNotThrow(()=>LearningSchema.parse(learning))
      assert.doesNotThrow(()=>validateTree(learning.nodes))
      assert.equal(learning.goalContext.rawGoal,route.prompt)
      assert.equal(learning.goalContext.conceptAlignment.purpose,c.purpose)
      const nodes=new Map(learning.nodes.map(n=>[n.id,n]))
      const sourceIds=new Set(learning.articles.map(a=>a.id))
      const paragraphs=learning.conversations[0].messages.flatMap(m=>m.paragraphs??[])
      assert.equal(paragraphs.length,5)
      for(const p of paragraphs){
        assert.equal(p.parents.length,1)
        assert.equal(p.basisId,p.parents[0])
        assert.deepEqual(nodes.get(p.id).parents,p.parents)
        assert.equal(nodes.get(p.id).text,p.text)
        assert.ok(p.sources.every(id=>sourceIds.has(id)))
      }
      assert.ok(nodes.get(paragraphs.at(-1).id).text.includes(route.outcome))
      for(const anchor of learning.goalContext.conceptAlignment.materialAnchors){
        assert.ok(learning.articles.find(a=>a.id===anchor.sourceId)?.summary.includes(anchor.quote))
      }
      if(route.id==='attention-paper')assert.equal(learning.goalContext.conceptAlignment.materialAnchors.length,1)
      if(route.id==='numpy-collection'){assert.equal(learning.articles.length,4);assert.equal(learning.goalContext.conceptAlignment.materialAnchors.length,1)}
    }
  })
}

test('all route documents pass the real renderer contract and cannot become mine or fallback results',()=>{
  for(const b of showcaseBlueprints){
    const document=buildPathDocument({...b,id:b.documentId})
    assert.ok(document.id.endsWith(SHOWCASE_VERSION))
    const result=validateRendererDocument(document)
    assert.equal(result.ok,true,JSON.stringify(result))
    assert.equal(preflightLearningPath(document).ok,true,b.id)
    assert.equal(resolvePath3DView({routeId:b.id,route:{...b,document}}).kind,'ready')
    assert.equal(resolvePath3DView({routeId:b.id,route:{...b,owner:'mine',document}}).kind,'unavailable')
  }
  assert.equal(resolvePath3DView({routeId:'missing'}).kind,'unavailable')
})

test('the job route requires evidence and tools in parallel before joint evaluation, without a sibling dependency',()=>{
  const b=showcaseBlueprints.find(r=>r.id==='llm-application')
  const {structure:s}=buildPathDocument({...b,id:b.documentId})
  const edges=s.flow.map(e=>[e.fromSubjectId,e.toSubjectId])
  assert.ok(edges.some(([a,b])=>a==='carrier-job-contract'&&b==='carrier-job-evidence'))
  assert.ok(edges.some(([a,b])=>a==='carrier-job-contract'&&b==='carrier-job-tools'))
  for(const id of ['carrier-job-evidence','carrier-job-tools'])assert.ok(edges.some(([a,b])=>a===id&&b==='carrier-job-deliver'))
  assert.ok(!edges.some(([a,b])=>['carrier-job-evidence','carrier-job-tools'].includes(a)&&['carrier-job-evidence','carrier-job-tools'].includes(b)))
  assert.deepEqual(s.flowGroups.map(g=>[g.type,g.policy]),[['split','parallel'],['join','all-required']])
})

test('all authored mathematical expressions render, and fenced program samples remain code',()=>{
  let formulaCount=0,codeCount=0
  for(const c of showcaseRoutes.flatMap(r=>r.concepts))for(const source of [...c.sections.map(s=>s.text),c.answer]){
    const prepared=prepareMarkdown(source)
    for(const m of prepared.math){assert.equal(renderMath(m.tex,m.display).kind,'rendered',`${c.id}: ${m.tex}`);formulaCount++}
    for(const match of source.matchAll(/```(?:python|js|javascript)\n([\s\S]*?)```/g)){
      assert.equal(prepareMarkdown(match[0]).math.length,0,c.id)
      assert.ok(prepared.markdown.includes(match[1]),c.id);codeCount++
    }
  }
  assert.ok(formulaCount>20);assert.ok(codeCount>=5)
})
