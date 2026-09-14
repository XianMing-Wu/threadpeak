import {fromMarkdown} from 'mdast-util-from-markdown'
import {math} from 'micromark-extension-math'
import {mathFromMarkdown} from 'mdast-util-math'
import {parseFormalJson,formalRef} from '../agent-runtime/formal-json.ts'
import {normalizeStepOutput} from '../agent-runtime/normalize-step-output.ts'
import {readDamagedPlan} from '../path-generation/recover-plan.ts'
import {groundedCatalogNames} from '../path-generation/direct-route.ts'
import {normalizeComposition,normalizePlacements} from '../knowledge/answer-normalization.ts'
import {ANSWER_BASIS_LIMIT} from '../knowledge/answer-basis.ts'
import {repairAnswerPresentation} from './math-output.ts'

export const recoverableModelOutput=(code?:string)=>!!code&&['OUTPUT_TRUNCATED','OUTPUT_EMPTY','OUTPUT_INCOMPLETE','OUTPUT_LIMIT','STREAM_INCOMPLETE','STREAM_INVALID_RESPONSE','EMPTY_RESPONSE','MODEL_EMPTY','INCOMPLETE_RESPONSE'].includes(code)

type RecordValue=Record<string,unknown>
const object=(v:unknown):RecordValue=>v&&typeof v==='object'&&!Array.isArray(v)?v as RecordValue:{}
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const text=(v:unknown,max=1200)=>typeof v==='string'?v.trim().slice(0,max).replace(/[\uD800-\uDBFF]$/u,''):''
const distinct=<T>(v:T[]):T[]=>[...new Set(v)]
const words=(v:string)=>distinct([...new Intl.Segmenter('zh',{granularity:'word'}).segment(v.normalize('NFKC').toLowerCase())].filter(w=>w.isWordLike&&w.segment.length>1).map(w=>w.segment))
const question=(input:RecordValue)=>text(input.currentQuestion??input.question??input.currentMessage??input.goal??object(input.goalContext).rawGoal,6000)
function subject(input:RecordValue,max=24){
 const value=text(object(input.concept).title)||question(input)||text(input.title)
 const parts=words(value).filter(w=>!['学习','系统','一个','自己','希望','需要','想要','如何','什么','哪些','可以','因为','所以','以及','the','and','with'].includes(w))
 let result=''
 for(const part of parts)if(result.length+part.length+1<=max)result+=(result?' ':'')+part
 return result||'当前学习目标'
}
function rank<T>(items:T[],input:RecordValue,content:(v:T)=>string){
 const terms=words(question(input)+' '+text(object(input.concept).title))
 return items.map((item,index)=>({item,index,score:terms.reduce((n,w)=>n+Number(content(item).toLowerCase().includes(w)),0)})).sort((a,b)=>b.score-a.score||a.index-b.index)
}
function rootOf(raw:string,name:string){
 let root:unknown
 try{root=parseFormalJson(raw)}catch{root=readDamagedPlan(raw,false)[0]}
 root=normalizeStepOutput(name,root)
 let value=object(root)
 for(let i=0;i<4;i++){
  if(['queries','questions','sections','placements','selections','carriers','content','kind','evidenceIds'].some(k=>value[k]!==undefined))break
  const nested=['result','data','output','answer'].map(k=>object(value[k])).filter(v=>Object.keys(v).length)
  if(nested.length!==1)break
  value=nested[0]!
 }
 return value
}

/** These are editable choices, never asserted personal facts or invented research. */
function interview(input:RecordValue,root:RecordValue,round=1){
 const topic=subject(input,60)
 const defaults=[
  {prompt:`围绕“${topic}”，下一步更希望先解决哪类问题？`,reason:'只调整推进方式，原先确认的目标、基础和限制继续保留。',labels:['弄懂一个具体疑问及其原因','试做一个与目标有关的小步骤','比较可行方法及各自适用条件'],effects:['先组织当前疑问所需的解释与局部前置','先选最小可检查操作，再补必需概念','先梳理方法的适用条件与代价，不代替用户选择']},
  {prompt:'如果学习中遇到暂时不会的一步，你希望怎样衔接？',reason:'选择补基础的方式，不推断你已经掌握或完全不会任何内容。',labels:['在当前例子里就地解释','先做一个小检查再决定补多少','指出需要的基础，由我决定先后'],effects:['只补当前步骤必需的局部关系','用可观察的小检查识别缺口','保留前置说明与自由进入节点的能力']},
 ]
 const seen=new Set<string>()
 const candidates=list(root.questions).map(object).map((q):RecordValue=>({...q,options:list(q.options).filter((o,i,all)=>text(object(o).label)&&all.findIndex(other=>text(object(other).label)===text(object(o).label))===i)})).filter(q=>{const prompt=text(q.prompt);if(!prompt||seen.has(prompt)||list(q.options).length<3)return false;seen.add(prompt);return true}).slice(0,round===1?4:3)
 while(candidates.length<2){const d=defaults[candidates.length]!;candidates.push({prompt:d.prompt,reason:d.reason,options:d.labels.map((label,i)=>({label,routeEffect:d.effects[i]}))})}
 return {round,message:text(root.message,600)||'保留你已经说明的目标与条件，再选择更适合自己的推进方式。',status:'active',questions:candidates.map((q,i)=>({id:`r${round}-q${i+1}`,prompt:text(q.prompt,400),reason:text(q.reason,500)||'确认会影响学习推进方式的条件。',options:list(q.options).slice(0,3).map((v,j)=>{const o=object(v);return {id:`r${round}-q${i+1}-o${j+1}`,label:text(o.label,250),routeEffect:`${j+1}：${text(o.routeEffect,660)||'按此选择调整相关内容的学习次序与深度。'}`}})}))}
}
function recoverQueries(root:RecordValue,input:RecordValue,min:number,max:number,limit:number,suffixes:string[]){
 const valid=distinct(list(root.queries).map(q=>text(typeof q==='string'?q:object(q).text,1000)).filter(q=>q.length<=limit&&q.length>0)).slice(0,max)
 const prefix=subject(input,Math.max(12,limit-24))
 for(const suffix of suffixes){if(valid.length>=min)break;const query=`${prefix} ${suffix}`;if(!valid.includes(query))valid.push(query)}
 return valid
}
const sourceString=(v:RecordValue)=>text(v.title,1000)+' '+text(v.summary??v.content,50000)
const cardRefs=(input:RecordValue)=>list(object(input.read_card_scope).cards).map(object)

/** Recovery only sees this operation's prepared, owner-scoped source map. It
 * never imports identities or facts from malformed model output. Conservative
 * mode drops uncertain prose, while keeping actual source text readable. */
export function recoverStructuredValue(name:string,raw:string,prepared:unknown,conservative=false):unknown {
 const input=object(prepared),root=conservative?{}:rootOf(raw,name),step=name.split(':')[0]!.replace(/^R2-names$/,'R2')
 if(step==='R1'){
  const queries=recoverQueries(root,input,4,5,45,['有哪些学习方法','书籍课程如何选择','不同方法适用条件','学习顺序和实践经验'])
  return {queries:queries.map((q,i)=>({id:`Q${i+1}`,text:q,angle:i<2?'normal_learning':'pitfall_or_dispute',purpose:i<2?'寻找服务原始目标的学习方法与载体。':'比较适用条件、必要范围与实际经验，不预设结论。'}))}
 }
 if(step==='R2')return groundedCatalogNames({carriers:list(root.carriers).filter(v=>typeof v==='string').slice(0,4)},object(input.searchScope) as {kind:string},[text(input.goal,50000),...list(object(input.goalContext).userStatements).map(s=>text(object(s).text,50000)),text(object(input.firstSearch).summary,1000000),...list(input.attachments).map(a=>text(object(a).content,1000000))])
 if(step==='R3')return interview(input,root)
 if(step==='R3b'){
  const round=Math.max(1,Math.min(3,Number(input.activeRound)||1))
  if(root.kind==='replace_questions'&&round<3&&list(root.questions).length){const replacement=interview(input,root,round+1);return {kind:'replace_questions',...replacement}}
  return {kind:'continue_current',activeRound:round,message:text(root.message,1200)||'你的补充会和原始目标一起进入路线。当前题目仍可按真实情况选择，也可以直接填写自定义回答；已说明的条件会继续保留。'}
 }
 if(['L-search-plan','A-card-plan','N1'].includes(step)){
  const queries=recoverQueries(root,input,2,step==='L-search-plan'?6:step==='N1'?3:4,step==='N1'?90:160,step==='L-search-plan'?['概念关系与具体例子','适用条件和常见误解']:['具体方法与实践经验','困难原因和适用条件'])
  return step==='N1'?{topic:text(root.topic,80)||subject(input,60),needs:list(root.needs).map(v=>text(v,1500)).filter(Boolean).slice(0,4).length?list(root.needs).map(v=>text(v,1500)).filter(Boolean).slice(0,4):[question(input)||'了解当前问题的公开经验与适用条件'],queries}: {queries}
 }
 if(step==='L-source-select'){
  const candidates=list(input.candidates).map(object),ids=new Set(candidates.map(c=>c.evidenceId))
  const selected=distinct(list(root.evidenceIds).filter(id=>typeof id==='string'&&ids.has(id))).slice(0,8)
  return {evidenceIds:selected.length?selected:rank(candidates,input,sourceString).filter(r=>r.score>0).slice(0,6).map(r=>r.item.evidenceId)}
 }
 if(step==='A-card-select'){
  const excluded=new Set(list(input.excludedAuthorIds)),candidates=list(input.candidates).map(object).filter(c=>typeof c.authorId==='string'&&!excluded.has(c.authorId)),byId=new Map(candidates.map(c=>[c.evidenceId,c])),seen=new Set<unknown>()
  const selections=list(root.selections).map(object).flatMap(s=>{
   const id=formalRef(s.evidenceId,'E'),source=byId.get(id)
   if(!source||seen.has(source.authorId))return []
   seen.add(source.authorId);return [{evidenceId:id,reason:text(s.reason,600)||`可查看《${text(source.title,200)}》的公开说明。`,limitation:text(s.limitation,600)||'材料覆盖与当前问题的差异仍需结合原文核实。'}]
  }).slice(0,3)
  if(!selections.length){const source=rank(candidates,input,sourceString)[0]?.item;if(source)selections.push({evidenceId:source.evidenceId,reason:`可先查看《${text(source.title,200)}》，作为当前问题的补充线索。`,limitation:'这是本次公开内容中相对接近的线索，尚不能确认作者能够完整解决当前问题或接受咨询。'})}
  return {normalizedQuestion:question(input)||subject(input),selections}
 }
 if(step==='N2'){
  const candidates=list(input.candidates).map(object),byId=new Map(candidates.map(c=>[c.ref,c])),used=new Set<string>()
  const selected=list(root.selections).map(object).flatMap(s=>{
   const ref=text(formalRef(s.sourceRef,'E')),source=byId.get(ref)
   if(!source||used.has(ref))return []
   const known=new Set(list(source.passages).map(p=>object(p).ref)),refs=distinct(list(s.passageRefs).map(p=>formalRef(p,'P')).filter(p=>known.has(p))).slice(0,3)
   if(!refs.length){const passages=list(source.passages).map(object);const best=rank(passages,input,p=>text(p.content,100000))[0]?.item;if(best)refs.push(best.ref)}
   if(!refs.length)return []
   used.add(ref);return [{sourceRef:ref,passageRefs:refs,fit:s.fit==='direct'?'direct':'related',coverageLimitations:Array.isArray(s.coverageLimitations)?s.coverageLimitations.map(v=>text(v,1500)).filter(Boolean).slice(0,4):undefined,contactLimitations:list(s.contactLimitations).map(v=>text(v,1500)).filter(Boolean).slice(0,4),needsCoverage:list(s.needsCoverage).map(object).filter(c=>/^N[1-9]\d*$/.test(text(c.needRef))&&['direct','partial','none'].includes(text(c.support))).slice(0,4).map(c=>({needRef:c.needRef,support:c.support})),reason:text(s.reason,1500)||'该公开材料提供了相关问题的说明。',canHelpWith:text(s.canHelpWith,1500)||text(source.title,1500),limitation:text(s.limitation,1500)||'公开文章不证明作者愿意咨询或能解决当前具体情境。',question:text(s.question,1500)||'这些经验适用的前提与限制是什么？',messageBody:text(s.messageBody,6000)||`我想向你请教：${question(input)||'这篇材料讨论的方法有哪些适用条件？'}`}]
  }).slice(0,12)
  if(!selected.length){const best=rank(candidates,input,c=>text(c.title)+' '+list(c.passages).map(p=>text(object(p).content,50000)).join(' ')).find(r=>r.score>0)?.item;const passage=best&&list(best.passages).map(object)[0];if(best&&passage)selected.push({sourceRef:text(best.ref),passageRefs:[passage.ref],fit:'related',coverageLimitations:['材料覆盖范围尚待核实。'],contactLimitations:[],needsCoverage:[],reason:`《${text(best.title,200)}》包含与当前问题相关的公开线索。`,canHelpWith:text(best.title),limitation:'仅确认公开材料有相关内容；具体适用性、个人经验范围与服务意愿仍需核实。',question:'这些经验适用于哪些条件，与我的问题有什么差异？',messageBody:`我想向你请教：${question(input)||'该方法的条件与边界是什么？'}`})}
  return {selections:selected,unresolved:text(root.unresolved,1500)}
 }
 if(name.startsWith('L-answer:basis')){
  const cards=list(object(input.candidate_card_scope).cards).map(object),known=new Map(cards.map(c=>[c.ref,c])),seen=new Set<string>()
  const selections=list(root.selections).map(object).flatMap(s=>{const ref=formalRef(s.ref,'C');if(typeof ref!=='string'||!known.has(ref)||seen.has(ref))return [];seen.add(ref);return [{ref,reason:text(s.reason,600)||'依据本次问题核对这份实际材料。'}]}).slice(0,ANSWER_BASIS_LIMIT)
  if(!selections.length)selections.push(...rank(cards,input,c=>text(c.title)+' '+text(c.content,100000)).slice(0,ANSWER_BASIS_LIMIT).map(({item:c})=>({ref:c.ref as string,reason:'保留本次实际材料中与问题有关的说明及其条件，未提供的结论不推断。'})))
  return {selections}
 }
 if(name.startsWith('L-answer:compose')||name==='L-answer'){
  const cards=cardRefs(input),allowed=new Set(cards.map(c=>c.ref)),max=Math.min(12,Number(object(input.answerBounds).maxCards)||8)
  let normalized:RecordValue={};try{
   if(hasUnverifiedCalculationBlocks(root))throw Error('unverified calculation')
   const candidate=object(normalizeComposition(root,new Set(cards.map(c=>text(c.ref)))))
   for(const s of list(candidate.sections))validateCodeExamples(text(object(s).text,50000))
   normalized=candidate
  }catch{/* use actual materials */}
  const seenSections=new Set<string>()
  const sections=list(normalized.sections).map(object).filter(s=>{const key=text(s.text,50000);if(!allowed.has(s.after)||!key||seenSections.has(key))return false;seenSections.add(key);return true}).slice(0,max).map(s=>({after:s.after,title:text(s.title,300)||'理解这一点',text:repairAnswerPresentation(repairSourceAttributions(text(s.text,50000),cards))}))
  const planned=Array.isArray(input.basisPlan)
  if(planned&&cards.some(c=>!sections.some(s=>s.after===c.ref)))sections.length=0
  if(!sections.length)for(const {item:c} of (planned?cards.map(item=>({item})):rank(cards,input,c=>text(c.title)+' '+text(c.content,100000))).slice(0,Math.min(planned?ANSWER_BASIS_LIMIT:3,max))){
   const excerpt=repairAnswerPresentation(readableExcerpt(text(c.content,100000)||text(c.title),650))
   sections.push({after:c.ref,title:text(c.title,300)||'从已有材料继续',text:`先对照这份材料中的原有说明：\n\n${excerpt.split('\n').map(line=>'> '+line).join('\n')}\n\n围绕当前问题，可以先核对这段说明的适用条件，以及它能解释和没有说明的部分。这里只呈现材料已有内容，未提供的结论和细节仍需依据原文确认。`})
  }
  return {...input.mode==='first_learning'?{sourceReview:cards.map(c=>({ref:c.ref,contribution:`本次可读材料：${text(c.title,350)}；按当前问题保留原有说明和适用边界。`}))}:{},sections}
 }
 if(name.startsWith('L-answer:attach')){
  const catalog=list(input.citationCatalog).map(object),byCard=new Map(catalog.map(c=>[c.ref,c]));let supplied:RecordValue={};try{supplied=object(normalizePlacements(root))}catch{/* original composition bindings remain authoritative */}
  return {placements:list(input.answerSections).map(object).map((section,i)=>{
   const proposed=list(supplied.placements).map(object).find(p=>p.section===section.ref),proposedCard=proposed&&proposed.after===section.after?byCard.get(proposed.after):undefined,original=byCard.get(section.after)!,card=original
   const excerpts=list(card.excerpts).map(object),refs=proposedCard?distinct(list(proposed!.evidenceRefs).filter(ref=>excerpts.some(e=>e.ref===ref))).slice(0,6):[]
   if(!refs.length){const content=excerpts.filter(e=>e.ref!=='E1'),ranked=rank(content.length?content:excerpts,{currentQuestion:section.text},e=>text(e.text,100000));refs.push(...ranked.slice(0,Math.min(3,ranked.length)).map(r=>r.item.ref))}
   return {section:`P${i+1}`,after:card.ref,evidenceRefs:refs}
  })}
 }
 if(step==='source-reading-v3')return {available:false}
 throw new Error(`No output recovery contract for ${name}`)
}

/** Whole sentences from across a source, never a prefix disguised as a summary. */
export function readableExcerpt(source:string,budget:number):string{
 const segmenter=new Intl.Segmenter('zh',{granularity:'sentence'})
 const units=distinct(source.split(/\n+/u).flatMap(line=>[...segmenter.segment(line)].map(s=>s.segment.trim())).filter(Boolean)),selected:string[]=[]
 const eligible=units.filter(s=>s.length<=budget)
 // Sample the beginning, middle and end before filling remaining available space.
 const order=distinct([0,Math.floor(eligible.length/2),eligible.length-1,...eligible.map((_,i)=>i)])
 let size=0
 for(const i of order){const value=eligible[i];if(value&&size+value.length+2<=budget){selected.push(value);size+=value.length+2}}
 return selected.length?selected.sort((a,b)=>units.indexOf(a)-units.indexOf(b)).join('\n'):'这段材料包含较长的连续内容，需在原文中结合完整上下文阅读；当前不据此推断缺失的结论。'
}

/** Only attribution syntax is rewritten. Source IDs never alter code, formulas,
 * quotations, or variable names. The visible title comes from the frozen scope. */
export function repairSourceAttributions(source:string,cards:RecordValue[]):string{
 const titles=new Map(cards.map(c=>[text(c.ref),text(c.title,300)])),edits:{start:number;end:number;value:string}[]=[]
 const visit=(node:any)=>{
  if(['code','inlineCode','math','inlineMath','blockquote','link','image'].includes(node.type))return
  if(node.type==='text'&&node.position){
   const start=node.position.start.offset!,end=node.position.end.offset!,raw=source.slice(start,end)
   const value=raw.replace(/(?<![A-Za-z0-9_])C[1-9]\d*(?![A-Za-z0-9_])/g,(ref:string,offset:number)=>{
    if(!titles.has(ref))return ref
    const before=raw.slice(Math.max(0,offset-8),offset),after=raw.slice(offset+ref.length,offset+ref.length+24)
    return /(?:根据|参见|参考|来自|见)\s*$/.test(before)||/^\s*(?:(?:和|与|、)\s*C[1-9]\d*\s*)*(?:都|也|中|里|的|还)?\s*(?:中|里|提到|说明|解释|指出|强调|建议|提醒|认为|展示|提供|给出|描述|对|把|将|讲)/.test(after)?`《${titles.get(ref)}》`:ref
   })
   if(value!==raw)edits.push({start,end,value})
  }else if(node.children)node.children.forEach(visit)
 }
 visit(fromMarkdown(source,{extensions:[math()],mdastExtensions:[mathFromMarkdown()]}))
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end)
 return source
}
import {hasUnverifiedCalculationBlocks,validateCodeExamples} from '../knowledge/code-example-check.ts'
