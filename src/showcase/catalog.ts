import {showcaseRoutes,showcaseRoute,SHOWCASE_VERSION} from './content.ts'
import sourceData from './sources.json' with {type:'json'}
import {ArticleSchema,LearningSchema,validateTree,type Article,type LearningState,type Paragraph,type GraphNode} from '@threadpeak/contracts/learning-v2'
import type {RouteBlueprint,FirstLesson} from '../workspace/types.ts'

export const showcaseSources:Record<string,Article[]>=Object.fromEntries(Object.entries(sourceData).map(([id,items])=>[id,items.map(a=>ArticleSchema.parse(a))]))
export const showcaseBlueprints:RouteBlueprint[]=showcaseRoutes.map(route=>({
  id:route.id,owner:'example',title:route.title,summary:route.summary,outcome:route.outcome,
  duration:'按成果检验，不设统一学时',tags:['编选示例',`${route.concepts.length} 个必要概念`],icon:route.icon,
  documentId:`threadpeak-showcase-${route.id}-${SHOWCASE_VERSION}`,description:route.why,
  goalTitle:'完成这件事',goalSummary:route.outcome,startSummary:`示例起点：${route.startingPoint}`,
  stages:route.stages.map(s=>s.map(c=>c.id)),
  carriers:route.stages.flat().map(stage=>({id:stage.id,title:stage.title,summary:stage.summary,concepts:stage.conceptIds.map(id=>{
    const c=route.concepts.find(c=>c.id===id)!
    return [c.id,c.title,`${c.purpose}\n\n学到这里：${c.depth}\n\n完成检验：${c.check}`] as const
  })})),
}))

export function showcaseLesson(routeId:string,conceptId:string):FirstLesson|undefined {
  const c=showcaseRoute(routeId)?.concepts.find(c=>c.id===conceptId)
  return c?{heading:c.purpose,paragraphs:c.sections.map(p=>p.text),placeholder:c.question}:undefined
}
export function showcaseSourceCount(routeId:string){
  const route=showcaseRoute(routeId)
  return new Set(route?.concepts.flatMap(c=>(showcaseSources[c.id]??[]).map(s=>s.id))).size+(routeId==='attention-paper'?1:0)
}
const paper:Article={id:'showcase-attention-paper-section-3-2',title:'Attention Is All You Need · §3.2',summary:String.raw`本例指定阅读论文 §3.2.1 的缩放点积注意力，以及 §3.2.2 的多头注意力。以下为编选阅读锚点，不是用户上传文件或论文全文。

$$\mathrm{Attention}(Q,K,V)=\mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$$

沿“查询与键的匹配 → 缩放 → 行内归一化 → 汇总值”阅读式 (1)，再检查多头的投影、拼接与输出投影。`,author:'Vaswani 等',authorId:null,likes:null,topic:'论文阅读锚点',sourceKind:'web',site:'arXiv',url:'https://arxiv.org/html/1706.03762v7#S3.SS2'}

/** The demo stays local and explicitly curated; article identities come only from search evidence. */
export function showcaseLearning(routeId:string,conceptId:string):LearningState|undefined {
  const route=showcaseRoute(routeId),concept=route?.concepts.find(c=>c.id===conceptId)
  if(!route||!concept)return undefined
  const selected=showcaseSources[conceptId]
  if(!selected?.length)throw new Error('SHOWCASE_SOURCE_MISSING')
  const readingArticles=routeId==='numpy-collection'
    ?route.concepts.flatMap(c=>showcaseSources[c.id]??[])
    :[...selected,...(routeId==='attention-paper'?[paper]:[])]
  const articles=readingArticles.map(article=>{
    if(!article.curation)return article
    const owner=route.concepts.find(c=>showcaseSources[c.id]?.some(a=>a.id===article.id))!
    return {...article,curation:{...article.curation,readingGuide:`${article.curation.why}\n\n阅读提醒：${article.curation.caveat}\n\n${owner.sections.map(s=>`## ${s.title}\n\n${s.text}`).join('\n\n')}`}}
  })
  const anchors = routeId==='attention-paper'
    ?[{sourceId:paper.id,quote:conceptId==='attention-heads'?'多头注意力':'缩放点积注意力',role:conceptId==='attention-shapes'?'prerequisite' as const:'direct' as const,connection:concept.purpose,evidenceKind:'material' as const}]
    :routeId==='numpy-collection'?[{sourceId:selected[0]!.id,quote:selected[0]!.summary.slice(0,80),role:'direct' as const,connection:concept.purpose,evidenceKind:'material' as const}]:[]
  const sourceId=selected[0]!.id,conversationId=`showcase:${conceptId}:conversation`
  const basisSource=routeId==='attention-paper'?paper.id:sourceId
  const sourceRefs=routeId==='attention-paper'?[paper.id,sourceId]:[sourceId]
  const initial:Paragraph[]=concept.sections.map((part,i)=>{
    const parent=i===1?`showcase:${conceptId}:explain:0`:i===0?basisSource:sourceId
    return {id:`showcase:${conceptId}:explain:${i}`,title:part.title,text:part.text,sources:sourceRefs,parents:[parent],basisId:parent,origin:'articles'}
  })
  const parent=initial[1]!.id
  const followup:Paragraph={id:`showcase:${conceptId}:followup`,title:concept.question,text:concept.answer,sources:sourceRefs,parents:[parent],basisId:parent,origin:'articles'}
  const check:Paragraph={id:`showcase:${conceptId}:check`,title:'回到目标，检验这一步',text:`${concept.check}\n\n这一步服务的成果：${route.outcome}`,sources:sourceRefs,parents:[followup.id],basisId:followup.id,origin:'articles'}
  const root:GraphNode={id:'root',type:'root',title:concept.title,text:`我的目标：${route.outcome}\n\n已有基础：${route.startingPoint}\n\n${concept.purpose}\n\n学到这里：${concept.depth}`,parents:[],sources:[]}
  const nodes:GraphNode[]=[root,...articles.map(a=>({id:a.id,type:'article' as const,title:a.title,text:a.summary,parents:['root'],sources:[a.id]})),...[...initial,followup,check].map(p=>({...p,type:'answer' as const}))]
  validateTree(nodes)
  return LearningSchema.parse({version:2,routeId,conceptId,title:concept.title,description:concept.purpose,hasDispute:false,
    goalContext:{rawGoal:route.prompt,userStatements:[{id:`showcase:${routeId}:interview`,question:route.interview.question,text:route.interview.answer}],
      interpretation:{outcome:route.outcome,motivation:'',successCriteria:[route.outcome],startingPoint:route.startingPoint,constraints:[],nonGoals:[route.omitted],assumptions:[],openQuestions:routeId==='numpy-collection'?['这份公开示例选集未覆盖 CSV 导入；真实文件任务需要另补。']:[]},
      conceptAlignment:{purpose:concept.purpose,depth:concept.depth,successCheck:concept.check,materialAnchors:anchors}},
    articles,nodes,initialized:true,phase:'ready',active:conversationId,initialAnswer:initial,
    conversations:[{id:conversationId,title:`${concept.title} · 阅读与追问示例`,date:'编选示例',messages:[
      {id:`${conceptId}:question`,role:'user',text:`我的目标是：${route.outcome}\n现在想弄懂：${concept.title}。`},
      {id:`${conceptId}:first`,role:'assistant',paragraphs:initial},
      {id:`${conceptId}:followup-question`,role:'user',text:concept.question,selected:[parent]},
      {id:`${conceptId}:followup-answer`,role:'assistant',paragraphs:[followup,check]},
    ]}],
  })
}
