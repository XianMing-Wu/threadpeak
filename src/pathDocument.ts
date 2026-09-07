import type { LearningPathDocument } from 'liu-kanshan-learning-path-3d'
import type { PathCarrierSpec } from './workspace/types'

export function buildPathDocument(spec: {
  id: string
  title: string
  description: string
  goalTitle: string
  goalSummary: string
  startSummary?: string
  carriers: readonly PathCarrierSpec[]
  stages?: readonly (readonly string[])[]
}): LearningPathDocument {
  const carriers = spec.carriers
  const stages = spec.stages ?? carriers.map(c => [c.id])
  if (!carriers.length || stages.some(s=>!s.length) || new Set(stages.flat()).size!==carriers.length || stages.flat().length!==carriers.length || stages.flat().some(id=>!carriers.some(c=>c.id===id))) throw new Error('INVALID_PATH_STAGES')
  const levels = [['route-start'],...stages,['goal-understanding']]
  const flow:{id:string;fromSubjectId:string;toSubjectId:string;semantics?:{splitGroupId?:string;joinGroupId?:string}}[] = levels.slice(1).flatMap((next,i)=>levels[i]!.flatMap(from=>next.map(to=>({id:`flow-${from}-${to}`,fromSubjectId:from,toSubjectId:to}))))
  const flowGroups:Array<LearningPathDocument['structure']['flowGroups'][number]> = []
  for (const id of levels.flat()) {
    const outgoing=flow.filter(e=>e.fromSubjectId===id), incoming=flow.filter(e=>e.toSubjectId===id)
    if(outgoing.length>1){const group=`split-${id}`;flowGroups.push({id:group,type:'split',anchorSubjectId:id,policy:'parallel'});for(const e of outgoing)e.semantics={...e.semantics,splitGroupId:group}}
    if(incoming.length>1){const group=`join-${id}`;flowGroups.push({id:group,type:'join',anchorSubjectId:id,policy:'all-required'});for(const e of incoming)e.semantics={...e.semantics,joinGroupId:group}}
  }
  const cards: LearningPathDocument['data']['cards'] = [
    ...carriers.flatMap((carrier) => [
      { id: `card-${carrier.id}`, eyebrow: '载体', title: carrier.title, summary: carrier.summary, tags: ['知乎精选', '学习载体'] },
      ...carrier.concepts.map(([id, title, summary]) => ({
        id: `card-${id}`,
        eyebrow: '最终概念',
        title,
        summary,
        body: summary,
        tags: ['目标所需'],
      })),
    ]),
    { id: 'card-start', eyebrow: '路线起点', title: '从这里出发', summary: spec.startSummary ?? '刘看山会陪你沿着必要概念抵达目标。', tags: ['开始'] },
    { id: 'card-goal', eyebrow: '学习目标', title: spec.goalTitle, summary: spec.goalSummary, tags: ['路线终点'] },
  ]
  return {
    protocol: 'learning-path',
    version: '1.0',
    id: spec.id,
    metadata: { title: spec.title, description: spec.description, locale: 'zh-CN' },
    structure: {
      entrySubjectId: 'route-start',
      goalSubjectIds: ['goal-understanding'],
      subjects: [
        { id: 'route-start', cardRef: 'card-start', orderHint: 0 },
        ...carriers.map((carrier, index) => ({ id: carrier.id, cardRef: `card-${carrier.id}`, orderHint: index + 1 })),
        { id: 'goal-understanding', cardRef: 'card-goal', orderHint: carriers.length + 1 },
      ],
      concepts: carriers.flatMap((carrier) => carrier.concepts.map(([id], index) => ({
        id,
        subjectId: carrier.id,
        cardRef: `card-${id}`,
        actionRef: `action-${id}`,
        orderHint: index + 1,
      }))),
      flow,
      flowGroups,
    },
    data: {
      cards,
      resources: carriers.flatMap((carrier) => carrier.concepts.map(([id]) => ({ id: `resource-${id}`, href: '#session-learning' }))),
      actions: carriers.flatMap((carrier) => carrier.concepts.map(([id]) => ({
        id: `action-${id}`,
        kind: 'open-resource' as const,
        label: '进入学习',
        resourceId: `resource-${id}`,
        target: 'self' as const,
      }))),
    },
    presentation: { layout: { direction: 'top-to-bottom', subjectGap: 3.75, layerGap: 3.5, conceptGap: 3.75, conceptColumnGap: 4.4 } },
  }
}
