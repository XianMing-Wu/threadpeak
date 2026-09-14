import {showcaseRoutes,showcaseRoute,SHOWCASE_VERSION} from './content.ts'
import sourceData from './sources.json' with {type:'json'}
import learningData from './learnings.json' with {type:'json'}
import {ArticleSchema,LearningSchema,validateTree,type Article,type LearningState} from '@threadpeak/contracts/learning-v2'
import type {RouteBlueprint,FirstLesson} from '../workspace/types.ts'

export const showcaseSources:Record<string,Article[]>=Object.fromEntries(Object.entries(sourceData).map(([id,items])=>[id,items.map(a=>ArticleSchema.parse(a))]))
export const showcaseBlueprints:RouteBlueprint[]=showcaseRoutes.map(route=>({
  id:route.id,owner:'example',title:route.title,summary:route.summary,outcome:route.outcome,
  duration:'按成果检验，不设统一学时',tags:['示例',`${route.concepts.length} 个必要概念`],icon:route.icon,
  documentId:`threadpeak-showcase-${route.id}-${SHOWCASE_VERSION}`,description:route.why,
  goalTitle:'完成这件事',goalSummary:route.outcome,startSummary:route.startingPoint,
  stages:route.stages.map(s=>s.map(c=>c.id)),
  carriers:route.stages.flat().map(stage=>({id:stage.id,title:stage.title,summary:stage.summary,concepts:stage.conceptIds.map(id=>{
    const c=route.concepts.find(c=>c.id===id)!
    return [c.id,c.title,`${c.purpose}\n\n学到这里：${c.depth}\n\n完成检验：${c.check}`] as const
  })})),
}))

export function showcaseLesson(routeId:string,conceptId:string):FirstLesson|undefined {
  const c=showcaseRoute(routeId)?.concepts.find(c=>c.id===conceptId)
  return c?.sections.length?{heading:c.purpose,paragraphs:c.sections.map(p=>p.text),placeholder:c.question}:undefined
}
export function showcaseSourceCount(routeId:string){
  const route=showcaseRoute(routeId)
  return new Set(route?.concepts.flatMap(c=>(showcaseSources[c.id]??[]).map(s=>s.id))).size
}

/** Frozen examples share the actual learning contract; never used as provider fallback. */
export function showcaseLearning(routeId:string,conceptId:string):LearningState|undefined {
  if(!showcaseRoute(routeId)?.concepts.some(c=>c.id===conceptId))return undefined
  const raw=(learningData as Record<string,unknown>)[conceptId]
  if(!raw)return undefined
  const state=LearningSchema.parse(raw)
  if(state.routeId!==routeId||state.conceptId!==conceptId||!state.initialized)throw new Error('SHOWCASE_LEARNING_MISMATCH')
  validateTree(state.nodes)
  return state
}
