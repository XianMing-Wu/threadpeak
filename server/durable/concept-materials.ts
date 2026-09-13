import {validateTree,type Article,type LearningState} from '@threadpeak/contracts/learning-v2'
import {inheritedArticles} from './materials.ts'
import {ownedPath} from './learning-goal.ts'
import {CommandError,type DurableStore} from './store.ts'

export const CONCEPT_MATERIAL_VERSION=1
export const isLibraryArticle=(a:Article)=>a.sourceKind==='collection'||a.sourceKind==='creation'
export async function conceptMaterialCandidates(store:DurableStore,owner:string,state:LearningState){
  const path=await ownedPath(store,owner,state.routeId).catch(error=>{if(error instanceof CommandError&&error.code==='NOT_FOUND')return undefined;throw error})
  const candidates=inheritedArticles(path?.body.attachments??[]).filter(isLibraryArticle)
  // Older routes may no longer carry the imported catalog; preserve their real sources.
  return candidates.length?candidates:state.articles.filter(isLibraryArticle)
}
/** Reclassify automatic imports while keeping every cited, edited or parent card intact. */
export function applyConceptMaterials(state:LearningState,candidates:Article[],selectedIds:string[]){
  const allowed=new Set(candidates.map(a=>a.id)),selected=new Set(selectedIds)
  if(selected.size!==selectedIds.length||selectedIds.some(id=>!allowed.has(id)))throw new Error('INVALID_MATERIAL_SELECTION')
  const protectedIds=new Set<string>()
  for(const node of state.nodes){
    if(node.edited)protectedIds.add(node.id)
    if(node.type!=='root'&&node.type!=='article')for(const id of [...node.parents,...node.sources])protectedIds.add(id)
  }
  for(const conversation of state.conversations)for(const message of conversation.messages){
    for(const id of message.selected??[])protectedIds.add(id)
    for(const paragraph of message.paragraphs??[])for(const id of [...paragraph.sources,...paragraph.parents])protectedIds.add(id)
  }
  const existing=new Map(state.articles.map(a=>[a.id,a]))
  const articles=state.articles.filter(a=>!isLibraryArticle(a))
  const ordered=[...selectedIds.map(id=>candidates.find(a=>a.id===id)!),...candidates.filter(a=>!selected.has(a.id))]
  for(const candidate of ordered){
    const article=existing.get(candidate.id)??candidate
    if(selected.has(article.id))articles.push({...article,retainedForHistory:false})
    else if(protectedIds.has(article.id))articles.push({...article,retainedForHistory:true})
  }
  const keep=new Set(articles.map(a=>a.id))
  state.nodes=state.nodes.filter(n=>n.type!=='article'||!allowed.has(n.id)||keep.has(n.id))
  if(articles.length&&!state.nodes.length)state.nodes.push({id:'root',type:'root',title:state.title,text:'',sources:[],parents:[]})
  for(const a of articles)if(!state.nodes.some(n=>n.id===a.id))state.nodes.push({id:a.id,type:'article',title:a.title,text:a.summary,sources:[a.id],parents:['root']})
  const root=state.nodes.find(n=>n.type==='root')
  if(root)root.sources=articles.map(a=>a.id)
  state.articles=articles
  state.materialSelection={version:CONCEPT_MATERIAL_VERSION,selectedIds}
  validateTree(state.nodes)
  return state
}
export async function ensureConceptMaterials(store:DurableStore,owner:string,id:string){
  const resource=await store.resource<LearningState>(owner,id)
  if(resource.kind!=='learning'||!resource.body.initialized||resource.body.materialSelection?.version===CONCEPT_MATERIAL_VERSION)return false
  const key=`concept-materials:${CONCEPT_MATERIAL_VERSION}:${id}`
  // A read must not change a previously accepted command when the user switches chats.
  // Cancelled/failed work remains available through the explicit resume action.
  if(await store.existingCommand(owner,key))return false
  const candidates=await conceptMaterialCandidates(store,owner,resource.body)
  if(!candidates.length)return false
  try{
    await store.enqueue(owner,id,'learning.materials',key,{depth:'fast',conversationId:resource.body.active})
    return true
  }catch(error){if(error instanceof CommandError&&(['BUSY','ACCOUNT_BUSY'].includes(error.code)||error.code==='COMMAND_CONFLICT'&&await store.existingCommand(owner,key)))return false;throw error}
}
