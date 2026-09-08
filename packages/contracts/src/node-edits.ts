import type { GraphNode } from './learning-v2.ts'

const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b)
export class NodeEditConflict extends Error { constructor(){super('NODE_EDIT_CONFLICT')} }

/** Common text/color edits carry only changed cards; structural edits keep full ordering. */
export function nodeFieldPatch(base:GraphNode[],desired:GraphNode[]):{baseNodes:GraphNode[];nodes:GraphNode[]}|undefined{
  if(base.length!==desired.length||base.some((node,i)=>node.id!==desired[i]?.id))return
  const before:GraphNode[]=[],after:GraphNode[]=[]
  for(let i=0;i<base.length;i++)if(!same(base[i],desired[i])){before.push(base[i]!);after.push(desired[i]!)}
  return {baseNodes:before,nodes:after}
}
export function mergeNodeFieldPatch(patch:{baseNodes:GraphNode[];nodes:GraphNode[]},current:GraphNode[]){
  if(patch.baseNodes.length!==patch.nodes.length||patch.baseNodes.some((node,i)=>node.id!==patch.nodes[i]?.id)||new Set(patch.nodes.map(n=>n.id)).size!==patch.nodes.length)throw new NodeEditConflict()
  return mergeNodeEdits(patch.baseNodes,patch.nodes,current)
}

/** Three-way merge: only user-changed fields may replace their observed versions. */
export function mergeNodeEdits(base:GraphNode[],desired:GraphNode[],current:GraphNode[]):GraphNode[]{
  const previous=new Map(base.map(n=>[n.id,n])), next=new Map(desired.map(n=>[n.id,n]))
  const merged=new Map(current.map(n=>[n.id,structuredClone(n)]))
  for(const before of base){
    const after=next.get(before.id), live=merged.get(before.id)
    if(!after){if(live&&!same(live,before))throw new NodeEditConflict();merged.delete(before.id);continue}
    if(same(before,after))continue
    if(!live)throw new NodeEditConflict()
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
      const field=key as keyof GraphNode
      if(same(before[field],after[field]))continue
      if(!same(live[field],before[field])&&!same(live[field],after[field]))throw new NodeEditConflict()
      if(after[field]===undefined)delete (live as any)[field]
      else (live as any)[field]=structuredClone(after[field])
    }
  }
  for(const node of desired)if(!previous.has(node.id)){
    const live=merged.get(node.id)
    if(live&&!same(live,node))throw new NodeEditConflict()
    merged.set(node.id,structuredClone(node))
  }
  // Keep concurrent insertions and use the preceding desired node as an insertion anchor.
  const order=current.map(n=>n.id).filter(id=>merged.has(id))
  const retained=base.filter(n=>next.has(n.id)).map(n=>n.id)
  const reordered=desired.filter(n=>previous.has(n.id)).map(n=>n.id)
  if(!same(retained,reordered)){
    const liveOrder=order.filter(id=>previous.has(id)&&next.has(id))
    if(!same(liveOrder,retained)&&!same(liveOrder,reordered))throw new NodeEditConflict()
    const positions=order.flatMap((id,i)=>previous.has(id)&&next.has(id)?[i]:[])
    positions.forEach((position,i)=>{order[position]=reordered[i]!})
  }
  desired.forEach((node,i)=>{
    if(order.includes(node.id))return
    const before=desired.slice(0,i).reverse().find(n=>order.includes(n.id))
    order.splice(before?order.indexOf(before.id)+1:0,0,node.id)
  })
  return order.map(id=>merged.get(id)!)
}
