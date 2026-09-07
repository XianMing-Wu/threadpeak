import type { AuthorNetwork } from '../../packages/contracts/src/authors.ts'
import type { AuthorNetworkGraphModel } from '../session/project-author-network.ts'

/** Use the existing visual vocabulary; identities and relationships remain lossless. */
export function networkGraph(network:AuthorNetwork,filter=''):AuthorNetworkGraphModel{
  const nodes=new Map<string,AuthorNetworkGraphModel['nodes'][number]>(),edges=new Map<string,AuthorNetworkGraphModel['edges'][number]>()
  const connect=(source:string,target:string,kind:AuthorNetworkGraphModel['edges'][number]['kind'])=>{const id=`${kind}:${source}->${target}`;edges.set(id,{id,source,target,kind})}
  for(const a of network.authors)for(const e of a.evidence)for(const u of e.uses){
    if(filter&&u.topicId!==filter)continue
    const author=`author:${encodeURIComponent(a.id)}`,concept=`concept:${encodeURIComponent(u.topicId)}`
    nodes.set(author,{id:author,kind:'author',label:a.name,detail:`${a.evidence.length} 篇材料 · ${a.topics.length} 个主题`})
    nodes.set(concept,{id:concept,kind:'concept',label:u.topic,detail:u.resourceId?'学习概念':u.origin==='collection'?'收藏专题':u.origin==='creation'?'创作专题':'请教主题'})
    if(u.carrierId&&u.carrier){
      const carrier=`carrier:${encodeURIComponent(u.carrierId)}`
      nodes.set(carrier,{id:carrier,kind:'carrier',label:u.carrier,detail:'学习内容'})
      connect(carrier,concept,'has-concept')
    }
    let host=concept
    if(u.question){
      host=`question:${encodeURIComponent(JSON.stringify([u.topicId,u.question]))}`
      nodes.set(host,{id:host,kind:'question',label:u.question,detail:u.origin==='search'?'搜索时的问题':'学习中的问题'})
      connect(concept,host,'has-question')
    }
    connect(author,host,'authored-at')
  }
  return {nodes:[...nodes.values()],edges:[...edges.values()]}
}
