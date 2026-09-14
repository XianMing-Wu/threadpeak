import {CALCULATION_OUTPUT_RULE} from './calculation-blocks.ts'
import {validateCodeExamples,hasUnverifiedCalculationBlocks} from './code-example-check.ts'
import {fromMarkdown} from 'mdast-util-from-markdown'
import { z } from 'zod'
import { semanticChunks } from '../agent-runtime/semantic-chunks.ts'
import { CardScopeSchema, readCardScope, resolveCardOperations } from './card-tools.ts'
import {normalizeComposition,normalizePlacements} from './answer-normalization.ts'

const CardRef = z.string().regex(/^C[1-9]\d*$/)
export const CompositionSchema = z.object({
  sourceReview: z.array(z.object({ref:CardRef,contribution:z.string().trim().min(1).max(600)}).strict()).optional(),
  sections: z.array(z.object({after:CardRef,title:z.string().trim().min(1).max(300),text:z.string().trim().min(1).max(50000)}).strict()).min(1).max(12),
}).strict()
export type Composition = z.infer<typeof CompositionSchema>
export const PlacementSchema = z.object({placements:z.array(z.object({
  section:z.string().regex(/^P[1-9]\d*$/),after:CardRef,evidenceRefs:z.array(z.string().regex(/^E[1-9]\d*$/)).min(1).max(6),
}).strict()).min(1).max(12)}).strict()
export function validateComposition(value:unknown, view:z.infer<typeof CardScopeSchema>, max:number, first:boolean) {
  if(hasUnverifiedCalculationBlocks(value))throw new Error('具体数值运算必须由声明式操作数生成，文字块不能绕过计算校验')
  const answer=CompositionSchema.parse(normalizeComposition(value,new Set(view.cards.map(c=>c.ref))))
  if(answer.sections.length>max)throw new Error(`正文最多 ${max} 段，请合并重复内容，不逐篇复述`)
  const refs=new Set(view.cards.map(c=>c.ref)),review=answer.sourceReview?.map(r=>r.ref)
  if(first&&!review||review&&(review.length!==refs.size||new Set(review).size!==refs.size||review.some(ref=>!refs.has(ref))))throw new Error('sourceReview 必须逐卡覆盖实际阅读范围，不能重复或越界')
  if(answer.sections.some(s=>!refs.has(s.after)))throw new Error('每段 after 必须来自本次 read_card_scope')
  for(const section of answer.sections){
    validateCodeExamples(section.text)
    const leaked=[...refs].filter(ref=>new RegExp(`(?:${ref}(?!\\d)(?:中|里|强调|建议|提到|提醒|指出)|(?:参考|参见|根据)\\s*${ref}(?!\\d))`).test(section.text))
    if(leaked.length)throw new Error(`正文泄露内部来源编号${leaked.join('、')}。请用自己的话连续教学，删除按卡逐篇转述的写法；真实来源由程序在每块末尾显示。保留合法after，不改变材料范围。`)
    if(fromMarkdown(section.text).children.some(node=>node.type==='heading'&&node.depth<=2))throw new Error('每块text不再包含H1/H2；大标题只在title字段，块内可用H3。')
  }
  return answer
}
/** Issued only AFTER compression. Every excerpt is a contiguous actual source string. */
export function citationCatalog(view:z.infer<typeof CardScopeSchema>) {
  return view.cards.map(card=>({ref:card.ref,title:card.title,excerpts:[card.title,...semanticChunks(card.content,1600,s=>s.length)].map((text,i)=>({ref:`E${i+1}`,text}))}))
}
export function attachComposition(scope:ReturnType<typeof readCardScope>, answer:Composition, catalog:ReturnType<typeof citationCatalog>, raw:unknown) {
  const {placements}=PlacementSchema.parse(normalizePlacements(raw))
  if(placements.length!==answer.sections.length)throw new Error('必须按顺序关联全部 P 段，每段一次')
  const conflicts=placements.flatMap(placement=>{
    const card=catalog.find(c=>c.ref===placement.after)
    const invalid=placement.evidenceRefs.filter(ref=>!card?.excerpts.some(e=>e.ref===ref))
    return invalid.length?[`${placement.section}: ${invalid.join(',')} 不在 ${placement.after} 中；只可选 ${card?.excerpts.map(e=>e.ref).join(',')??'本次实际 C 卡'}`]:[]
  })
  if(conflicts.length)throw new Error(`片段编号仅在该段 after 选择的卡内回查，不能使用该卡不存在的片段：${conflicts.join('；')}`)
  const operations=placements.map((placement,i)=>{
    const section=answer.sections[i]!
    if(placement.section!==`P${i+1}`)throw new Error('不得漏段、重复或改变 P 段顺序')
    if(placement.after!==section.after)throw new Error('段落父卡已由回答依据与正文冻结，关联片段不能改挂其他卡片')
    const card=catalog.find(c=>c.ref===placement.after)
    const evidence=placement.evidenceRefs.map(ref=>{
      const excerpt=card?.excerpts.find(e=>e.ref===ref)
      if(!excerpt)throw new Error(`${placement.section} 的 ${ref} 不在 ${placement.after} 中；可用编号：${card?.excerpts.map(e=>e.ref).join(",")??"无，after 必须来自本次 C 卡范围"}`)
      return excerpt.text
    })
    return {tool:'append_cards',...section,after:placement.after,evidence}
  })
  return resolveCardOperations(scope,{operations})
}
export const COMPOSE_PROMPT=`你是用户的老师刘看山，写一篇可以实际学会当前内容的连续讲解。
${CALCULATION_OUTPUT_RULE}
1. 教学任务：先读concept.learningSummary的核心、边界、路线衔接、资料关系；旧路线缺失才用description。以goalContext的用户原话和currentQuestion为准，所选卡决定实际材料范围。来源推荐与模型推断不能变成用户的新要求。当前是路线中的一个单元，learningSummary.boundary 中明确留到后面的内容，本次最多一句指出衔接，不展开其计算、定义或练习。来源覆盖更广不扩大当前单元；不写整门教材；前置节点存在不证明用户已经学过。
2. 教学组织：读完全部实际材料后，按“读者下一步需要理解什么”组织内容，不按文章/作者逐篇复述。一个适合用户基础的例子贯穿正文，每块推进新的必要操作或关系；讲清为什么、中间怎么做、怎样检验。新符号和局部基础就地解释。不要反复换一种说法重抄同一需求模板。每块须增加必要的新信息；缺少关键材料的简单问题，用一两块明确现有依据、缺口和最小补充项即可。后续追问直接解决本次问题，不重播首课。结尾不必再写总结；确需自检，只检验前文已经建立的步骤或量，不新添未经核算的对应关系。
3. 来源与准确性：逐条区分定义、来源观点和自拟教学例子，不能猜补来源缺失的公式，不能把自拟计算冒称作者案例。搜索摘要也可能包含错误，引用不等于正确。先核对其条件和已知定义，明显冲突或无法确认的细节不要作为教学定论；不能为了保留一句来源推荐而拼接出自相矛盾的操作。来源宣传须还原为有依据的适用条件；方法能提供可检查的步骤，不意味着保证结果。失败原因需要证据，不能一概归因用户。观察到一个现象只能列出符合证据的可能原因，不直接认定某一步做错；改变一个变量时，只能宣称由这个变化确实导致的结果，不把需要同时改变另一个条件的效果移植过来。定义必须涵盖其对象和范围，不能用某种常见效果代替定义。不规定用户审美，不把作者工作流程变成必须遵守的步骤。任何结论就地保留条件，不在末尾才推翻前文保证。
4. 输出：首次sourceReview逐卡记录贡献、重复或目标外内容；它是内部阅读记录，正文不复述它。sections按教学顺序，按问题复杂度用1–6块，最多answerBounds.maxCards；每块after来自输入C卡，title是一条H2标题的纯文本，blocks包含该块Markdown文字与就地运算（文字不再写H1/H2，可用H3）。引用主要论点必须由该after的材料支持，程序会在每块末尾显示真实来源。不在正文写C1/P1等内部编号，也不要用“某卡建议、C2强调”串起全文；直接把知识讲给用户。数学用完整LaTeX与正确JSON转义，代码用带语言围栏。只输出规定JSON，不输出数据库ID。
不要顺带补充未被问到且未完整论证的定理、判断标准或效果保证。不能把“部分必要条件已满足”写成“足以证明成立”。结论中的全称、存在、必要、充分和概率含义必须与依据一致；一个反例与若干支持例的证明作用不同。
涉及多项概念时，先确定一个最小对象及符号与位置的对应，然后全文复用；不要为了串联临时拼出更大的例子。数值相等不证明它们来自同一对象，解释中必须核对具体操作数、位置与定义。只写当前问题必需且已核实的关系；完成当前目标就结束，不追加另一个指标、定理或评判标准。sourceReview可以将不必要材料标为目标外，正文无需为每张来源单独写段落。
自拟教学情境的对象、原句、数量、结构和已知条件只定义一次，后文沿用同一份设定。不能为解释新的要点，声称该例子还有未提供的行、段、韵脚、动作、数据或时间。需要假设扩展时明确标明新增假设，并且不能拿新设定证明原设定已有的性质；不需要新增就不扩展。
输出前自行检查：这几块能否连着读懂同一问题；例子是否真正贯穿；每项必要步骤是否讲清；是否重复/超范围；事实、计算和条件是否一致。自查标准必须能由定义或计算推出，不能把概率上的常见情况写成每个样本都必须满足的条件；一般规律和个案观察分开，不把“常见”写成“必然”。说明随机变量与给定数值、精确等式与近似计算的区别。`
export const FIRST_LESSON_FOCUS=`请真正讲完当前一课。以concept.learningSummary和goalContext限定范围，围绕一个适合用户基础的例子、文本、情境或操作对象连续推进；解释问题从哪里来、关键步骤怎样做、为什么成立、如何在同一对象上核验及条件边界，不机械套标题。不只是建议、公式或知识清单，也不逐篇复述来源。
新符号和必要局部操作在首次使用时解释；综合步骤要有可跟随的中间过程。先在内部计算并检查数值、单位、维度、概率条件和精度，区分给定数据与随机量、精确与近似、关联与因果、个案与一般规律；条件随结论出现，不先保证效果最后再收回。读者只会什么就从那里衔接，不能把讲过、路线有前置或助手说过当成已经掌握。
同一例子在后文继续产生新的观察或结果；自拟例子明确为教学情境，不冒称作者实例或用户经历。不反复换例子、不重抄多套同义模板。观点比较按成立条件组织，审美可以有多个有效表达，决策需保留个人价值和未知；来源的宣传、流程和数字不是普遍事实。资料没给的公式、作品细节、现场事实或他人经历不能猜造；仍可解释已有依据和如何核实缺口，不把问题默认推给真人或要求付费。
只讲本课新内容，下一课整课不提前；结尾给一个局部自检和检查依据，不重做全文。块数服从当前单元，通常2–5块，简单问题可更短；不能为了段数加入下一课或重复练习，详细程度以能学会为准，不凑字数。每块after选择实际支持主要论点的一张材料卡；需要比较不同来源时分成各有直接依据的相邻段落，不拼到一个父卡，也不为分散编号强行引用。只输出sourceReview和sections，其中每段用blocks按顺序组织文字与就地运算，正文不出现C/P内部编号、阅读日志或编排术语。最后收窄：只选择直接解释本课核心的内容。若某个来源实例必须引入另一个指标或概念才能讲清，就不采用它，改用最小的自拟教学情境；来源阅读完整不等于其所有实例都进入课堂。真实数字缺少完整对象、比较基准或期限时，不搬入教学计算；不需要外部案例就能解释定义时，优先用可逐步核算的假设数值。用户没有给出具体工具、设备或环境版本时，只描述应观察的反馈和功能，不断言一定存在某个菜单、操作必定有效或能达到某种审美结果。`
export const COMPOSE_OUTPUT='{"sourceReview":[{"ref":"C1","contribution":"本次问题的主要依据"}],"sections":[{"after":"C1","title":"从这个例子开始","blocks":[{"kind":"text","text":"连贯讲解正文"}]}]}'

export const ATTACH_PROMPT='正文和每段的单父卡after已冻结。现在只在每个 P 段已有after对应的 citationCatalog 中，关联支撑主要论点的 1–6 个真实 evidenceRefs；after必须原样返回，不能改挂或混入其他卡。逐段检查实际材料，不能猜造引用，也不能用不支持正文的标题凑数。按原顺序返回每段一次，不重写 title/text，不增加内容，不引用范围外的卡。每张卡内部的片段从 E1 编号，E1 通常只是标题，正文片段从 E2 开始；evidenceRefs 只填写该卡内的 E 编号，不重复填写 C 前缀。例如 after=C2 且 evidenceRefs=[E2,E3] 时，程序只能引用 C2 卡内实际存在的第二、第三片段，绝不能解释成其他卡的 E2/E3。只返回 placements。'
export const ATTACH_OUTPUT='{"placements":[{"section":"P1","after":"C1","evidenceRefs":["E2"]}]}'

export const ANSWER_COMPLETENESS='当前 currentQuestion 是本次必须回答的请求，优先于旧 conceptAlignment.successCheck。用户明确问多个概念或操作时，例子须把它们连起来，不得只回答其中一个，再以“下次学习”推走其余部分。写作前在内部核对问题中的每项要求、用户已知与非目标；围绕一个对象或任务连续推进，避免换几个彼此无关的例子。一个贯穿的例子可以分成几张连续讲解卡，不等于把整篇放进一张卡。先给直接回应，接着在同一例子里逐步计算并解释，最后检查是否回答了原问题。每个结论用前文同一对象的已知定义或已算结果核对；若新例子、变量或位置出现，先重新计算，不能把旧结果移植过去。未被问到的基础只有在理解这个例子必需时才补，不凑概念百科。'

export function firstLessonFocus(context:Record<string,unknown>){
 const goal=context.goalContext as {rawGoal?:string;userStatements?:unknown;routeContext?:unknown}|undefined
 return FIRST_LESSON_FOCUS+'\n最后再次核对本次具体任务（不得被来源里的通用建议替换）：'+JSON.stringify({rawGoal:goal?.rawGoal,userStatements:goal?.userStatements,concept:context.concept,routeContext:goal?.routeContext,currentQuestion:context.currentQuestion})
}
