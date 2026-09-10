import { z } from 'zod'
export const TaskActivitySchema=z.object({
  id:z.string(),kind:z.enum(['read','search','write','edit','think']),title:z.string(),detail:z.string().optional(),
  thought:z.string().optional(),step:z.string().optional(),
  status:z.enum(['running','done','waiting']),startedAt:z.number(),updatedAt:z.number(),finishedAt:z.number().optional(),
})
export type TaskActivity=z.infer<typeof TaskActivitySchema>

/** One visible status per model step; retain previous attempts as explicitly labelled history. */
export function latestThinkingActivities(activities: readonly TaskActivity[]): TaskActivity[] {
  const groups=new Map<string,TaskActivity[]>()
  for(const activity of activities){
    if(activity.kind!=='think'||!activity.thought?.trim())continue
    const key=activity.step??activity.id
    const group=groups.get(key)??[];group.push(activity);groups.set(key,group)
  }
  return [...groups.values()].map(group=>{
    // Late writes can update an older attempt; start order determines the current attempt.
    const ordered=[...group].sort((a,b)=>a.startedAt-b.startedAt),latest=ordered.at(-1)!
    if(ordered.length===1)return latest
    const previous=ordered.slice(0,-1).map((a,i)=>`先前尝试 ${i+1}（${a.status==='done'?'思考已结束':'输出已中断'}）\n\n${a.thought}`).join('\n\n')
    return {...latest,thought:`本次思考\n\n${latest.thought}\n\n${previous}`}
  })
}
