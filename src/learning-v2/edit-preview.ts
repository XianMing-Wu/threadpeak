import {mergeNodeEdits} from '@threadpeak/contracts/node-edits'
import type {GraphNode} from './model'
/** Display unresolved local edits alongside new server cards; saving still uses three-way validation. */
export function editPreview(base:GraphNode[],local:GraphNode[],remote:GraphNode[]):GraphNode[]{
  try{return mergeNodeEdits(base,local,remote)}catch{/* Conflicts remain explicit; preview retains remote additions. */}
  const before=new Map(base.map(n=>[n.id,n])),draft=new Map(local.map(n=>[n.id,n]))
  const merged=remote.map(node=>{
    const old=before.get(node.id),next=draft.get(node.id)
    if(!old||!next)return node
    const changes:Partial<GraphNode>={}
    for(const key of ['title','text','color','stroke','edited'] as const)if(old[key]!==next[key])Object.assign(changes,{[key]:next[key]})
    return {...node,...changes}
  })
  const ids=new Set(merged.map(n=>n.id))
  for(const node of local)if(!before.has(node.id)&&!ids.has(node.id)&&node.parents.every(id=>ids.has(id))){merged.push(node);ids.add(node.id)}
  return merged
}
