import {hasEmptySourceMath} from '@threadpeak/contracts/source-image'
import {prepareMarkdown} from '@threadpeak/contracts/markdown-source'
import {renderMath} from '@threadpeak/contracts/math-normalize'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {math} from 'micromark-extension-math'
import {mathFromMarkdown} from 'mdast-util-math'
/** Generated answers are checked before committing. Imported evidence is never rewritten. */
export function validateAnswerMath(text:string){
  const prepared=prepareMarkdown(text)
  if(hasEmptySourceMath(text))throw new Error('公式定界符内没有内容，请提供完整的表达式或明确说明缺少条件。')
  for(const item of prepared.math)if(renderMath(item.tex,item.display).kind==='unresolved')throw new Error(`请修正这一处公式的 LaTeX 格式，保留原意并配齐定界符/参数：${item.tex.slice(0,180)}`)
}

/** Keep an unrepairable expression readable verbatim rather than regenerate an
 * otherwise useful answer or invent operands. Code nodes are never touched. */
export function repairAnswerPresentation(text:string):string{
 const tree=fromMarkdown(text,{extensions:[math()],mdastExtensions:[mathFromMarkdown()]})
 const edits:{start:number;end:number;value:string}[]=[]
 const visit=(node:any)=>{
  if((node.type==='math'||node.type==='inlineMath')&&node.position&&(renderMath(node.value,node.type==='math').kind==='unresolved'||!node.value.trim())){
   const value=node.value||'此处未提供公式',ticks='`'.repeat(Math.max(3,...(value.match(/`+/g)??[]).map((s:string)=>s.length+1)))
   edits.push({start:node.position.start.offset,end:node.position.end.offset,value:`\n\n${ticks}text\n${value}\n${ticks}\n\n`})
  }else if(node.type==='text'&&node.position){
   const start=node.position.start.offset,raw=text.slice(start,node.position.end.offset)
   for(const match of raw.matchAll(/\$\$[ \t]*\$\$/g))edits.push({start:start+match.index,end:start+match.index+match[0].length,value:'（此处未提供公式）'})
  }else if(node.children)for(const child of node.children)visit(child)
 }
 visit(tree)
 for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end)
 // Delimiters with no body have no expression to reconstruct.
 return text
}
