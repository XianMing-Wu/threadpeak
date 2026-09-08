import { pathGoalContext } from './learning-goal.ts'
import type { GoalExploration } from '../path-generation/goal-exploration.ts'
import type {SearchScope} from '@threadpeak/contracts/search-scope'
import {presentSource} from './source-presentation.ts'
import { inheritedArticles } from './materials.ts'
import { preparePdf } from './materials.ts'
import { importZhihuMaterial } from './materials-http.ts'
import type { ZhihuDataClient } from './zhihu-data.ts'
import type { ZhihuLogin } from './zhihu-oauth.ts'
import { searchAuthors } from './authors-search.ts'
import { recordAuthorUse } from './authors-network.ts'
import { randomUUID } from 'node:crypto'
import type { R1Output, R2Output, R3Output, R3bOutput, R4Output } from '../agent-runtime/schemas.ts'
import type { SearchEvidence } from '../agent-runtime/types.ts'
import { packZhihuSearchQueries } from '../agent-runtime/pack-search.ts'
import { projectRouteToDocument } from '../path-generation/project-document.ts'
import type { LearningState, GraphNode, Paragraph, Article } from '@threadpeak/contracts/learning-v2'
import { paragraphNode, validateTree } from '@threadpeak/contracts/learning-v2'
import { CommandError, type Resource } from './store.ts'
import { ToolError, settledParallel, type TaskContext } from './worker.ts'
import type { ProductTools } from './tools.ts'

export type PathState = {
  searchScope?:SearchScope; goal:string; attachments:any[]; depth:'fast'|'deep'; status:'running'|'awaiting_answers'|'published';
  questionSets:(Omit<R3Output,'round'> & {round:number; selectedOptionIds:Record<string,string>; customAnswers?:Record<string,string>})[];
  conversation:any[]; exploration?:GoalExploration; route?:R4Output; document?:any; conceptIdByWireId?:Record<string,string>;
}
const activeSet=(path:PathState)=>path.questionSets.find(s=>s.status==='active')
const allAnswered=(path:PathState)=>{const s=activeSet(path);return !!s&&s.questions.every(q=>!!s.selectedOptionIds[q.id]||!!s.customAnswers?.[q.id])}
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
  for(const e of groups.flat()){const u=new URL(e.url);u.search='';u.hash='';const old=byUrl.get(u.href);if(!old||old.sourceKind==='web'&&e.sourceKind!=='web')byUrl.set(u.href,e)}
  return [...byUrl.values()]
}
function articleOf(e:SearchEvidence):Article{return {...e,id:e.evidenceId,title:e.title,summary:e.summary,author:e.sourceKind==='web'?(e.site??new URL(e.url).hostname):e.authorName??'作者信息未提供',authorId:e.sourceKind==='web'?null:e.authorId,authorUrl:e.sourceKind==='web'?null:e.authorUrl,likes:e.likes??null,url:e.url,topic:e.sourceKind==='web'?'全网资料':'知乎文章',sourceKind:e.sourceKind??'zhihu'}}
function selectedCards(state:LearningState,ids:string[]):GraphNode[]{
  const basisIds=ids.length?[...new Set(ids)]:state.articles.map(a=>a.id)
  const cards=basisIds.map(id=>state.nodes.find(n=>n.id===id))
  if(cards.some(n=>!n)||!cards.length)throw new CommandError('MATERIAL_NOT_FOUND')
  return cards as GraphNode[]
}
export function replyInput(state:LearningState,question:string,ids:string[],conversationId:string){
  const conversation=state.conversations.find(c=>c.id===conversationId)
  if(!conversation)throw new CommandError('CONVERSATION_NOT_FOUND')
  const cards=selectedCards(state,ids)
  return {goalContext:state.goalContext,searchScope:state.searchScope??{kind:'zhihu'},concept:{id:state.conceptId,title:state.title,description:state.description},currentQuestion:question,
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
      await ctx.progress('正在理解学习目标')
      const r1=await tools.legacy<R1Output>(ctx,'R1',{goalContext,goal:state.goal,searchScope,attachments})
      await ctx.progress(searchScope.kind==='collections'?'正在读取所选收藏夹':'正在查找学习资料')
      const packed=packZhihuSearchQueries(r1.queries)
      const groups=searchScope.kind==='collections'
        ? [{queryId:'route-materials',query:state.goal,results:await ctx.step('R-materials',{sourceIds:state.attachments.map(a=>a.sourceId)},async()=>inheritedArticles(state.attachments).filter(a=>a.url).map(a=>({evidenceId:a.id,title:a.title,summary:a.summary,url:a.url!,authorId:a.authorId,authorName:a.author,sourceKind:'zhihu' as const})))}]
        : await settledParallel(packed.map(async(q,index)=>({queryId:`route-search-${index}`,query:q.query,results:await tools.search(ctx,`R-S:${index}`,q.query,searchScope)})))
      await ctx.progress('正在整理适合你的方向')
      state.exploration=await tools.legacy<GoalExploration>(ctx,'R2',{goalContext,goal:state.goal,searchScope,searchGroups:groups,attachments})
      await ctx.progress('正在准备几个简单问题')
      const r3=await tools.legacy<R3Output>(ctx,'R3',{goalContext,goal:state.goal,searchScope,exploration:state.exploration,attachments})
      appendQuestionSet(state,r3)
    }else if(kind==='path.clarify'){
      const active=activeSet(state)
      if(!active||state.status!=='awaiting_answers')throw new CommandError('QUESTION_NOT_ACTIVE')
      const answer=await tools.legacy<R3bOutput>(ctx,'R3b',{goalContext,goal:state.goal,searchScope,exploration:state.exploration,followUpMessage:ctx.job.input.question,activeRound:active.round,questionSets:state.questionSets,attachments},{activeRound:active.round})
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
      state.route=await tools.routePlan(ctx,{goalContext,goal:state.goal,searchScope,exploration:state.exploration,questionSets,newerRoundPreferred:true,attachments},resource.id,state.attachments.map(a=>a.sourceId))
      const projected=projectRouteToDocument(state.route)
      if(!projected.ok)throw new ToolError('ROUTE_NOT_SETTLED',false)
      state.document=projected.value.document;state.conceptIdByWireId=projected.value.conceptIdByWireId;state.status='published'
      state.conversation.push({messageId:ctx.job.id,role:'system_event',kind:'route_published',content:{routeId:state.route.routeId,title:state.route.title}})
    }
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
      if(first){state.initialized=true;state.initialAnswer=paragraphs;state.phase='ready'}
      if(network.length)await tx.query(`INSERT INTO tp_author_network(owner_id,author_id,evidence_id,weight,body)
        SELECT $1,e->>'authorId',e->>'evidenceId','high',jsonb_build_object('evidence',e,'question',$3::text,'routeId',$4::text,'conceptId',$5::text,'conceptTitle',$6::text)
        FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`,[ctx.job.owner_id,JSON.stringify(network),normalizedQuestion,state.routeId,state.conceptId,state.title])
      if(!first&&ctx.job.kind==='learning.reply')await recordAuthorUse(tx,ctx.job.owner_id,resource.id,ctx.job.id,state,ctx.job.input.selected??[],paragraphs)
      return state
    })
  }
  async function learning(ctx:TaskContext,resource:Resource<LearningState>){
    let state=structuredClone(resource.body)
    if(ctx.job.kind==='learning.enter'){
      if(state.initialized){await ctx.store.commit(ctx.job,r=>r.body);return}
      const searchScope=state.searchScope??{kind:'zhihu'}
      await ctx.progress(searchScope.kind==='collections'?'正在阅读本路线资料':'正在寻找概念相关内容')
      const plan=searchScope.kind==='collections'?{queries:[]}:await tools.learning(ctx,'L-search-plan',{goalContext:state.goalContext,searchScope,concept:{id:state.conceptId,title:state.title,description:state.description},materials:state.articles.filter(a=>a.materialId).map(a=>({id:a.id,title:a.title,content:a.summary}))},v=>{if(new Set(v.queries).size!==3)throw new Error('三个问法必须不同')})
      const groups=await settledParallel(plan.queries.map((q,i)=>tools.search(ctx,`L-search:${i}`,q,searchScope)))
      const evidence=uniqueEvidence(groups)
      const selection=evidence.length?await tools.learning(ctx,'L-source-select',{goalContext:state.goalContext,concept:{id:state.conceptId,title:state.title,description:state.description},candidates:evidence},v=>{
        if(new Set(v.evidenceIds).size!==v.evidenceIds.length||v.evidenceIds.some((id:string)=>!evidence.some(e=>e.evidenceId===id)))throw new Error('只能选择本次真实证据 ID，不能重复')
      }):{evidenceIds:[]}
      const articles=[...state.articles.filter(a=>a.materialId),...selection.evidenceIds.map(id=>articleOf(evidence.find(e=>e.evidenceId===id)!))]
      if(!articles.length){await ctx.store.commit(ctx.job,r=>({...r.body,phase:'empty'}));return}
      await ctx.progress('从不同角度理解概念',undefined,r=>{
        const s=r.body as LearningState;s.articles=articles
        if(!s.nodes.length)s.nodes=[{id:'root',type:'root',title:s.title,text:'',sources:articles.map(a=>a.id),parents:[]},...articles.map(a=>({id:a.id,type:'article' as const,title:a.title,text:a.summary,sources:[a.id],parents:['root']}))]
        for(const a of articles)if(!s.nodes.some(n=>n.id===a.id))s.nodes.push({id:a.id,type:'article',title:a.title,text:a.summary,sources:[a.id],parents:['root']})
        s.nodes.find(n=>n.type==='root')!.sources=articles.map(a=>a.id)
        s.phase='direct';return s
      })
      state=(await ctx.store.resource<LearningState>(ctx.job.owner_id,resource.id)).body
      const angles=['concrete_explanation','dispute','pitfalls'] as const
      // All three routes run; a separate provider concurrency limiter can queue them.
      const directAnswers=await settledParallel(angles.map(async angle=>({angle,content:await tools.direct(ctx,`L-direct:${angle}`,'L0a',{goalContext:state.goalContext,concept:{conceptId:state.conceptId,title:state.title,hasDispute:state.hasDispute,detailedDescription:state.description},angle,searchScope,materials:state.articles.filter(a=>a.materialId).map(a=>({id:a.id,title:a.title,content:a.summary}))},angle,searchScope.kind==='collections')})))
      await ctx.progress('正在整理第一段讲解',undefined,r=>({...r.body,phase:'organizing'}))
      const input=replyInput(state,state.title,[],ctx.job.input.conversationId)
      const output=await tools.answerCards(ctx,{...answerContext(input),directAnswers})
      await settleLearning(ctx,buildParagraphs(ctx,input.cards,output.paragraphs),true)
      return
    }
    if(ctx.job.kind==='learning.import'){
      const evidence=ctx.job.input.evidence as SearchEvidence
      const exists=state.articles.some(a=>a.id===evidence.evidenceId)
      await ctx.progress('核对这篇材料与当前概念的关系')
      const selection=exists?{evidenceIds:[evidence.evidenceId]}:await tools.learning(ctx,'L-source-select',{goalContext:state.goalContext,concept:{id:state.conceptId,title:state.title,description:state.description},candidates:[evidence]},v=>{if(v.evidenceIds.length>1||v.evidenceIds.some((id:string)=>id!==evidence.evidenceId))throw new Error('只能选择当前证据')},'L-source-select:import')
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
      await ctx.progress('正在换几种问法寻找博主')
      const plan=await tools.learning(ctx,'A-card-plan',{goalContext:input.goalContext,concept:input.concept,host:input.allowedCards[0],question:input.currentQuestion})
      const queries=plan.queries.length===3?[plan.queries[0]!,`${plan.queries[1]} ${plan.queries[2]}`]:plan.queries
      const evidence=uniqueEvidence(await settledParallel(queries.map((q,i)=>tools.search(ctx,`A-search:${i}`,q)))).filter(e=>e.authorId&&e.authorName&&!excluded.includes(e.authorId)&&!(ctx.job.input.excludedAuthorNames??[]).includes(e.authorName))
      await ctx.progress('正在阅读相关博主的解读')
      const selection=evidence.length?await tools.learning(ctx,'A-card-select',{goalContext:input.goalContext,concept:input.concept,question:input.currentQuestion,host:input.allowedCards[0],candidates:evidence,excludedAuthorIds:excluded},v=>{
        const ids=v.selections.map((s:any)=>evidence.find(e=>e.evidenceId===s.evidenceId)?.authorId)
        const names=v.selections.map((s:any)=>evidence.find(e=>e.evidenceId===s.evidenceId)?.authorName)
        if(ids.some((id:any)=>!id)||new Set(ids).size!==ids.length||new Set(names).size!==names.length)throw new Error('每项必须选择本次真实证据，作者不能重复')
      }):{normalizedQuestion:input.currentQuestion,selections:[]}
      const selected=selection.selections.map(s=>evidence.find(e=>e.evidenceId===s.evidenceId)!)
      if(!selected.length){
        const text=await tools.direct(ctx,'A3','A3',{goalContext:input.goalContext,concept:input.concept,question:input.currentQuestion,selection:host.text,selectionSummary:null})
        await settleLearning(ctx,[{id:`direct-${ctx.job.id}`,title:'刘看山来解释',text,sources:[],parents:[host.id],basisId:host.id,origin:'direct'}]);return
      }
      const paragraphs:Paragraph[]=selected.map((e,i)=>({id:`author-${ctx.job.id}-${i}`,title:e.title,text:e.summary,parents:[host.id],basisId:host.id,sources:[],origin:'author',author:{id:e.authorId!,name:e.authorName!,avatar:e.avatar,badge:e.badge,expertise:'公开文章观点',evidenceId:e.evidenceId,url:e.url,authorUrl:e.authorUrl}}))
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
