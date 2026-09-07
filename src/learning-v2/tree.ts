import type { GraphNode } from './model'

export type Placement = { x:number; y:number; w:number; h:number }
export const cardColors = ['#ffffff','#fff2f2','#fff9e9','#ffffe9','#effbf5','#eefbff','#f3f2ff','#fbf0ff','#f1f2f4','#fce5e5','#ffedcb','#fcf5c4','#dff1e5','#d9f0f8','#e9e3fa','#f5ddf3','#e0e3e6','#f4cbcb','#ffe0ad','#f6e9a7','#bcdcc7','#b8e0ef','#d1c6f0','#e8bde3']

export function assertTree(nodes:GraphNode[]) {
  if(!nodes.length)return
  const byId=new Map(nodes.map(n=>[n.id,n]))
  if(byId.size!==nodes.length||nodes.filter(n=>!n.parents.length).length!==1||!byId.has('root'))throw Error('知识脉络需要一个根节点')
  for(const node of nodes){
    if(node.id==='root'){if(node.parents.length)throw Error('根节点不能有父节点');continue}
    if(node.parents.length!==1||!byId.has(node.parents[0]))throw Error('每张卡片必须且只能连接一个父卡片')
    const seen=new Set([node.id]);let parent=node.parents[0]
    while(parent){if(seen.has(parent))throw Error('知识脉络不能循环连接');seen.add(parent);parent=byId.get(parent)?.parents[0]??''}
  }
}

export function descendants(nodes:GraphNode[],id:string):string[]{
  const result:string[]=[];const queue=[id]
  while(queue.length){const current=queue.shift()!;if(result.includes(current))continue;result.push(current);queue.push(...nodes.filter(n=>n.parents[0]===current).map(n=>n.id))}
  return result
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
  const map:Record<string,Placement>={},byId=new Map(nodes.map(n=>[n.id,n]))
  const children=new Map<string,GraphNode[]>()
  nodes.forEach(n=>{if(n.parents[0])children.set(n.parents[0],[...(children.get(n.parents[0])??[]),n])})
  const sizes=new Map<string,number>()
  const height=(n:GraphNode)=>pendingIds.includes(n.id)?238:n.id==='root'?108:expanded.includes(n.id)?Math.min(560,Math.max(260,Math.ceil(n.text.length/22)*21+160)):n.type==='author'?276:n.type==='custom'?Math.max(64,Math.ceil(n.title.length/20)*22+32+(n.text?90:0)):240
  function measure(id:string):number{
    const n=byId.get(id)!;const kids=collapsed.includes(id)?[]:children.get(id)??[]
    const total=kids.reduce((sum,c)=>sum+measure(c.id),0)+Math.max(0,kids.length-1)*48
    const size=Math.max(height(n),total);sizes.set(id,size);return size
  }
  function place(id:string,x:number,top:number){
    const n=byId.get(id)!,h=height(n),w=id==='root'?218:300
    map[id]={x,y:top+(sizes.get(id)!-h)/2,w,h}
    const kids=collapsed.includes(id)?[]:children.get(id)??[]
    const total=kids.reduce((sum,c)=>sum+sizes.get(c.id)!,0)+Math.max(0,kids.length-1)*48
    let nextTop=top+(sizes.get(id)!-total)/2
    for(const child of kids){place(child.id,x+w+76,nextTop);nextTop+=sizes.get(child.id)!+48}
  }
  if(byId.has('root')){measure('root');place('root',30,36)}
  return map
}
