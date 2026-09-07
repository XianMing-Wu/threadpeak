import {z} from 'zod'
import {createHash} from 'node:crypto'
import {R4OutputSchema,type R4Output} from '../agent-runtime/schemas.ts'

const label=z.string().trim().min(1).max(160)
const concept=z.object({title:label,description:z.string().trim().min(1).max(6000),hasDispute:z.boolean(),attachmentRefs:z.array(z.string().regex(/^F[1-9]\d*$/)).max(8).default([])}).strict()
const carrier=z.object({title:label,description:z.string().trim().min(1).max(500),concepts:z.array(concept).min(1).max(12)}).strict()
/** Outer array means sequence; members of one inner array mean parallel learning. */
export const StagedPlanSchema=z.object({title:label,stages:z.array(z.array(carrier).min(1).max(4)).min(1).max(16)}).strict().superRefine((plan,ctx)=>{
  const carriers=plan.stages.flat()
  if(carriers.length>24||carriers.reduce((n,c)=>n+c.concepts.length,0)>64)ctx.addIssue({code:'custom',message:'路线最多 24 个载体、64 个概念，请合并重复内容并保留目标。'})
})
export type StagedPlan=z.infer<typeof StagedPlanSchema>
export const STAGED_PLAN_PROMPT='你负责根据学习目标、探索结果和用户选择安排学习路线。只决定内容和阶段，不生成 ID、边、起点终点或图结构。stages 外层从前到后学习；同一内层数组中的载体并列同时学。例如 [[A],[B,C],[D]] 表示 A 后并列学 B、C，然后 D；[[A,B],[C,D]] 表示两组依次推进。每个载体写 title、description 和概念列表 concepts；概念按推荐顺序排列，每个写 title、description、hasDispute。概念描述要足以限定开始学习时的内容范围。紧扣目标与较新选择，不要求用户先知道专题。最多 24 个载体、64 个概念，每个载体 1–12 概念，每阶段 1–4 个载体。附件使用 F1、F2 等引用，只有该概念确实使用了该附件时才在 attachmentRefs 中列出，不相关时写空数组；把相关知识消化进概念描述。不要生成空阶段，不复制重复内容凑数。只输出指定 JSON。'
export const STAGED_PLAN_OUTPUT='{"title":"路线名称","stages":[[{"title":"载体 A","description":"学习目的","concepts":[{"title":"概念名称","description":"具体学习范围与解释","hasDispute":false}]}],[{"title":"载体 B","description":"并列方向之一","concepts":[{"title":"概念 B","description":"具体范围","hasDispute":false}]},{"title":"载体 C","description":"另一并列方向","concepts":[{"title":"概念 C","description":"具体范围","hasDispute":false}]}]]}'

export function compileStagedPlan(raw:unknown,scope:string,attachmentSourceIds:string[]=[]):R4Output{
  const plan=StagedPlanSchema.parse(raw),prefix='p'+createHash('sha256').update(scope).digest('hex').slice(0,16)
  const route:R4Output={version:'1.0',routeId:prefix,title:plan.title,carriers:[],concepts:[],carrierEdges:[],conceptEdges:[],entryConceptIds:[],terminalConceptIds:[]}
  const stages=plan.stages.map((stage,s)=>stage.map((item,i)=>{
    const id=`${prefix}-s${s+1}-${i+1}`,ids=item.concepts.map((_,c)=>`${id}-c${c+1}`)
    route.carriers.push({id,title:item.title,description:item.description})
    item.concepts.forEach((c,n)=>route.concepts.push({id:ids[n]!,carrierId:id,title:c.title,detailedDescription:c.description,hasDispute:c.hasDispute,attachmentSourceIds:[...new Set(c.attachmentRefs.map(ref=>{const source=attachmentSourceIds[Number(ref.slice(1))-1];if(!source)throw new Error('附件引用必须来自本次输入中的 F 编号');return source}))]}))
    for(let c=1;c<ids.length;c++)route.conceptEdges.push({id:`${id}-e${c}`,fromConceptId:ids[c-1]!,toConceptId:ids[c]!,reason:'按该载体中的推荐顺序学习'})
    return {id,first:ids[0]!,last:ids.at(-1)!}
  }))
  for(let s=1;s<stages.length;s++)for(const from of stages[s-1]!)for(const to of stages[s]!){
    route.carrierEdges.push({id:`ce-${route.carrierEdges.length+1}`,fromCarrierId:from.id,toCarrierId:to.id,reason:'完成上一阶段后进入下一阶段'})
    route.conceptEdges.push({id:`ne-${route.conceptEdges.length+1}`,fromConceptId:from.last,toConceptId:to.first,reason:'按阶段衔接，当前阶段内的方向并列'})
  }
  route.entryConceptIds=stages[0]!.map(x=>x.first);route.terminalConceptIds=stages.at(-1)!.map(x=>x.last)
  return R4OutputSchema.parse(route)
}
