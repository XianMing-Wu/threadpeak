import {applyConceptMaterials,conceptMaterialCandidates,CONCEPT_MATERIAL_VERSION} from './concept-materials.ts'
import {searchInPairs} from '../knowledge/search-planning.ts'
import {paragraphsMarkdown} from '@threadpeak/contracts/learning-markdown'
import { pathGoalContext } from './learning-goal.ts'
import {authorCardCandidates} from './author-card-selection.ts'
import type { GoalExploration } from '../path-generation/goal-exploration.ts'
import { explorationForPlanning,mergeSearchSummaries } from '../path-generation/carrier-exploration.ts'
import {DIRECT_ROUTE_VERSION} from '../path-generation/direct-route.ts'
import type {SearchScope} from '@threadpeak/contracts/search-scope'
import {searchMetadataOf} from '@threadpeak/contracts/search-scope'
import {presentSource} from './source-presentation.ts'
import { inheritedArticles } from './materials.ts'
import { preparePdf } from './materials.ts'
import { importZhihuMaterial } from './materials-http.ts'
import type { ZhihuDataClient } from './zhihu-data.ts'
import type { ZhihuLogin } from './zhihu-oauth.ts'
import { searchAuthors } from './authors-search.ts'
import { recordAuthorUse,readAuthorNetwork,knownSourceIdentity,safeZhihuUrl } from './authors-network.ts'
import { randomUUID } from 'node:crypto'
import type { R1Output, R2Output, R3Output, R3bOutput, R4Output } from '../agent-runtime/schemas.ts'
import type { SearchEvidence } from '../agent-runtime/types.ts'
import { packZhihuSearchQueries } from '../agent-runtime/pack-search.ts'
import {evidenceUrlKey} from '../agent-runtime/evidence-url.ts'
import { projectRouteToDocument } from '../path-generation/project-document.ts'
import type { LearningState, GraphNode, Paragraph, Article } from '@threadpeak/contracts/learning-v2'
import { paragraphNode, validateTree } from '@threadpeak/contracts/learning-v2'
import { CommandError, type Resource } from './store.ts'
import { ToolError, settledParallel, type TaskContext } from './worker.ts'
import type { ProductTools } from './tools.ts'

export type PathState = {
  workflow?:typeof DIRECT_ROUTE_VERSION; research?:{firstSearch:{summary:string};catalogSearch:{summary:string};catalogCarriers:string[];materialQuestions?:R1Output['queries'];ready:boolean};
  searchScope?:SearchScope; goal:string; attachments:any[]; depth:'fast'|'deep'; status:'running'|'awaiting_answers'|'published';
  questionSets:(Omit<R3Output,'round'> & {round:number; selectedOptionIds:Record<string,string>; customAnswers?:Record<string,string>})[];
  conversation:any[]; exploration?:GoalExploration; route?:R4Output; document?:any; conceptIdByWireId?:Record<string,string>;
}
const activeSet=(path:PathState)=>path.questionSets.find(s=>s.status==='active')
export const allAnswered=(path:PathState)=>{const s=activeSet(path);return !!s&&s.questions.every(q=>!!s.selectedOptionIds[q.id]||!!s.customAnswers?.[q.id])}
const routeContinuation=(id:string)=>(body:PathState)=>body.workflow===DIRECT_ROUTE_VERSION&&body.status!=='published'&&allAnswered(body)&&body.research?.ready?{kind:'path.answer',key:`route-ready:${id}:${activeSet(body)!.round}`,input:{depth:body.depth}}:undefined
export function appendQuestionSet(path:PathState,set:Omit<R3Output,'round'> & {round:number}){
  // IDs are scoped to an immutable round, so identical model IDs cannot collide across rounds.
  const questions=set.questions.map((q,i)=>({...q,id:`r${set.round}-q${i+1}`,options:q.options.map((o,j)=>({...o,id:`r${set.round}-q${i+1}-o${j+1}`}))}))
  path.questionSets.push({...set,questions,selectedOptionIds:{},customAnswers:{}})
  path.conversation.push({messageId:`questions-${set.round}`,role:'system_event',kind:'question_set',content:{...set,questions}})
  path.status='awaiting_answers'
}
export function selectPathOption(resource:Resource, questionId:string,optionId:string){
  const path=resource.body as PathState,set=activeSet(path)
  if(resource.kind!=='path'||path.status!=='awaiting_answers'||!set)throw new CommandError('QUESTION_NOT_ACTIVE')
  const question=set.questions.find(q=>q.id===questionId)
  if(!question?.options.some(o=>o.id===optionId))throw new CommandError('OPTION_NOT_FOUND')
  if(set.customAnswers?.[questionId])throw new CommandError('ANSWER_ALREADY_SAVED')
  if(set.selectedOptionIds[questionId] && set.selectedOptionIds[questionId]!==optionId)throw new CommandError('ANSWER_ALREADY_SAVED')
  set.selectedOptionIds[questionId]=optionId
  if(!path.conversation.some(m=>m.messageId===`choice-${questionId}`))path.conversation.push({messageId:`choice-${questionId}`,role:'user',kind:'text',content:{questionId,optionId,label:question.options.find(o=>o.id===optionId)!.label}})
  return path
}
export function selectPathCustomAnswer(resource:Resource,questionId:string,customAnswer:string){
  const path=resource.body as PathState,set=activeSet(path)
  if(resource.kind!=='path'||path.status!=='awaiting_answers'||!set)throw new CommandError('QUESTION_NOT_ACTIVE')
  if(!set.questions.some(q=>q.id===questionId))throw new CommandError('QUESTION_NOT_FOUND')
  if(!customAnswer.trim()||customAnswer.length>4000)throw new CommandError('INVALID_ANSWER',400)
  if(set.selectedOptionIds[questionId]||set.customAnswers?.[questionId]&&set.customAnswers[questionId]!==customAnswer)throw new CommandError('ANSWER_ALREADY_SAVED')
  ;(set.customAnswers??={})[questionId]=customAnswer
  if(!path.conversation.some(m=>m.messageId===`choice-${questionId}`))path.conversation.push({messageId:`choice-${questionId}`,role:'user',kind:'text',content:{questionId,customAnswer}})
  return path
}
function uniqueEvidence(groups:SearchEvidence[][]):SearchEvidence[]{
  const byUrl=new Map<string,SearchEvidence>()
  for(const e of groups.flat()){const key=evidenceUrlKey(e.url),old=byUrl.get(key);if(!old||old.sourceKind==='web'&&e.sourceKind!=='web')byUrl.set(key,e)}
  return [...byUrl.values()]
}
function articleOf(e:SearchEvidence):Article{return {...e,id:e.evidenceId,title:e.title,summary:e.summary,author:e.sourceKind==='web'?(e.site??new URL(e.url).hostname):e.authorName??'作者信息未提供',authorId:e.sourceKind==='web'?null:e.authorId,authorUrl:e.sourceKind==='web'?null:e.authorUrl,likes:e.likes??null,url:e.url,topic:e.sourceKind==='web'?'全网资料':'知乎文章',sourceKind:e.sourceKind??'zhihu'}}
function selectedCards(state:LearningState,ids:string[]):GraphNode[]{
  const basisIds=ids.length?[...new Set(ids)]:state.articles.filter(a=>!a.retainedForHistory).map(a=>a.id)
  const cards=basisIds.map(id=>state.nodes.find(n=>n.id===id))
  if(cards.some(n=>!n)||!cards.length)throw new CommandError('MATERIAL_NOT_FOUND')
  return cards as GraphNode[]
}
export function replyInput(state:LearningState,question:string,ids:string[],conversationId:string){
  const conversation=state.conversations.find(c=>c.id===conversationId)
  if(!conversation)throw new CommandError('CONVERSATION_NOT_FOUND')
  const cards=selectedCards(state,ids)
  return {goalContext:state.goalContext,searchScope:state.searchScope??{kind:'zhihu'},concept:{id:state.conceptId,title:state.title,description:state.description,learningSummary:state.learningSummary},currentQuestion:question,
    conversation:conversation.messages.map(m=>({messageId:m.id,role:m.role,content:m.text??m.paragraphs?.map(p=>`${p.title}\n${p.text}`).join('\n\n')??''})),
    allowedCards:cards.map(c=>({id:c.id,title:c.title,content:c.text})),cards}
}
function buildParagraphs(ctx:TaskContext,cards:GraphNode[],raw:{basisId:string;title:string;text:string}[]):Paragraph[]{
  return raw.map((p,index)=>{const card=cards.find(c=>c.id===p.basisId)!;return {id:`answer-${ctx.job.id}-${index}`,title:p.title,text:p.text,parents:[card.id],basisId:card.id,sources:card.type==='article'?[card.id]:card.type==='custom'||card.type==='root'?[]:card.sources.slice(0,1),origin:'articles'}})
}
function answerContext(input: ReturnType<typeof replyInput>) {
  const { cards: _projectionCards, ...context } = input
  return context
}

export function createFlows(tools:ProductTools,api?:ZhihuDataClient,login?:ZhihuLogin){
  async function path(ctx:TaskContext,resource:Resource<PathState>){
    const state=structuredClone(resource.body),kind=ctx.job.kind,searchScope=state.searchScope??{kind:'zhihu'}
    const attachments=state.attachments.map(({sourceId,fileName,mimeType,content,contentBasis},i)=>({ref:`F${i+1}`,sourceId,fileName,mimeType,content,contentBasis}))
    const goalContext=pathGoalContext(state)
    if(kind==='path.start'){
      // Preparation inputs stay frozen even when answers arrive before a retry.
      const goalContext=pathGoalContext({goal:state.goal})
      await ctx.progress('正在理解学习目标')
      const r1=await tools.planStep<R1Output>(ctx,'R1',{goalContext,goal:state.goal,searchScope,attachments})
      await ctx.progress(searchScope.kind==='collections'?'正在读取所选收藏夹':'正在查找学习资料')
      const packed=packZhihuSearchQueries(r1.queries)
      const groups=searchScope.kind==='collections'
        ? [{queryId:'route-materials',query:state.goal,results:await ctx.step('R-materials',{sourceIds:state.attachments.map(a=>a.sourceId)},async()=>inheritedArticles(state.attachments).filter(a=>a.url).map(a=>({evidenceId:a.id,title:a.title,summary:a.summary,url:a.url!,authorId:a.authorId,authorName:a.author,sourceKind:'zhihu' as const})))}]
        : await settledParallel(packed.map(async(q,index)=>({queryId:`route-search-${index}`,query:q.query,questions:r1.queries.filter(question=>q.sourceIds.includes(question.id)),results:await tools.search(ctx,`R-S:${index}:goal-choices-v2`,q.query,searchScope)})))
      const firstSearch={summary:mergeSearchSummaries(groups)}
      const materialQuestions=searchScope.kind==='collections'?r1.queries:undefined
      const researchInput={goalContext,goal:state.goal,searchScope,attachments,firstSearch,...materialQuestions?{materialQuestions}:{}}
      await ctx.progress('正在提取待补查的书课名称')
      const {carriers}=await tools.catalogNames(ctx,researchInput)
      await ctx.progress('正在补查资料并准备问题',undefined,r=>({...r.body,workflow:DIRECT_ROUTE_VERSION,research:{catalogSearch:{summary:''},ready:false,...r.body.research,firstSearch,materialQuestions,catalogCarriers:carriers}}))
      await settledParallel([
        (async()=>{
          const catalogs=await tools.catalogSearches(ctx,carriers,searchScope)
          await ctx.progress('课程资料已准备好',undefined,r=>({...r.body,research:{...r.body.research,catalogSearch:{summary:mergeSearchSummaries(catalogs)},ready:true}}))
        })(),
        (async()=>{
          const questions=await tools.routeInterview(ctx,{...researchInput,catalogCarriers:carriers})
          await ctx.progress('问题已准备好，可以先回答',undefined,r=>{
            const current=r.body as PathState
            if(!current.questionSets.length)appendQuestionSet(current,questions)
            return current
          })
        })(),
      ])
      // Read answers under the resource lock. The last answer may race with preparation completion.
      await ctx.flush()
      await ctx.store.commit(ctx.job,r=>r.body,routeContinuation(resource.id))
      return
    }else if(kind==='path.clarify'){
      const active=activeSet(state)
      if(!active||state.status!=='awaiting_answers')throw new CommandError('QUESTION_NOT_ACTIVE')
      const answer=await tools.planStep<R3bOutput>(ctx,'R3b',{goalContext,goal:state.goal,searchScope,...(state.workflow===DIRECT_ROUTE_VERSION?{workflow:state.workflow,...state.research}:{exploration:explorationForPlanning(state.exploration)}),followUpMessage:ctx.job.input.question,activeRound:active.round,questionSets:state.questionSets,attachments},{activeRound:active.round})
      state.conversation.push({messageId:ctx.job.id,role:'assistant',kind:'text',content:answer.message})
      if(answer.kind==='replace_questions'){
        // The retired set is retained with all selections; it never disappears.
        ;(active as {status:string}).status='superseded'
        appendQuestionSet(state,answer)
      }
    }else if(kind==='path.chat'){
      const text=await tools.chat(ctx,{goalContext,currentMessage:ctx.job.input.question,searchScope,conversation:state.conversation,attachments})
      state.conversation.push({messageId:ctx.job.id,role:'assistant',kind:'text',content:text})
    }else if(kind==='path.answer'&&allAnswered(state)){
      await ctx.progress('正在生成学习路线')
      const questionSets=state.questionSets.map(set=>({...set,selectedOptions:set.questions.flatMap(q=>q.options.filter(o=>o.id===set.selectedOptionIds[q.id]).map(o=>({questionId:q.id,optionId:o.id,label:o.label,routeEffect:o.routeEffect}))),selectedOptionIds:Object.values(set.selectedOptionIds)}))
      if(state.workflow===DIRECT_ROUTE_VERSION&&!state.research?.ready)throw new ToolError('PREPARATION_INCOMPLETE',false)
      state.route=await tools.routePlan(ctx,{goalContext,goal:state.goal,searchScope,...(state.workflow===DIRECT_ROUTE_VERSION?{workflow:state.workflow,firstSearch:state.research!.firstSearch,catalogSearch:state.research!.catalogSearch,...state.research!.materialQuestions?{materialQuestions:state.research!.materialQuestions}:{}}:{exploration:explorationForPlanning(state.exploration)}),questionSets,newerRoundPreferred:true,attachments},resource.id,state.attachments.map(a=>a.sourceId))
      const projected=projectRouteToDocument(state.route)
      if(!projected.ok)throw new ToolError('ROUTE_NOT_SETTLED',false)
      state.document=projected.value.document;state.conceptIdByWireId=projected.value.conceptIdByWireId;state.status='published'
      state.conversation.push({messageId:ctx.job.id,role:'system_event',kind:'route_published',content:{routeId:state.route.routeId,title:state.route.title}})
    }
    if(kind==='path.answer'&&!allAnswered(state)){await ctx.flush();await ctx.store.commit(ctx.job,r=>r.body,routeContinuation(resource.id));return}
    await ctx.flush();await ctx.store.commit(ctx.job,r=>({...state,...(r.body.progress!==undefined?{progress:r.body.progress}:{})}))
  }
  async function settleLearning(ctx:TaskContext,paragraphs:Paragraph[],first=false,network:SearchEvidence[]=[],normalizedQuestion=''){
    await ctx.flush()
    await ctx.activity('answer:save','edit','编辑知识脉络','running',`创建 ${paragraphs.length} 张卡片`)
    await ctx.store.commit(ctx.job,async(resource,tx)=>{
      const state=resource.body as LearningState
      for(const p of paragraphs)if(!state.nodes.some(n=>n.id===p.parents[0]))throw new CommandError('MATERIAL_REMOVED')
      const conversation=state.conversations.find(c=>c.id===ctx.job.input.conversationId)
      if(!conversation)throw new CommandError('CONVERSATION_NOT_FOUND')
      const existing=new Set(state.nodes.map(n=>n.id))
      state.nodes.push(...paragraphs.filter(p=>!existing.has(p.id)).map(paragraphNode));validateTree(state.nodes)
      conversation.messages.push({id:ctx.job.id,role:'assistant',paragraphs,activities:(ctx.job.activities??[]).map(a=>a.status==='running'?{...a,status:'done' as const,finishedAt:Date.now()}:a),...(paragraphs.some(p=>p.author)?{kind:'author' as const}:{})})
      if(first){state.initialized=true;state.initialAnswer=paragraphs;state.initialMarkdown=paragraphsMarkdown(paragraphs,state.articles);state.phase='ready'}
      if(network.length)await tx.query(`INSERT INTO tp_author_network(owner_id,author_id,evidence_id,weight,body)
        SELECT $1,e->>'authorId',e->>'evidenceId','high',jsonb_build_object('evidence',e,'question',$3::text,'routeId',$4::text,'conceptId',$5::text,'conceptTitle',$6::text)
        FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`,[ctx.job.owner_id,JSON.stringify(network),normalizedQuestion,state.routeId,state.conceptId,state.title])
      if(!first&&ctx.job.kind==='learning.reply')await recordAuthorUse(tx,ctx.job.owner_id,resource.id,ctx.job.id,state,ctx.job.input.selected??[],paragraphs)
      return state
    })
  }
  async function learning(ctx:TaskContext,resource:Resource<LearningState>){
    let state=structuredClone(resource.body)
    if(ctx.job.kind==='learning.enter'||ctx.job.kind==='learning.materials'){
      if(state.materialSelection?.version!==CONCEPT_MATERIAL_VERSION){
        const candidates=await conceptMaterialCandidates(ctx.store,ctx.job.owner_id,state)
        if(candidates.length){
          await ctx.progress('正在筛选与这个概念相关的收藏文章')
          const selection=await tools.learning(ctx,'L-source-select',{goalContext:state.goalContext,concept:{id:state.conceptId,title:state.title,description:state.description,learningSummary:state.learningSummary},searchQueries:[],candidates:candidates.map(a=>({...a,evidenceId:a.id,authorName:a.author})),source:'route_imports'},v=>{
            if(new Set(v.evidenceIds).size!==v.evidenceIds.length||v.evidenceIds.some((id:string)=>!candidates.some(a=>a.id===id)))throw new Error('只能选择本次收藏资料的真实 ID')
          },'L-source-select:concept-materials-v1')
          await ctx.progress('概念相关资料已就绪',undefined,r=>applyConceptMaterials(r.body,candidates,selection.evidenceIds))
          state=(await ctx.store.resource<LearningState>(ctx.job.owner_id,resource.id)).body
        }
      }
      if(ctx.job.kind==='learning.materials'){await ctx.flush();await ctx.store.commit(ctx.job,r=>r.body);return}
      if(state.initialized){await ctx.store.commit(ctx.job,r=>r.body);return}
      const searchScope=state.searchScope??{kind:'zhihu'}
      await ctx.progress(searchScope.kind==='collections'?'正在阅读本路线资料':'正在寻找概念相关内容')
      const plan=searchScope.kind==='collections'?{queries:[]}:await tools.learning(ctx,'L-search-plan',{goalContext:state.goalContext,searchScope,concept:{id:state.conceptId,title:state.title,description:state.description,learningSummary:state.learningSummary},materials:state.articles.filter(a=>a.materialId).map(a=>({id:a.id,title:a.title,content:a.summary}))})
      const groups=await searchInPairs(plan.queries,(q,i)=>tools.search(ctx,`L-search:${i}`,q,searchScope))
      const evidence=uniqueEvidence(groups)
      const selection=evidence.length?await tools.learning(ctx,'L-source-select',{goalContext:state.goalContext,concept:{id:state.conceptId,title:state.title,description:state.description,learningSummary:state.learningSummary},searchQueries:plan.queries,candidates:evidence},v=>{
        if(new Set(v.evidenceIds).size!==v.evidenceIds.length||v.evidenceIds.some((id:string)=>!evidence.some(e=>e.evidenceId===id)))throw new Error('只能选择本次真实证据 ID，不能重复')
      }):{evidenceIds:[]}
      const articles=[...state.articles.filter(a=>a.materialId&&!a.retainedForHistory),...selection.evidenceIds.map(id=>articleOf(evidence.find(e=>e.evidenceId===id)!))]
      if(!articles.length){await ctx.store.commit(ctx.job,r=>({...r.body,phase:'empty'}));return}
      await ctx.progress('正在组织连贯讲解',undefined,r=>{
        const s=r.body as LearningState;s.articles=articles
        if(!s.nodes.length)s.nodes=[{id:'root',type:'root',title:s.title,text:'',sources:articles.map(a=>a.id),parents:[]},...articles.map(a=>({id:a.id,type:'article' as const,title:a.title,text:a.summary,sources:[a.id],parents:['root']}))]
        for(const a of articles)if(!s.nodes.some(n=>n.id===a.id))s.nodes.push({id:a.id,type:'article',title:a.title,text:a.summary,sources:[a.id],parents:['root']})
        s.nodes.find(n=>n.type==='root')!.sources=articles.map(a=>a.id)
        s.phase='organizing';return s
      })
      state=(await ctx.store.resource<LearningState>(ctx.job.owner_id,resource.id)).body
      const input=replyInput(state,state.title,[],ctx.job.input.conversationId)
      const output=await tools.answerCards(ctx,{...answerContext(input),mode:'first_learning'})
      await settleLearning(ctx,buildParagraphs(ctx,input.cards,output.paragraphs),true)
      return
    }
    if(ctx.job.kind==='learning.import'){
      const evidence=ctx.job.input.evidence as SearchEvidence
      const exists=state.articles.some(a=>a.id===evidence.evidenceId)
      await ctx.progress('核对这篇材料与当前概念的关系')
      const selection=exists?{evidenceIds:[evidence.evidenceId]}:await tools.learning(ctx,'L-source-select',{goalContext:state.goalContext,concept:{id:state.conceptId,title:state.title,description:state.description,learningSummary:state.learningSummary},candidates:[evidence]},v=>{if(v.evidenceIds.length>1||v.evidenceIds.some((id:string)=>id!==evidence.evidenceId))throw new Error('只能选择当前证据')},'L-source-select:import')
      await ctx.flush();await ctx.store.commit(ctx.job,r=>{
        const s=r.body as LearningState,status=s.articles.some(a=>a.id===evidence.evidenceId)?'already-present':selection.evidenceIds.length?'added':'unrelated'
        if(status==='added'){const a=articleOf(evidence);s.articles.push(a);s.nodes.push({id:a.id,type:'article',title:a.title,text:a.summary,sources:[a.id],parents:['root']});const root=s.nodes.find(n=>n.type==='root')!;root.sources.push(a.id);validateTree(s.nodes)}
        s.importResult={jobId:ctx.job.id,status,title:evidence.title};return s
      });return
    }
    const input=ctx.job.input.context as ReturnType<typeof replyInput>
    if(ctx.job.kind==='learning.reply'){
      await ctx.progress('正在阅读所选材料')
      const output=await tools.answerCards(ctx,answerContext(input))
      await settleLearning(ctx,buildParagraphs(ctx,input.cards,output.paragraphs));return
    }
    if(ctx.job.kind==='learning.author'){
      if(input.cards.length!==1)throw new CommandError('ONE_AUTHOR_HOST_REQUIRED')
      const host=input.cards[0]!,excluded=ctx.job.input.excludedAuthorIds as string[]
      const network=await ctx.step('A0:network-v1',{owner:ctx.job.owner_id},()=>readAuthorNetwork(ctx.store.db,ctx.job.owner_id))
      const sourceContext=ctx.job.input.hostSource
      const authorContext={goalContext:input.goalContext,concept:input.concept,host:input.allowedCards[0],question:input.currentQuestion,conversation:input.conversation,sourceContext}
      await ctx.progress('正在换几种问法寻找博主')
      const plan=await tools.learning(ctx,'A-card-plan',authorContext)
      const queries=plan.queries
      const excludedUrls=new Set((ctx.job.input.excludedSourceUrls??[]).map(evidenceUrlKey))
      const evidence=uniqueEvidence(await searchInPairs(queries,(q,i)=>tools.search(ctx,`A-search:${i}`,q))).map(e=>knownSourceIdentity(e,network)).filter(e=>e.sourceKind!=='web'&&e.authorId&&e.authorName&&safeZhihuUrl(e.url)&&!excluded.includes(e.authorId)&&!excludedUrls.has(evidenceUrlKey(e.url)))
      await ctx.progress('正在阅读相关博主的解读')
      const catalog=authorCardCandidates(evidence)
      const selection=evidence.length?await tools.learning(ctx,'A-card-select',{...authorContext,searchQueries:queries,candidates:catalog.candidates,excludedAuthorIds:excluded},v=>{
        catalog.resolve(v.selections)
      },'A-card-select:refs-v2'):{normalizedQuestion:input.currentQuestion,selections:[]}
      const selected=catalog.resolve(selection.selections)
      if(!selected.length){
        await ctx.flush();await ctx.store.commit(ctx.job,r=>{
          const s=r.body as LearningState,conversation=s.conversations.find(c=>c.id===ctx.job.input.conversationId)
          if(!conversation)throw new CommandError('CONVERSATION_NOT_FOUND')
          conversation.messages.push({id:ctx.job.id,role:'assistant',text:'本次搜索没有返回可核实的新博主资料，暂时无法生成博主卡。可以补充具体例子或问题中的条件后再找。'})
          return s
        });return
      }
      const paragraphs:Paragraph[]=selected.map((e,i)=>({id:`author-${ctx.job.id}-${i}`,title:e.title,text:e.summary,parents:[host.id],basisId:host.id,sources:[],origin:'author',author:{...searchMetadataOf(e),matchReason:selection.selections[i]!.reason,coverageLimit:selection.selections[i]!.limitation,id:e.authorId!,name:e.authorName!,avatar:e.avatar,badge:e.badge,expertise:'公开文章观点',evidenceId:e.evidenceId,url:e.url,authorUrl:e.authorUrl}}))
      await settleLearning(ctx,paragraphs,false,selected,selection.normalizedQuestion)
    }
  }
  return async(ctx:TaskContext)=>{
    if(ctx.job.kind==='source.present'){await presentSource(ctx,tools);return}
    if(ctx.job.kind==='material.pdf'){if(!api)throw new ToolError('PDF_NOT_CONFIGURED',false);await preparePdf(ctx,tools,api);return}
    if(ctx.job.kind==='material.zhihu'){if(!api||!login)throw new ToolError('ZHIHU_NOT_CONFIGURED',false);await importZhihuMaterial(ctx,api,login);return}
    const resource=await ctx.store.resource(ctx.job.owner_id,ctx.job.resource_id)
    if(ctx.job.kind.startsWith('path.'))return path(ctx,resource)
    if(ctx.job.kind.startsWith('learning.'))return learning(ctx,resource)
    if(ctx.job.kind==='authors.search')return searchAuthors(ctx,tools)
    if(ctx.job.kind==='chat.reply'){
      const text=await tools.chat(ctx,{conversation:resource.body.messages.map((m:any)=>({messageId:m.id,role:m.role,content:m.text})),currentMessage:ctx.job.input.question,attachments:resource.body.attachments??[]})
      await ctx.flush();await ctx.store.commit(ctx.job,r=>({...r.body,messages:[...r.body.messages,{id:ctx.job.id,role:'assistant',text}]}));return
    }
    throw new ToolError('UNKNOWN_TASK',false)
  }
}
