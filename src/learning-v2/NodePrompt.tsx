import { useEffect, useId, useRef, useState } from 'react'
import type { GraphNode } from './model'
import { Glyph, IconButton, type IconName } from './atoms'

export type NodePromptMode = 'ai' | 'author'
export const aiQuickActions: {label:string;icon:IconName;question:string}[] = [
  {label:'深入探索',icon:'search',question:'请深入探索这张卡片的内容，展开其中的关键原理与适用条件。'},
  {label:'解释',icon:'help',question:'请解释这张卡片，用通俗的话说明它是什么意思。'},
  {label:'简化',icon:'simplify',question:'请简化这张卡片，用最精炼的大白话保留核心意思。'},
  {label:'示例',icon:'example',question:'请围绕这张卡片给出一个具体例子，帮助我理解。'},
]

export function NodePrompt({ mode, nodes, depth, onDepth, busy=false, onSubmit, onClose }: {
  mode: NodePromptMode
  nodes: GraphNode[]
  depth: 'fast' | 'deep'
  onDepth: (depth: 'fast' | 'deep') => void
  busy?: boolean
  onSubmit: (text: string) => Promise<boolean>
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const label = mode === 'author' ? '问博主' : '询问 AI'

  useEffect(() => {
    if (!opener.current && document.activeElement !== input.current) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!input.current?.closest('.ux-dict-pv')) input.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => { if (!input.current?.closest('.ux-dict-pv')) input.current?.focus({ preventScroll: true }) }, [mode])

  function dismiss() {
    onClose()
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
  }
  async function submit() {
    if (!value.trim() || busy || nodes.length === 0) return
    const sent=value;if (await onSubmit(sent.trim())) setValue(current=>current===sent?'':current)
  }

  if(mode==='ai')return <form className="lp-node-prompt lp-ai-quick" role="dialog" aria-label="询问 AI" onSubmit={e=>{e.preventDefault();submit()}} onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();dismiss()}}}>
    <div className="lp-ai-input"><Glyph name="spark" size={19}/><textarea ref={input} aria-label="询问 AI 的问题" placeholder="询问 AI" value={value} onChange={e=>setValue(e.target.value)} rows={value.includes('\n')?3:1} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit()}}}/><button type="submit" aria-label="发送询问 AI 问题" disabled={busy||!value.trim()||!nodes.length}><Glyph name="arrow" size={20}/></button></div>
    <div className="lp-quick-actions"><span>快速操作</span>{aiQuickActions.map(action=><button type="button" key={action.label} disabled={busy||!nodes.length} onClick={()=>onSubmit(action.question)}><Glyph name={action.icon} size={19}/>{action.label}</button>)}</div>
    <footer><button type="button" className="lp-node-prompt-depth" aria-pressed={depth==='deep'} onClick={()=>onDepth(depth==='fast'?'deep':'fast')}><Glyph name="spark" size={13}/>{depth==='deep'?'深度思考':'快速回答'}</button><span>{busy?'正在完成上一条回复':'Esc 关闭'}</span><IconButton icon="close" label="关闭询问 AI 输入框" onClick={dismiss}/></footer>
  </form>
  return <form className="lp-node-prompt" role="dialog" aria-labelledby={titleId}
    onSubmit={event => { event.preventDefault(); submit() }}
    onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); dismiss() }
    }}>
    <header><span><Glyph name={mode === 'author' ? 'message' : 'spark'} size={17}/><strong id={titleId}>{label}</strong></span>
      <IconButton icon="close" label={`关闭${label}输入框`} onClick={dismiss}/></header>
    <div className="lp-node-prompt-sources" aria-label="本次引用节点">
      {nodes.map(node => <span key={node.id} title={node.title}><Glyph name={node.type === 'article' ? 'book' : 'graph'} size={12}/><span>{node.title}</span></span>)}
    </div>
    <textarea ref={input} aria-label={`${label}的问题`} placeholder={mode === 'author' ? '想请博主解释什么？' : '针对所选内容，你想了解什么？'}
      value={value} onChange={event => setValue(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() }
      }}/>
    <footer><button type="button" className="lp-node-prompt-depth" aria-label="深度思考" aria-pressed={depth === 'deep'} onClick={() => onDepth(depth === 'fast' ? 'deep' : 'fast')}><Glyph name="spark" size={14}/>{depth === 'deep' ? '深度思考' : '快速回答'}</button>
      <span>{busy ? '正在完成上一条回复' : 'Shift + Enter 换行'}</span>
      <button type="submit" className="lp-node-prompt-send" aria-label={`发送${label}问题`} disabled={busy || !value.trim() || nodes.length === 0}><Glyph name="arrow" size={18}/></button>
    </footer>
  </form>
}
