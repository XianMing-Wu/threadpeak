import type { GraphNode } from './model'
import {validateTree} from '@threadpeak/contracts/learning-v2'

export type Placement = { x:number; y:number; w:number; h:number }
export const cardColors = ['#ffffff','#fff2f2','#fff9e9','#ffffe9','#effbf5','#eefbff','#f3f2ff','#fbf0ff','#f1f2f4','#fce5e5','#ffedcb','#fcf5c4','#dff1e5','#d9f0f8','#e9e3fa','#f5ddf3','#e0e3e6','#f4cbcb','#ffe0ad','#f6e9a7','#bcdcc7','#b8e0ef','#d1c6f0','#e8bde3']

export function assertTree(nodes:GraphNode[]) {
  if(!nodes.length)return
  if(!nodes.some(n=>n.id==='root'&&n.type==='root'))throw Error('知识脉络需要一个根节点')
  validateTree(nodes)
}

export function childrenByParent(nodes:GraphNode[]){
  const children=new Map<string,GraphNode[]>()
  for(const node of nodes){const parent=node.parents[0];if(!parent)continue;let list=children.get(parent);if(!list){list=[];children.set(parent,list)}list.push(node)}
  return children
}
export function descendants(nodes:GraphNode[],id:string,children=childrenByParent(nodes)):string[]{
  const result:string[]=[],queue=[id],seen=new Set<string>()
  for(let i=0;i<queue.length;i++){const current=queue[i];if(seen.has(current))continue;seen.add(current);result.push(current);for(const child of children.get(current)??[])queue.push(child.id)}
  return result
}

export function documentOrder(nodes:GraphNode[],collapsed:readonly string[]=[]){
  const children=childrenByParent(nodes),hidden=new Set(collapsed),stack=(children.get('root')??[]).map(node=>({node,depth:0})).reverse(),rows:{node:GraphNode;depth:number}[]=[]
  const seen=new Set<string>()
  while(stack.length){const row=stack.pop()!;if(seen.has(row.node.id))continue;seen.add(row.node.id);rows.push(row);if(!hidden.has(row.node.id)){const kids=children.get(row.node.id)??[];for(let i=kids.length-1;i>=0;i--)stack.push({node:kids[i],depth:row.depth+1})}}
  return {rows,children}
}

export function offsetTree(base:Record<string,Placement>,children:Map<string,GraphNode[]>,offsets:Record<string,{x:number;y:number}>){
  const placed:Record<string,Placement>={},queue=[{id:'root',x:0,y:0}]
  for(let i=0;i<queue.length;i++){
    const current=queue[i],box=base[current.id];if(!box)continue
    const x=current.x+(offsets[current.id]?.x??0),y=current.y+(offsets[current.id]?.y??0)
    placed[current.id]={...box,x:box.x+x,y:box.y+y}
    for(const child of children.get(current.id)??[])queue.push({id:child.id,x,y})
  }
  return placed
}

export function appendCustom(nodes:GraphNode[],anchorId:string,kind:'child'|'sibling',title:string,text:string){
  const anchor=nodes.find(n=>n.id===anchorId)
  if(!anchor)throw Error('找不到这张卡片')
  // Ported from ponder-dialog-replica/canvas.js add(): blank card, sibling immediately
  // after the anchor, child at the end, root sibling inserted as a root child.
  const parentId=kind==='sibling'?(anchor.parents[0]??'root'):anchor.id
  const node:GraphNode={id:`custom-${crypto.randomUUID()}`,type:'custom',title:title.trim(),text:text.trim(),sources:[],parents:[parentId]}
  const next=[...nodes]
  const at=kind==='sibling'?next.findIndex(n=>n.id===anchorId)+1:next.length
  next.splice(at,0,node);assertTree(next);return {nodes:next,node}
}

export function removeBranch(nodes:GraphNode[],id:string){
  if(id==='root')return nodes
  const removed=new Set(descendants(nodes,id));return nodes.filter(n=>!removed.has(n.id))
}

// Each subtree owns its vertical space; branches grow without merging or crossing.
export function layoutTree(nodes:GraphNode[],collapsed:string[],expanded:string[],pendingIds:string[]=[]){
  assertTree(nodes)
  const map:Record<string,Placement>={},byId=new Map(nodes.map(n=>[n.id,n])),children=childrenByParent(nodes)
  const hidden=new Set(collapsed),open=new Set(expanded),pending=new Set(pendingIds),sizes=new Map<string,number>(),heights=new Map<string,number>()
  const height=(n:GraphNode)=>pending.has(n.id)?238:n.id==='root'?108:open.has(n.id)?Math.min(560,Math.max(260,Math.ceil(n.text.length/22)*21+160)):n.type==='author'?340:n.type==='custom'?Math.max(64,Math.ceil(n.title.length/20)*22+32+(n.text?90:0)):240
  const order:string[]=byId.has('root')?['root']:[]
  for(let i=0;i<order.length;i++)if(!hidden.has(order[i]))for(const child of children.get(order[i])??[])order.push(child.id)
  for(let i=order.length-1;i>=0;i--){
    const id=order[i],h=height(byId.get(id)!),kids=hidden.has(id)?[]:children.get(id)??[]
    heights.set(id,h);sizes.set(id,Math.max(h,kids.reduce((sum,c)=>sum+sizes.get(c.id)!,0)+Math.max(0,kids.length-1)*48))
  }
  const positions=new Map([['root',{x:30,top:36}]])
  for(const id of order){
    const {x,top}=positions.get(id)!,h=heights.get(id)!,w=id==='root'?218:300
    map[id]={x,y:top+(sizes.get(id)!-h)/2,w,h}
    const kids=hidden.has(id)?[]:children.get(id)??[],total=kids.reduce((sum,c)=>sum+sizes.get(c.id)!,0)+Math.max(0,kids.length-1)*48
    let nextTop=top+(sizes.get(id)!-total)/2
    for(const child of kids){positions.set(child.id,{x:x+w+76,top:nextTop});nextTop+=sizes.get(child.id)!+48}
  }
  return map
}
