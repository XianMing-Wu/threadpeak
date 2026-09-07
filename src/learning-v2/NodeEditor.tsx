import type { GraphNode } from './model'
import { Glyph, IconButton } from './atoms'
import { cardColors } from './tree'

export type EditorMode = 'add'|'color'|'more'
export function NodeEditor({ mode, node, onMode, onClose, onAdd, onEdit, onColor, onStroke, onDuplicate, onDelete }: {
  mode:EditorMode;node:GraphNode;onMode:(mode:EditorMode)=>void;onClose:()=>void;
  onAdd:(kind:'child'|'sibling')=>void;onEdit:()=>void;onColor:(color:string)=>void;onStroke:(stroke:number)=>void;onDuplicate:()=>void;onDelete:()=>void
}) {
  const labels={add:'添加卡片',color:'卡片样式',more:'卡片操作'}
  return <section className="lp-node-editor" role="dialog" aria-label={labels[mode]} onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose()}}>
    {mode!=='add'&&<header><strong>{labels[mode]}</strong><IconButton icon="close" label="关闭卡片操作" onClick={onClose}/></header>}
    {mode==='add'?<div className="lp-node-menu"><button onClick={()=>onAdd('sibling')}><Glyph name="plus"/>添加同级卡片</button><button onClick={()=>onAdd('child')}><Glyph name="graph"/>添加子级卡片<kbd>Tab</kbd></button></div>:mode==='more'?<div className="lp-node-menu"><button disabled={node.id==='root'} onClick={onEdit}><Glyph name="edit"/>编辑卡片<kbd>Enter</kbd></button><button disabled={node.id==='root'} onClick={onDuplicate}><Glyph name="copy"/>复制卡片</button><button disabled={node.id==='root'||node.type==='article'} className="lp-delete-action" onClick={onDelete}><Glyph name="trash"/>删除这一分支<kbd>⌫</kbd></button>{node.type==='article'&&<small>原始文章保留，可编辑图中的展示内容。</small>}</div>:mode==='color'?<><div className="lp-color-grid" aria-label="卡片颜色">{cardColors.map((color,i)=><button key={color} aria-label={`颜色 ${i+1} ${color}`} aria-pressed={(node.color??'#ffffff')===color} style={{background:color}} onClick={()=>onColor(color)}>{(node.color??'#ffffff')===color&&<Glyph name="check" size={16}/>}</button>)}</div><div className="lp-stroke-options"><span>描边</span>{[1,2,3].map(stroke=><button key={stroke} aria-label={`${stroke} 像素描边`} aria-pressed={(node.stroke??1)===stroke} onClick={()=>onStroke(stroke)}><i style={{height:stroke}}/></button>)}</div></>:null}
  </section>
}
