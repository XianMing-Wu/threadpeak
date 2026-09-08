import {useMemo} from 'react'
import {getReadOnlyKnowledge} from '../workspace/store'
import {showcaseLearning} from '../showcase/catalog'
import {LearningWorkspace} from './Workspace'

export function ExampleWorkspace({knowledgeId,conceptId,onBack,initialView='graph'}:{knowledgeId:string;conceptId:string;onBack:()=>void;initialView?:'graph'|'research'}){
  const example=useMemo(()=>{
    const knowledge=getReadOnlyKnowledge(knowledgeId)
    return knowledge?.owner==='example'?showcaseLearning(knowledge.routeId,conceptId):undefined
  },[knowledgeId,conceptId])
  if(!example)return <div className="lp-empty-state"><p>找不到这个示例概念。</p><button onClick={onBack}>返回概念列表</button></div>
  return <LearningWorkspace key={`${knowledgeId}:${conceptId}`} routeId={example.routeId} conceptId={conceptId} initialView={initialView} example={example} onBack={onBack}/>
}
