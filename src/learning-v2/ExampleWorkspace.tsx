import {useMemo} from 'react'
import {getConceptGraph,getKnowledge,listConceptCards} from '../workspace/store'
import {exampleLearning} from './example-learning'
import {LearningWorkspace} from './Workspace'

export function ExampleWorkspace({knowledgeId,conceptId,onBack,initialView='graph'}:{knowledgeId:string;conceptId:string;onBack:()=>void;initialView?:'graph'|'research'}){
  const example=useMemo(()=>{
    const knowledge=getKnowledge(knowledgeId)
    if(knowledge?.owner!=='example')return undefined
    const card=listConceptCards(knowledgeId).find(c=>c.id===conceptId),graph=getConceptGraph(knowledgeId,conceptId)
    if(!card||!graph)return undefined
    return exampleLearning({id:`${knowledgeId}:${conceptId}`,routeId:knowledge.routeId,conceptId,title:card.title,notes:graph.nodes.map(n=>({title:n.title,paragraphs:n.turns.flatMap(t=>[...t.paragraphs])})).filter(n=>n.paragraphs.length)})
  },[knowledgeId,conceptId])
  if(!example)return <div className="lp-empty-state"><p>找不到这个示例概念。</p><button onClick={onBack}>返回概念列表</button></div>
  return <LearningWorkspace key={`${knowledgeId}:${conceptId}`} routeId={example.routeId} conceptId={conceptId} initialView={initialView} example={example} onBack={onBack}/>
}
