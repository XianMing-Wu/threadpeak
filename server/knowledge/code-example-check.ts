import {fromMarkdown} from 'mdast-util-from-markdown'
import {math} from 'micromark-extension-math'
import {mathFromMarkdown} from 'mdast-util-math'

/** Concrete arithmetic must use the declarative operation protocol. Variables
 * and isolated stated values remain prose; do not mistake x^2 for a calculation. */
export function hasUnverifiedCalculationBlocks(value:unknown):boolean{
 if(!value||typeof value!=='object')return false
 const sections=(value as {sections?:unknown}).sections
 if(!Array.isArray(sections))return false
 let unverified=false
 for(const section of sections){
  if(!Array.isArray(section?.blocks))continue
  for(const block of section.blocks){
   if(block?.kind!=='text'||typeof block.text!=='string')continue
   const visit=(node:any)=>{
    if(['code','inlineCode','blockquote'].includes(node.type))return
    if(node.type==='math'||node.type==='inlineMath'){
     const raw=node.value.replace(/\\(?:begin|end)\{[^}]*\}/g,'').replace(/\\[a-zA-Z]+/g,'')
     if(/\d/.test(raw)&&!/[a-zA-Z\p{L}]/u.test(raw)&&/[=+*/×÷]|\\(?:times|frac|cdot|begin)/.test(node.value))unverified=true
    }
    if(node.children)for(const child of node.children)visit(child)
   }
   visit(fromMarkdown(block.text,{extensions:[math()],mdastExtensions:[mathFromMarkdown()]}))
  }
 }
 return unverified
}

/** A deliberately small literal evaluator, never an interpreter. Unsupported
 * expressions are unknown. No imports, calls, interpolation or user code run. */
function pythonString(expression:string):string|undefined{
 const match=/^([rRuU]?)(["'])(.*)\2\s*(?:#.*)?$/.exec(expression)
 if(!match||match[3]!.length>8000)return
 const raw=match[3]!,quote=match[2]!
 let value=''
 for(let i=0;i<raw.length;i++){
  const ch=raw[i]!
  if(ch===quote)return
  if(ch!=='\\'){value+=ch;continue}
  const next=raw[++i];if(next===undefined)return
  if(match[1]!.toLowerCase()==='r'){value+='\\'+next;continue}
  const escapes:Record<string,string>={'\\':'\\',"'":"'",'"':'"',n:'\n',r:'\r',t:'\t',a:'\x07',b:'\b',f:'\f',v:'\v'}
  if(next in escapes){value+=escapes[next];continue}
  const size=next==='x'?2:next==='u'?4:next==='U'?8:0
  if(!size)return
  const hex=raw.slice(i+1,i+1+size);if(!new RegExp(`^[0-9a-f]{${size}}$`,'i').test(hex))return
  const point=parseInt(hex,16);if(point>0x10ffff)return
  value+=String.fromCodePoint(point);i+=size
 }
 return value
}

/** Reject a demonstrably false expected result; the caller recovers from the
 * frozen sources. A passing check says nothing about unrecognized programs. */
export function validateCodeExamples(markdown:string):void{
 for(const node of fromMarkdown(markdown).children){
  if(node.type!=='code'||!['python','py','python3'].includes(node.lang??''))continue
  const variables=new Map<string,string>()
  for(const line of node.value.split('\n')){
   if(/^\s/.test(line)){variables.clear();continue}
   const assignment=/^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(line)
   if(assignment){const value=pythonString(assignment[2]!);variables.delete(assignment[1]!);if(value!==undefined)variables.set(assignment[1]!,value);continue}
   const prediction=/^print\(\s*len\(\s*([A-Za-z_]\w*)\s*\)\s*\)\s*#\s*(?:=>|->|输出[:：]?|Output:)?\s*(\d+)\s*$/i.exec(line)
   if(prediction&&variables.has(prediction[1]!)){
    if([...variables.get(prediction[1]!)!].length!==Number(prediction[2]))throw Error('代码示例的字面字符串长度与预期输出矛盾')
   }else if(!/^print\(\s*[A-Za-z_]\w*\s*\)\s*(?:#.*)?$/.test(line)&&line.trim()&&!line.trim().startsWith('#'))variables.clear()
  }
 }
}
