import { MarkdownMath } from '../lib/MarkdownMath'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {documentOrder} from './tree'
import type { GraphNode } from './model'
import { Glyph } from './atoms'

function DocumentCard({node,selected,busy,onSelect,onSave,toolbar,hasChildren,collapsed,onCollapse}:{node:GraphNode;selected:boolean;busy:boolean;onSelect:()=>void;onSave:(title:string,text:string)=>void;toolbar:ReactNode;hasChildren:boolean;collapsed:boolean;onCollapse:()=>void}){
  const content=useRef<HTMLDivElement>(null),title=useRef<HTMLSpanElement>(null),body=useRef<HTMLTextAreaElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [editing,setEditing]=useState(false)
  useLayoutEffect(()=>{if(editing)body.current?.focus({preventScroll:true})},[editing])
  const draft=useRef({title:node.title,text:node.text})
  const saveRef=useRef(()=>{});saveRef.current=()=>{if(draft.current.title!==node.title||draft.current.text!==node.text)onSave(draft.current.title,draft.current.text)}
  useLayoutEffect(()=>{if(!content.current?.contains(document.activeElement)){draft.current={title:node.title,text:node.text};if(title.current)title.current.textContent=node.title;if(body.current)body.current.value=node.text}},[node.title,node.text])
  useLayoutEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);saveRef.current()},[])
  const save=()=>{if(timer.current)clearTimeout(timer.current);saveRef.current()}
  return <section className={`lp-doc-node ${selected?'is-selected':''}`} data-doc-id={node.id} data-custom-color={node.color?true:undefined} style={node.color?{'--node-color':node.color} as React.CSSProperties:undefined} onClick={()=>onSelect()}>
    {hasChildren&&<button className="lp-doc-collapse" aria-label={`${collapsed?'展开':'收起'}文档章节 ${node.title||'未命名卡片'}`} aria-expanded={!collapsed} onClick={e=>{e.stopPropagation();onCollapse()}}><Glyph name="chevron" size={14}/></button>}
    <div className="lp-doc-content" ref={content} onFocus={onSelect} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null)){queueMicrotask(()=>{if(content.current?.contains(document.activeElement))return;save();setEditing(false)})}}} onInput={e=>{if(title.current?.contains(e.target as Node))draft.current.title=title.current.innerText.trim();if(body.current?.contains(e.target as Node))draft.current.text=body.current.value;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>saveRef.current(),500)}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();save();(e.target as HTMLElement).blur()}}}>
      {!editing&&<button className="lp-doc-edit" type="button" disabled={busy} aria-label={`编辑文档内容：${node.title||'未命名卡片'}`} onClick={()=>setEditing(true)}><Glyph name="edit" size={14}/>编辑正文</button>}
      <h3><span ref={title} contentEditable={!busy} suppressContentEditableWarning role="textbox" aria-label={`文档标题：${node.title||'未命名卡片'}`} data-placeholder="未命名卡片" onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();setEditing(true)}}}/></h3>
      <textarea className="lp-doc-text" style={{display:editing?undefined:'none'}} ref={body} readOnly={busy} rows={2} aria-label={`文档内容：${node.title||'未命名卡片'}`} placeholder="写下这张卡片的内容…"/>
      {!editing&&<div className="lp-doc-read" onClick={event=>{if(!busy&&!(event.target as HTMLElement).closest('pre,a,button'))setEditing(true)}}><MarkdownMath source={node.text||'写下这张卡片的内容…'} sourceExcerpt={node.type==='article'&&!node.edited} passive/></div>}
    </div>
    {node.author&&<small className="lp-doc-meta">{node.author.name} · 公开文章解读</small>}{node.edited&&<small className="lp-doc-meta">已编辑 · 已同步到画布</small>}
    {selected&&toolbar}
  </section>
}

// Preserve tree preorder and depth without recursively nesting DOM sections.
export function KnowledgeDocument({nodes,selected,focusId,busy=false,onSelect,onSave,renderToolbar,onScroll}:{nodes:GraphNode[];selected:string[];focusId:string|null;busy?:boolean;onSelect:(id:string)=>void;onSave:(id:string,title:string,text:string)=>void;renderToolbar:(node:GraphNode)=>ReactNode;onScroll:()=>void}){
  const doc=useRef<HTMLDivElement>(null),[collapsed,setCollapsed]=useState<string[]>([])
  const {rows,children}=useMemo(()=>documentOrder(nodes,collapsed),[nodes,collapsed])
  useEffect(()=>{if(!focusId)return;setCollapsed([])},[focusId])
  useEffect(()=>{if(!focusId||collapsed.length)return;const el=Array.from(doc.current?.querySelectorAll<HTMLElement>('[data-doc-id]')??[]).find(e=>e.dataset.docId===focusId);if(!el)return;el.scrollIntoView({block:'center',behavior:'instant'});el.querySelector<HTMLElement>('.lp-doc-read')?.click();el.querySelector<HTMLElement>('.lp-doc-text')?.focus({preventScroll:true})},[focusId,collapsed.length])
  useEffect(()=>{
    const el=doc.current
    if(!el)return
    const onWheel=(e:WheelEvent)=>{
      e.stopPropagation()
      const max=el.scrollHeight-el.clientHeight
      const atTop=el.scrollTop<=0&&e.deltaY<0
      const atBottom=el.scrollTop>=max-1&&e.deltaY>0
      if(max<=0||atTop||atBottom||e.ctrlKey||e.metaKey)e.preventDefault()
    }
    el.addEventListener('wheel',onWheel,{passive:false,capture:true})
    return()=>el.removeEventListener('wheel',onWheel,{capture:true})
  },[])
  return <div className="lp-doc-view" ref={doc} onScroll={onScroll} aria-label="知识脉络文档" onPointerDown={e=>e.stopPropagation()} onWheel={e=>{e.stopPropagation();e.nativeEvent.stopImmediatePropagation()}}><h2>{nodes.find(n=>n.id==='root')?.title}</h2>{rows.map(({node,depth})=><div key={node.id} className="lp-doc-branch lp-doc-flat" data-depth={depth} style={{marginInlineStart:Math.min(depth,6)*23}}><DocumentCard node={node} selected={selected.includes(node.id)} busy={busy} onSelect={()=>onSelect(node.id)} onSave={(title,text)=>onSave(node.id,title,text)} toolbar={renderToolbar(node)} hasChildren={!!children.get(node.id)?.length} collapsed={collapsed.includes(node.id)} onCollapse={()=>setCollapsed(old=>old.includes(node.id)?old.filter(id=>id!==node.id):[...old,node.id])}/></div>)}<div className="lp-doc-overview"/></div>
}
