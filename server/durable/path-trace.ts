import type {Job} from './store.ts'
type Step={id:string;kind:'agent'|'search'|'confirm';status:'running'|'done'|'failed'|'stopped';title:string;extra?:string}
const definitions=[
  {key:'R1',title:'理解学习目标',kind:'agent',after:[]},
  {key:'R-S:0',title:'搜索学习方法',kind:'search',after:['R1']},
  {key:'R-S:1',title:'搜索争议与误区',kind:'search',after:['R1']},
  {key:'R2',title:'整理学习方向',kind:'agent',after:['R-S:0','R-S:1']},
  {key:'R3',title:'准备选择题',kind:'agent',after:['R2']},
] as const
const statusOf=(job:Pick<Job,'status'>,done:boolean):Step['status']=>done?'done':job.status==='waiting'?'failed':job.status==='cancelled'?'stopped':'running'
export function pathTrace(jobs:Pick<Job,'id'|'kind'|'status'|'checkpoints'>[],path:{status:string;questionSets:any[];searchScope?:{kind:string}}):Step[]{
  const result:Step[]=[]
  for(const job of jobs){
    const has=(key:string)=>!!job.checkpoints[key]
    if(job.kind==='path.start')for(const step of (path.searchScope?.kind==='collections'?[definitions[0],{key:'R-materials',title:'读取所选收藏资料',kind:'search' as const,after:['R1']},{...definitions[3],after:['R-materials']},definitions[4]]:definitions)){
      if(!has(step.key)&&!step.after.every(has))continue
      const status=statusOf(job,has(step.key));const value=job.checkpoints[step.key]?.value
      result.push({id:`${job.id}:${step.key}`,kind:step.kind,status,title:(status==='running'?'正在':'')+step.title,...(step.kind==='search'&&Array.isArray(value)?{extra:`${value.length} 条资料`}:{})})
    }
    if(job.kind==='path.clarify')result.push({id:`${job.id}:clarify`,kind:'agent',status:statusOf(job,has('R3b')),title:has('R3b')?'已回应你的补充':'正在回应你的补充'})
  }
  const count=path.questionSets.reduce((n,set)=>n+Object.keys(set.selectedOptionIds??{}).length,0)
  if(count)result.push({id:'route:choices',kind:'confirm',status:'done',title:'已确认学习偏好',extra:`${count} 项选择`})
  const build=jobs.filter(j=>j.kind==='path.answer').at(-1),active=path.questionSets.find(s=>s.status==='active'),answered=active&&active.questions.every((q:any)=>active.selectedOptionIds[q.id])
  if(build&&(answered||build.checkpoints.R4||build.checkpoints['R4-plan'])){
    const done=path.status==='published',status=statusOf(build,done)
    result.push({id:`${build.id}:plan`,kind:'agent',status,title:done?'已安排顺序与并列阶段':'正在安排顺序与并列阶段'})
    if(done)result.push({id:`${build.id}:publish`,kind:'confirm',status:'done',title:'学习路线已生成'})
  }
  for(const job of jobs.filter(j=>j.kind==='path.chat'))result.push({id:`${job.id}:answer`,kind:'agent',status:statusOf(job,job.status==='completed'),title:job.status==='completed'?'已回答路线追问':'正在回答路线追问'})
  return result
}
