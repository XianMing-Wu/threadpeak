import {latestThinkingActivities,type TaskActivity} from '@threadpeak/contracts/task-activity'
import {ProcessTrace} from './ProcessTrace'

export function ThinkingActivities({activities=[],waiting=false,stopped=false}:{activities?:TaskActivity[];waiting?:boolean;stopped?:boolean}){
  return <ProcessTrace steps={latestThinkingActivities(activities).map(a=>({
    id:a.id,kind:'think',status:a.status==='done'?'done':stopped?'stopped':waiting||a.status==='waiting'?'failed':'running',
    extra:a.title,thought:a.thought,
  }))}/>
}
