import { GoalContextSchema, type GoalContext } from '@threadpeak/contracts/learning-goal'
import type { LearningState } from '@threadpeak/contracts/learning-v2'
import {CommandError,type Resource,type DurableStore } from './store.ts'
type GoalPath={goal?:string;conversation?:any[];questionSets?:{questions:{id:string;prompt:string}[]}[];route?:{title?:string;learningGoal?:GoalContext['interpretation'];carriers?:{id:string;title:string;description:string}[];conceptEdges?:{fromConceptId:string;toConceptId:string}[];concepts:{id:string;carrierId?:string;title?:string;detailedDescription?:string;goalAlignment?:GoalContext['conceptAlignment']}[]}}

/** Construct intent only from the owned path, not client-supplied labels or model effects. */
export function pathGoalContext(path:GoalPath,conceptId?:string):GoalContext|undefined{
  if(!path.goal)return undefined
  const userStatements=(path.conversation??[]).filter(m=>m.role==='user'&&m.messageId!=='goal').map(m=>{
    const answer=m.content
    const questionId=answer&&typeof answer==='object'?answer.questionId:undefined
    const question=questionId?(path.questionSets??[]).flatMap(s=>s.questions).find(q=>q.id===questionId)?.prompt:undefined
    return {id:m.messageId,question,text:typeof answer==='string'?answer:answer.customAnswer??answer.label??''}
  }).filter(m=>m.text)
  const route=path.route,concept=route?.concepts.find(c=>c.id===conceptId),carrier=route?.carriers?.find(c=>c.id===concept?.carrierId)
  const neighbors=(direction:'previous'|'next')=>(route?.conceptEdges??[]).filter(e=>direction==='previous'?e.toConceptId===conceptId:e.fromConceptId===conceptId).flatMap(e=>{
    const c=route?.concepts.find(c=>c.id===(direction==='previous'?e.fromConceptId:e.toConceptId))
    return c?.title?[{title:c.title,summary:c.detailedDescription??''}]:[]
  })
  return GoalContextSchema.parse({rawGoal:path.goal,userStatements,
    interpretation:path.route?.learningGoal,
    conceptAlignment:concept?.goalAlignment,
    ...(route?.title&&carrier?{routeContext:{title:route.title,carrier:{title:carrier.title,description:carrier.description},previous:neighbors('previous'),next:neighbors('next')}}:{})})
}

/** Upgrade old owned learning records at every entry point, without inventing missing intent. */
export async function hydrateLearningGoal(store:DurableStore,owner:string,id:string){
  const resource=await store.resource<LearningState>(owner,id)
  if(resource.kind!=='learning'||resource.body.goalContext?.routeContext)return resource
  let path:Resource|undefined
  try{path=await ownedPath(store,owner,resource.body.routeId)}catch(error){if(!(error instanceof CommandError)||error.status!==404)throw error}
  const context=path&&pathGoalContext(path.body,resource.body.conceptId)
  if(!context)return resource
  await store.edit(owner,id,undefined,r=>({...r.body,goalContext:{...context,...r.body.goalContext,...context.routeContext?{routeContext:context.routeContext}:{}}}))
  return store.resource<LearningState>(owner,id)
}

export async function ownedPath(store:DurableStore,owner:string,id:string){
  const paths=await store.db.query<Resource>("SELECT * FROM tp_resources WHERE owner_id=$1 AND kind='path' AND (id=$2 OR body->'document'->>'id'=$2 OR body->'route'->>'routeId'=$2) ORDER BY id",[owner,id])
  const path=paths.find(p=>p.id===id)??(paths.length===1?paths[0]:undefined)
  if(!path||path.body.status!=='published')throw new CommandError('NOT_FOUND',404)
  return path
}
