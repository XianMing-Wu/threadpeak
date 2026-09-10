import type {Job} from './store.ts'
type Step={id:string;kind:'agent'|'search'|'confirm';status:'running'|'done'|'failed'|'stopped';title:string;extra?:string}
const definitions=[
  {key:'R1',title:'理解学习目标',kind:'agent',after:[]},
  {key:'R-S:0',title:'搜索学习方法',kind:'search',after:['R1']},
  {key:'R-S:1',title:'搜索争议与误区',kind:'search',after:['R1']},
  {key:'R2',title:'整理学习方向',kind:'agent',after:['R-S:0','R-S:1']},
  {key:'R3',title:'准备聊聊你的目标',kind:'agent',after:['R2']},
] as const
const statusOf=(job:Pick<Job,'status'>,done:boolean):Step['status']=>done?'done':job.status==='waiting'?'failed':job.status==='cancelled'?'stopped':'running'
export function pathTrace(jobs:Pick<Job,'id'|'kind'|'status'|'checkpoints'>[],path:{status:string;questionSets:any[];searchScope?:{kind:string};workflow?:string;research?:{ready:boolean}}):Step[]{
  const result:Step[]=[]
  for(const job of jobs){
    const checkpoint=(key:string)=>Object.entries(job.checkpoints).find(([name])=>name.startsWith(`${key}@goal-v1:`)||name.startsWith(`${key}:goal-choices-v2@goal-v1`))?.[1]??job.checkpoints[`${key}@goal-v1`]??job.checkpoints[key]
    const has=(key:string)=>!!checkpoint(key)
    const direct=path.workflow==='route-direct-v6'||Object.keys(job.checkpoints).some(k=>k.startsWith('R2-names:v6'))
    if(job.kind==='path.start'){
      const first=path.searchScope?.kind==='collections'?[definitions[0],{key:'R-materials',title:'读取所选收藏资料',kind:'search' as const,after:['R1']}]:definitions.slice(0,3)
      const prerequisites=path.searchScope?.kind==='collections'?['R-materials']:['R-S:0','R-S:1']
      const names=(checkpoint('R2-names:v6')?.value as {carriers?:string[]}|undefined)?.carriers??[]
      const next=direct?[
        {key:'R2-names:v6',title:'提取待补查载体',kind:'agent',after:prerequisites},
        ...names.map((name,i)=>({key:`R-Catalog:v6:${i+1}`,title:`补查${name}`,kind:'search',after:i<2?['R2-names:v6']:['R-Catalog:v6:1','R-Catalog:v6:2']})),
        {key:'R3:v6',title:'准备路线选择题',kind:'agent',after:['R2-names:v6']},
      ]:[{...definitions[3],after:prerequisites},definitions[4]]
      for(const step of [...first,...next]){
        if(!has(step.key)&&!step.after.every(has))continue
        const status=statusOf(job,has(step.key)),value=checkpoint(step.key)?.value
        result.push({id:`${job.id}:${step.key}`,kind:step.kind as Step['kind'],status,title:(status==='running'?'正在':'')+step.title,...(step.kind==='search'&&Array.isArray(value)?{extra:`${value.length} 条资料`}:{})})
      }
    }
    if(job.kind==='path.clarify')result.push({id:`${job.id}:clarify`,kind:'agent',status:statusOf(job,has('R3b')),title:has('R3b')?'已回应你的补充':'正在回应你的补充'})
  }
  const count=path.questionSets.reduce((n,set)=>n+Object.keys(set.selectedOptionIds??{}).length+Object.keys(set.customAnswers??{}).length,0)
  if(count)result.push({id:'route:choices',kind:'confirm',status:'done',title:'已记下你的想法',extra:`${count} 条回答`})
  const build=jobs.filter(j=>j.kind==='path.answer').at(-1),active=path.questionSets.find(s=>s.status==='active'),answered=active&&active.questions.every((q:any)=>active.selectedOptionIds[q.id]||active.customAnswers?.[q.id])
  if(build&&(answered||Object.keys(build.checkpoints).some(key=>/^(R4@|R4-plan)/.test(key)))){
    const done=path.status==='published',status=statusOf(build,done)
    result.push({id:`${build.id}:plan`,kind:'agent',status,title:done?'已安排顺序与并列阶段':'正在安排顺序与并列阶段'})
    if(done)result.push({id:`${build.id}:publish`,kind:'confirm',status:'done',title:'学习路线已生成'})
  }
  for(const job of jobs.filter(j=>j.kind==='path.chat'))result.push({id:`${job.id}:answer`,kind:'agent',status:statusOf(job,job.status==='completed'),title:job.status==='completed'?'已回答路线追问':'正在回答路线追问'})
  return result
}
