import {useMemo} from 'react'
import {getReadOnlyKnowledge} from '../workspace/store'
import {showcaseLearning} from '../showcase/catalog'
import {showcaseConcept} from '../showcase/content'
import {LearningWorkspace} from './Workspace'

export function ExampleWorkspace({knowledgeId,conceptId,onBack,initialView='graph'}:{knowledgeId:string;conceptId:string;onBack:()=>void;initialView?:'graph'|'research'}){
  const example=useMemo(()=>{
    const knowledge=getReadOnlyKnowledge(knowledgeId)
    return knowledge?.owner==='example'?{concept:showcaseConcept(knowledge.routeId,conceptId),learning:showcaseLearning(knowledge.routeId,conceptId)}:undefined
  },[knowledgeId,conceptId])
  if(!example?.concept)return <div className="lp-empty-state"><p>找不到这个示例概念。</p><button onClick={onBack}>返回概念列表</button></div>
  if(!example.learning)return <div className="lp-empty-state"><h2>{example.concept.title}</h2><p>{example.concept.purpose}</p><p>这条示例路线提供前 3 个概念的学习内容。你可以从自己的目标出发，继续完整的学习。</p><a href="#home">开始我的学习</a><button onClick={onBack}>返回路线</button></div>
  return <LearningWorkspace key={`${knowledgeId}:${conceptId}`} routeId={example.learning.routeId} conceptId={conceptId} initialView={initialView} example={example.learning} onBack={onBack}/>
}
