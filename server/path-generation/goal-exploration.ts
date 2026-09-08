import { z } from 'zod'
import { LearningGoalSchema } from '@threadpeak/contracts/learning-goal'

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
export type GoalExploration=z.infer<typeof GoalExplorationSchema>

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
export const GOAL_EXPLORATION_PROMPT=`你为学习路线做探索，不生成最终路线。先读用户原话和所有来源，理解他希望做成什么；尚未明确的用途、基础和限制写入 assumptions/openQuestions，不能冒充用户已确认。
不同博主的建议不一定互相否定：比较他们想达到的成果、面对的学习者、成立条件和代价。例如“先学数学”和“先写代码”可能分别服务推导研究和尽快做出作品。逐项保留 advice、forWhom、conditions、tradeoffs、fitToGoal 及真实来源。材料没有交代作者目的时明确“材料未说明”，你的条件推断标为 inference。不要根据常识给每个概念制造争议。
候选概念逐个说明为什么有助于该目标，区分直接所需、必要前置和可选拓展。存在用户资料时，从资料的问题、公式、章节和实践目标反推所需知识，不套通用课程目录；F 引用必须真实。decisionPoints 只列会改变路线且用户尚未讲清的未知条件。没有证据时可以给标明推断的候选，不编来源。保留不同可行方法供访谈取舍，不按作者人气决定用户该学什么。字段约束：necessity 只能 direct/prerequisite/optional；materialRefs 只放附件 F1、F2 编号，没有附件必须 []。搜索 evidenceId 写在观点 sourceRefs 中，概念 perspectiveRefs 再引用该观点 id；不要把搜索证据编号填入 materialRefs。各字段简洁保留条件与取舍。只输出 JSON。`
export const GOAL_EXPLORATION_OUTPUT=JSON.stringify({goalHypothesis:{outcome:'希望能够完成的事情',motivation:'已说明的动机；未说明留空',successCriteria:['怎样算学会'],startingPoint:'已说明的基础；未说明留空',constraints:[],nonGoals:[],assumptions:[],openQuestions:[]},perspectives:[{id:'P1',advice:'学习建议',forWhom:'适用人群或未说明',conditions:'成立条件或待核实',tradeoffs:'收益与代价',fitToGoal:'和当前目标的关系',basis:'source',sourceRefs:['实际证据ID']}],candidates:[{carrier:'学习方向',concept:'候选概念',purpose:'怎样服务目标',necessity:'direct',materialRefs:[],perspectiveRefs:['P1'],dispute:{exists:false,reason:'没有来源支持实质争议'}}],decisionPoints:[{uncertainty:'用户尚未说清的事情',whyItChangesRoute:'它会改变什么'}]})
