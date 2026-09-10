import { z } from 'zod'
import { LearningGoalSchema } from '@threadpeak/contracts/learning-goal'
import type {assembleBatchExploration} from './batch-exploration.ts'
import type { assembleExploration } from './carrier-exploration.ts'

const text=z.string().trim().min(1).max(1600)
export const GoalExplorationSchema=z.object({
  goalHypothesis:LearningGoalSchema,
  perspectives:z.array(z.object({
    id:z.string().min(1).max(80),
    advice:text,
    forWhom:text,
    conditions:text,
    tradeoffs:text,
    fitToGoal:text,
    basis:z.enum(['source','inference']),
    sourceRefs:z.array(z.string().min(1)).max(12),
  }).strict()).max(16),
  candidates:z.array(z.object({
    carrier:text,concept:text,purpose:text,
    necessity:z.enum(['direct','prerequisite','optional']),
    materialRefs:z.array(z.string().regex(/^F[1-9]\d*$/)).max(8),
    perspectiveRefs:z.array(z.string()).max(16),
    dispute:z.object({exists:z.boolean(),reason:text}).strict(),
  }).strict()).min(1).max(64),
  decisionPoints:z.array(z.object({uncertainty:text,whyItChangesRoute:text}).strict()).max(6),
}).strict()
// Existing saved interviews remain readable. New R2 writes the batch v4 shape.
export type GoalExploration=z.infer<typeof GoalExplorationSchema> | ReturnType<typeof assembleExploration> | ReturnType<typeof assembleBatchExploration>

export function validateGoalExploration(value:unknown,input:any):GoalExploration{
  const raw=value as any
  for(const c of raw?.candidates??[]){
    if(!['direct','prerequisite','optional'].includes(c.necessity))throw new Error('candidates.necessity 只能是 direct、prerequisite 或 optional；不能填 alternative')
    if(c.materialRefs?.some((r:unknown)=>typeof r!=='string'||!/^F[1-9]\d*$/.test(r)))throw new Error('candidates.materialRefs 只存附件 F1/F2 编号；没有附件必须 []。搜索证据放 perspectives.sourceRefs，概念通过 perspectiveRefs 引用观点 P 编号。')
  }
  const result=GoalExplorationSchema.parse(value)
  const sources=new Set((input.searchGroups??[]).flatMap((g:any)=>g.results.map((e:any)=>e.evidenceId)))
  const files=new Set((input.attachments??[]).map((_:unknown,i:number)=>`F${i+1}`))
  const perspectives=new Set(result.perspectives.map(p=>p.id))
  if(perspectives.size!==result.perspectives.length)throw new Error('不同观点必须使用不同 id')
  for(const p of result.perspectives){
    if(p.basis==='source'&&!p.sourceRefs.length)throw new Error('来源观点必须提供真实 sourceRefs；无来源的判断标记 inference')
    if(p.sourceRefs.some(ref=>!sources.has(ref)&&!files.has(ref)))throw new Error('观点只能引用本次 evidenceId 或附件 F 编号')
  }
  for(const c of result.candidates){
    if(c.materialRefs.some(ref=>!files.has(ref))||c.perspectiveRefs.some(ref=>!perspectives.has(ref)))throw new Error('候选概念引用了不存在的资料或观点')
  }
  return result
}
