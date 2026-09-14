import {renderCalculationSlots,renderTeachingBlocks} from './calculation-blocks.ts'
import {fromMarkdown} from 'mdast-util-from-markdown'

export {parseFormalJson as parseAnswerJson} from '../agent-runtime/formal-json.ts'

const record=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined
const notation=(value:string)=>value.normalize('NFKC').trim().replace(/^[\[`]\s*|\s*[\]`]$/g,'')
const ref=(value:unknown)=>typeof value==='string'?notation(value).replace(/^c\s*0*(\d+)$/i,'C$1'):value
/** Keep prose split across text/text2/text3, while discarding unused metadata.
 * Reference scope, section count, source review and mathematics are still validated. */
export function normalizeComposition(value:unknown,allowedRefs?:ReadonlySet<string>):unknown {
  let root=record(value)
  if(root&&!Array.isArray(root.sections)){
    const candidates=['answer','result','data'].map(key=>record(root![key])).filter(v=>Array.isArray(v?.sections))
    if(candidates.length===1)root=candidates[0]
  }
  if(!root||!Array.isArray(root.sections))return value
  // This is an internal reading log, not a citation. Extra entries describing
  // route context must not invalidate otherwise complete, correctly bound prose.
  // Keep required actual-card coverage; never use this filter on section.after.
  const reviews=Array.isArray(root.sourceReview)?root.sourceReview.map(item=>{
    const review=record(item);return review?{ref:ref(review.ref),contribution:review.contribution}:item
  }).filter(item=>!allowedRefs||!record(item)||allowedRefs.has(record(item)!.ref as string)):root.sourceReview
  const seenReviews=new Set<string>()
  const sourceReview=Array.isArray(reviews)?reviews.filter(item=>{
    const key=JSON.stringify(item)
    if(seenReviews.has(key))return false
    seenReviews.add(key);return true
  }):reviews
  return {
    ...(root.sourceReview!==undefined?{sourceReview}:{}),
    sections:root.sections.map(item=>{
      const section=record(item)
      if(!section)return item
      const chunks=Object.entries(section).filter(([key])=>/^text(?:[1-9]\d*)?$/.test(key)).sort(([a],[b])=>(Number(a.slice(4))||0)-(Number(b.slice(4))||0))
      // Unknown types must still fail instead of silently losing generated content.
      const blockText=renderTeachingBlocks(section.blocks)
      const text=blockText|| (chunks.length&&chunks.every(([,part])=>typeof part==='string')?chunks.map(([,part])=>(part as string).trim()).filter(Boolean).join('\n\n'):section.text)
      if(chunks.some(([,part])=>typeof part!=='string'))throw new Error('讲解续写字段必须是完整正文字符串')
      return {after:ref(section.after),title:typeof section.title==='string'?section.title.replace(/^#{1,6}\s+/,''):section.title,text:typeof text==='string'?normalizeAnswerHeadings(renderCalculationSlots(text,root!.calculations)):text}
    }),
  }
}

/** Heading levels are presentation, not a reason to regenerate teaching prose.
 * AST ranges keep headings inside code fences/inline code untouched. */
function normalizeAnswerHeadings(text:string):string{
  const edits:{start:number;end:number;value:string}[]=[]
  const walk=(node:ReturnType<typeof fromMarkdown>|ReturnType<typeof fromMarkdown>['children'][number])=>{
    if(node.type==='heading'&&node.depth<=2&&node.position){
      const start=node.position.start.offset!,end=node.position.end.offset!,raw=text.slice(start,end)
      edits.push({start,end,value:/^ {0,3}#{1,2}\s/.test(raw)?raw.replace(/^( {0,3})#{1,2}(?=\s)/,'$1###'):'### '+raw.replace(/\n {0,3}[=-]+\s*$/,'')})
    }else if('children' in node)for(const child of node.children)walk(child as ReturnType<typeof fromMarkdown>['children'][number])
  }
  walk(fromMarkdown(text))
  for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end)
  return text
}

/** Normalize reference notation and ordering only. Missing or conflicting source
 * bindings remain invalid; never guess a parent or invent an excerpt. */
export function normalizePlacements(value:unknown):unknown{
  const root=record(value)
  if(!root||!Array.isArray(root.placements))return value
  const placements=root.placements.map(item=>{
    const p=record(item);if(!p)return item
    const section=typeof p.section==='string'?notation(p.section).replace(/^p\s*0*(\d+)$/i,'P$1'):p.section
    const after=ref(p.after)
    const refs=Array.isArray(p.evidenceRefs)?[...new Set(p.evidenceRefs.map(v=>{
      if(typeof v!=='string')return v
      const normalized=notation(v).replace(/^c\s*0*(\d+)\s*\.\s*e\s*0*(\d+)$/i,'C$1.E$2').replace(/^e\s*0*(\d+)$/i,'E$1')
      // Compatibility accepts a qualified reference only when its card agrees.
      // The new protocol uses local E refs so a card ID is written only once.
      if(/^C[1-9]\d*\.E[1-9]\d*$/.test(normalized)&&!normalized.startsWith(after+'.'))throw new Error(`${section} 的 ${normalized} 不在 ${after} 中；evidenceRefs 只填写该卡的局部 E 编号`)
      return typeof after==='string'&&normalized.startsWith(after+'.')?normalized.slice(after.length+1):normalized
    }))]:p.evidenceRefs
    return {section,after,evidenceRefs:refs}
  })
  if(placements.every(p=>record(p)&&typeof record(p)!.section==='string'&&/^P[1-9]\d*$/.test(record(p)!.section as string)))placements.sort((a,b)=>Number((record(a)!.section as string).slice(1))-Number((record(b)!.section as string).slice(1)))
  return {placements}
}
