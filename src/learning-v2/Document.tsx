import { MarkdownMath } from '../lib/MarkdownMath'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { GraphNode } from './model'
import { Glyph } from './atoms'

function DocumentCard({node,selected,busy,onSelect,onSave,toolbar,hasChildren,collapsed,onCollapse}:{node:GraphNode;selected:boolean;busy:boolean;onSelect:()=>void;onSave:(title:string,text:string)=>void;toolbar:ReactNode;hasChildren:boolean;collapsed:boolean;onCollapse:()=>void}){
  const content=useRef<HTMLDivElement>(null),title=useRef<HTMLHeadingElement>(null),body=useRef<HTMLTextAreaElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [editing,setEditing]=useState(false)
  useLayoutEffect(()=>{if(editing)body.current?.focus({preventScroll:true})},[editing])
  const draft=useRef({title:node.title,text:node.text})
  const saveRef=useRef(()=>{});saveRef.current=()=>{if(draft.current.title!==node.title||draft.current.text!==node.text)onSave(draft.current.title,draft.current.text)}
  useLayoutEffect(()=>{if(!content.current?.contains(document.activeElement)){draft.current={title:node.title,text:node.text};if(title.current)title.current.textContent=node.title;if(body.current)body.current.value=node.text}},[node.title,node.text])
  useLayoutEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);saveRef.current()},[])
  const save=()=>{if(timer.current)clearTimeout(timer.current);saveRef.current()}
  return <section className={`lp-doc-node ${selected?'is-selected':''}`} data-doc-id={node.id} style={node.color&&node.color!=='#ffffff'?{'--node-color':node.color} as React.CSSProperties:undefined} onClick={()=>onSelect()}>
    {hasChildren&&<button className="lp-doc-collapse" aria-label={`${collapsed?'展开':'收起'}文档章节 ${node.title||'未命名卡片'}`} onClick={e=>{e.stopPropagation();onCollapse()}}><Glyph name="chevron" size={14}/></button>}
    <div className="lp-doc-content" ref={content} onFocus={onSelect} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null)){queueMicrotask(()=>{if(content.current?.contains(document.activeElement))return;save();setEditing(false)})}}} onInput={e=>{if(title.current?.contains(e.target as Node))draft.current.title=title.current.innerText.trim();if(body.current?.contains(e.target as Node))draft.current.text=body.current.value;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>saveRef.current(),500)}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();save();(e.target as HTMLElement).blur()}}}>
      <h3 ref={title} contentEditable={!busy} suppressContentEditableWarning role="textbox" aria-label={`文档标题：${node.id}`} data-placeholder="未命名卡片" onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();setEditing(true)}}}/>
      <textarea className="lp-doc-text" style={{display:editing?undefined:'none'}} ref={body} readOnly={busy} rows={2} aria-label={`文档内容：${node.id}`} placeholder="写下这张卡片的内容…"/>
      {!editing&&<div className="lp-doc-read" role="button" tabIndex={busy?-1:0} aria-label={`编辑文档内容：${node.id}`} onClick={()=>!busy&&setEditing(true)} onKeyDown={e=>{if(!busy&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setEditing(true)}}}><MarkdownMath source={node.text||'写下这张卡片的内容…'} sourceExcerpt={node.type==='article'&&!node.edited} passive/></div>}
    </div>
    {node.author&&<small className="lp-doc-meta">{node.author.name} · 公开文章解读</small>}{node.edited&&<small className="lp-doc-meta">已编辑 · 已同步到画布</small>}
    {selected&&toolbar}
  </section>
}

// The reference's renderDocument(): one ordered document, nested sections mirror children.
export function KnowledgeDocument({nodes,selected,focusId,busy=false,onSelect,onSave,renderToolbar,onScroll}:{nodes:GraphNode[];selected:string[];focusId:string|null;busy?:boolean;onSelect:(id:string)=>void;onSave:(id:string,title:string,text:string)=>void;renderToolbar:(node:GraphNode)=>ReactNode;onScroll:()=>void}){
  const doc=useRef<HTMLDivElement>(null),[collapsed,setCollapsed]=useState<string[]>([])
  const byParent=new Map<string,GraphNode[]>();nodes.forEach(n=>{if(n.parents[0])byParent.set(n.parents[0],[...(byParent.get(n.parents[0])??[]),n])})
  useEffect(()=>{if(!focusId)return;setCollapsed([])},[focusId])
  useEffect(()=>{if(!focusId||collapsed.length)return;const el=Array.from(doc.current?.querySelectorAll<HTMLElement>('[data-doc-id]')??[]).find(e=>e.dataset.docId===focusId);if(!el)return;el.scrollIntoView({block:'center',behavior:'instant'});el.querySelector<HTMLElement>('.lp-doc-read')?.click();el.querySelector<HTMLElement>('.lp-doc-text')?.focus({preventScroll:true})},[focusId,collapsed.length])
  function branch(node:GraphNode):ReactNode{const children=byParent.get(node.id)??[];return <div key={node.id} className="lp-doc-branch"><DocumentCard node={node} selected={selected.includes(node.id)} busy={busy} onSelect={()=>onSelect(node.id)} onSave={(title,text)=>onSave(node.id,title,text)} toolbar={renderToolbar(node)} hasChildren={!!children.length} collapsed={collapsed.includes(node.id)} onCollapse={()=>setCollapsed(old=>old.includes(node.id)?old.filter(id=>id!==node.id):[...old,node.id])}/>{children.length>0&&!collapsed.includes(node.id)&&<div className="lp-doc-children">{children.map(branch)}</div>}</div>}
  return <div className="lp-doc-view" ref={doc} onScroll={onScroll} aria-label="知识脉络文档" onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}><h1>{nodes.find(n=>n.id==='root')?.title}</h1>{(byParent.get('root')??[]).map(branch)}<div className="lp-doc-overview"/></div>
}
