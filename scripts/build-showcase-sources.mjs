// Repackage only the current, reviewed frozen examples. No provider calls or ranking.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {LearningSchema,validateTree} from '@threadpeak/contracts/learning-v2'
const read=async file=>JSON.parse(await readFile(file,'utf8'))
const sha=text=>createHash('sha256').update(text).digest('hex')
const routes=await read('src/showcase/routes.json'),learnings=await read('src/showcase/learnings.json')
const review=await read('qa/evidence/showcase/source-review.json'),sources={}
for(const route of routes)for(const concept of route.concepts){
 const state=LearningSchema.parse(learnings[concept.id]),audit=review.entries.find(e=>e.conceptId===concept.id)
 if(!state.initialized||state.routeId!==route.id||!audit)throw Error(`UNREVIEWED_LEARNING:${concept.id}`)
 validateTree(state.nodes)
 for(const article of state.articles){
  const proof=audit.selected.find(s=>s.id===article.id)
  if(!proof||sha(article.summary)!==proof.summarySha256||article.url!==proof.url||article.author!==proof.author)throw Error(`SOURCE_CHANGED:${article.id}`)
 }
 if(state.articles.length!==audit.selected.length)throw Error(`SOURCE_SET_CHANGED:${concept.id}`)
 sources[concept.id]=state.articles
}
await writeFile('src/showcase/sources.json',JSON.stringify(sources,null,2)+'\n')
console.log(`Packaged original summaries for ${Object.keys(sources).length} reviewed concepts.`)
