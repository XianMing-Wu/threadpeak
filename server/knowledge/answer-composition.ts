import {fromMarkdown} from 'mdast-util-from-markdown'
import { z } from 'zod'
import { semanticChunks } from '../agent-runtime/semantic-chunks.ts'
import { CardScopeSchema, readCardScope, resolveCardOperations } from './card-tools.ts'

const CardRef = z.string().regex(/^C[1-9]\d*$/)
export const CompositionSchema = z.object({
  sourceReview: z.array(z.object({ref:CardRef,contribution:z.string().trim().min(1).max(600)}).strict()).optional(),
  sections: z.array(z.object({after:CardRef,title:z.string().trim().min(1).max(300),text:z.string().trim().min(1).max(50000)}).strict()).min(1).max(12),
}).strict()
export type Composition = z.infer<typeof CompositionSchema>
export const PlacementSchema = z.object({placements:z.array(z.object({
  section:z.string().regex(/^P[1-9]\d*$/),after:CardRef,evidenceRefs:z.array(z.string().regex(/^C[1-9]\d*\.E[1-9]\d*$/)).min(1).max(6),
}).strict()).min(1).max(12)}).strict()
export function validateComposition(value:unknown, view:z.infer<typeof CardScopeSchema>, max:number, first:boolean) {
  const answer=CompositionSchema.parse(value)
  if(answer.sections.length>max)throw new Error(`正文最多 ${max} 段，请合并重复内容，不逐篇复述`)
  const refs=new Set(view.cards.map(c=>c.ref)),review=answer.sourceReview?.map(r=>r.ref)
  if(first&&!review||review&&(review.length!==refs.size||new Set(review).size!==refs.size||review.some(ref=>!refs.has(ref))))throw new Error('sourceReview 必须逐卡覆盖实际阅读范围，不能重复或越界')
  if(answer.sections.some(s=>!refs.has(s.after)))throw new Error('每段 after 必须来自本次 read_card_scope')
  for(const section of answer.sections){
    const leaked=[...refs].filter(ref=>new RegExp(`(?:${ref}(?!\\d)(?:中|里|强调|建议|提到|提醒|指出)|(?:参考|参见|根据)\\s*${ref}(?!\\d))`).test(section.text))
    if(leaked.length)throw new Error(`正文泄露内部来源编号${leaked.join('、')}。请用自己的话连续教学，删除按卡逐篇转述的写法；真实来源由程序在每块末尾显示。保留合法after，不改变材料范围。`)
    if(fromMarkdown(section.text).children.some(node=>node.type==='heading'&&node.depth<=2))throw new Error('每块text不再包含H1/H2；大标题只在title字段，块内可用H3。')
  }
  return answer
}
/** Issued only AFTER compression. Every excerpt is a contiguous actual source string. */
export function citationCatalog(view:z.infer<typeof CardScopeSchema>) {
  return view.cards.map(card=>({ref:card.ref,title:card.title,excerpts:[card.title,...semanticChunks(card.content,1600,s=>s.length)].map((text,i)=>({ref:`${card.ref}.E${i+1}`,text}))}))
}
export function attachComposition(scope:ReturnType<typeof readCardScope>, answer:Composition, catalog:ReturnType<typeof citationCatalog>, raw:unknown) {
  const {placements}=PlacementSchema.parse(raw)
  if(placements.length!==answer.sections.length)throw new Error('必须按顺序关联全部 P 段，每段一次')
  const conflicts=placements.flatMap(placement=>{
    const card=catalog.find(c=>c.ref===placement.after)
    const invalid=placement.evidenceRefs.filter(ref=>!card?.excerpts.some(e=>e.ref===ref))
    return invalid.length?[`${placement.section}: ${invalid.join(',')} 不在 ${placement.after} 中；只可选 ${card?.excerpts.map(e=>e.ref).join(',')??'本次实际 C 卡'}`]:[]
  })
  if(conflicts.length)throw new Error(`一次修正全部关联冲突，同一段所有 evidenceRefs 的 C 前缀必须等于 after：${conflicts.join('；')}`)
  const operations=placements.map((placement,i)=>{
    const section=answer.sections[i]!
    if(placement.section!==`P${i+1}`)throw new Error('不得漏段、重复或改变 P 段顺序')
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
1. 教学任务：先读concept.learningSummary的核心、边界、路线衔接、资料关系；旧路线缺失才用description。以goalContext的用户原话和currentQuestion为准，所选卡决定实际材料范围。来源推荐与模型推断不能变成用户的新要求。当前是路线中的一个单元，不写整门教材；前置节点存在不证明用户已经学过。
2. 教学组织：读完全部实际材料后，按“读者下一步需要理解什么”组织内容，不按文章/作者逐篇复述。一个适合用户基础的例子贯穿正文，每块推进新的必要操作或关系；讲清为什么、中间怎么做、怎样检验。新符号和局部基础就地解释。不要反复换一种说法重抄同一需求模板。后续追问直接解决本次问题，不重播首课。
3. 来源与准确性：逐条区分定义、来源观点和自拟教学例子，不能猜补来源缺失的公式，不能把自拟计算冒称作者案例。来源宣传须还原为有依据的适用条件。例如明确需求提供可核验的目标，并不保证AI理解或实现准确；意外修改可能来自共享样式、工具限制或模型行为，不能全部归咎用户。不规定用户审美，不把作者工作流程变成必须遵守的步骤。任何结论就地保留条件，不在末尾才推翻前文保证。
4. 输出：首次sourceReview逐卡记录贡献、重复或目标外内容；它是内部阅读记录，正文不复述它。sections按教学顺序，通常3–6块，最多answerBounds.maxCards；每块after来自输入C卡，title是一条H2标题的纯文本，text是该块Markdown正文（不再写H1/H2，可用H3）。引用主要论点必须由该after的材料支持，程序会在每块末尾显示真实来源。不在正文写C1/P1等内部编号，也不要用“某卡建议、C2强调”串起全文；直接把知识讲给用户。数学用完整LaTeX与正确JSON转义，代码用带语言围栏。只输出规定JSON，不输出数据库ID。
输出前自行检查：这几块能否连着读懂同一问题；例子是否真正贯穿；每项必要步骤是否讲清；是否重复/超范围；事实、计算和条件是否一致。自查标准必须能由定义或计算推出，不能把概率上的常见情况写成每个样本都必须满足的条件；随机样本落在均值一个标准差之外并不说明算错。说明随机变量与给定数值、精确等式与近似计算的区别。`
export const FIRST_LESSON_FOCUS=`现在请作为老师真正讲完当前一课，不能只列知识结论、建议或公式提纲。concept.learningSummary四项与goalAlignment限定本节范围；routeContext指出下节内容，不能提前把下节整课讲完，前一节点也不代表用户已掌握。
先挑一个能看出本课核心关系的具体例子，再按“遇到什么问题→一个关键操作→为什么起作用→在同一例子里核验→适用边界”自然推进。不要把这几个词机械当标题。开头出现的对象/数值必须在后文继续使用、产生新的可观察结果；不要先随便算一个数，随后换成无关抽象公式，最后再另起练习。材料中的实例若不合用户基础可自拟，但注明教学例子，不能假托作者。routeContext只证明路线位置；没有真实历史记录，不得声称“上一节我们已经算出”“继续上节的那个例子”或用户已做过某练习。可以说“这节需要用到的关系是”，并就地简要说明。
先在内部核算示例的数字和假设是否相容，再写给学生。优先选最少且好算的两个分数贯穿缩放比较，不另编一个不再使用的随机向量算例。缩放推导统一用S′=S/a与Var(S′)=Var(S)/a²，不把a同时当乘数与除数。自检若给的是固定向量，只计算点积和softmax；只有给出取值概率的随机变量才能要求计算分布方差。不要把0.88/0.12这种可见差异称作几乎全部/几乎没有或已饱和，直接比较数值即可。概率例子必须明确取值及其概率、独立性，不能凭直觉估算同时发生的概率；方差是平方偏差的平均，不等于绝对偏差的平均。每个关键跳步都拆开讲：符号第一次出现用普通话说明，读者尚不会的局部运算就地补足；数学要显示可复核的中间量及近似标记；初次手算示例通常保留两位小数即可，中间计算用未舍入值，最后才四舍五入，不把截位当四舍五入；E[X]首次出现说明它表示平均值或期望，不能拿四舍五入后的输入写成另一精度的等式。不是仅说“根据方差性质所以为1”，而要解释为什么除以a会让平方偏差除以a的平方；首次遇到平方根就用如“平方后等于4的正数是2”说明。只会四则运算的人不能被突然要求懂梯度、卡方分布、库API；当前总结未要求的旁支删掉。
条件在每条结论出现时保持，不能前文无条件保证、末尾才免责声明。局部缩放不能保证softmax不饱和；AI需求清楚也不能保证实现正确。用比较或检验展示实际作用，不写宣传承诺。讲相对关系必须比较多个对象：softmax看的是同一行分数之间的差异，不能只凭一个分数很大就判断饱和，也不能把同时加一个常数当成改变权重。展示缩放作用时对同一组至少两个分数给出缩放前后权重的可复核对照，再解释这不证明分布方差为1。方差推导的独立条件要说明是参与乘积的分量及各项间的理想化假设。Q、K是由输入和投影权重计算的表示，不是直接把它们称为训练参数。不要附带“某研究用了2.5倍”等未服务本节的旁支，即使随后说超出范围也应删除。
通常一课3–6块、足够的细节可能需要1200–2500汉字；这不是最低字数要求，简单单元可以短，但不能省略学会所需的解释。逐块衔接，最后只补一个新的局部自检，给检查依据，不重抄整课模板。每块after选择真正支持核心的来源；有可用的知乎解释时优先用相应文章作为依据，不默认把所有块都挂上传资料。上传资料决定范围，来源不足时仍据实标注，不能强配无关知乎引用。来源中的英文词汇表、工具版本和产品宣传不是本节的学习任务。零基础沟通课用页面上看得见的位置、文字、排列方式表达，不要求记hero/CTA/Container等词；用户没问模型选型就不列模型及多模态能力，截图是否可用只看当前工具有无图片输入。不要只说术语不是必须，随后仍列整张词汇表。正文不要出现C1/C2/P1内部编号；引用由程序显示。不要把作者流程照搬为必须步骤，例如一个改标题的动作通常不需要用户审批完整工程方案，也不要求不会代码者先读懂标签。位置可用页面文字或截图，未知字号不可猜为24px；具体数值若用于示例须声明假设且解释单位。说“这样给出了明确且可检查的目标”，不要说“AI越能精准/可以精确执行”。每一块推进新内容，不能先讲三要素，再讲五问题，再完整重抄同一模板。只输出sourceReview和sections JSON。`
export const COMPOSE_OUTPUT='{"sourceReview":[{"ref":"C1","contribution":"本次问题的主要依据"}],"sections":[{"after":"C1","title":"从这个例子开始","text":"连贯讲解正文"}]}'
export const ATTACH_PROMPT='正文已完成且冻结。现在为每个 P 段关联支撑主要论点的资料片段。先为该段主要论点选择一张有充分依据的 C 卡作为 after，再从该卡的 citationCatalog 中选择 1–6 个真实 evidenceRefs；同段不能混合其他卡。正文给出的 after 是建议，核对材料后可修正，不能机械沿用或轮换编号，也不能用不支持正文的标题凑数。逐段检查实际材料，不能猜造引用。按原顺序返回每段一次，不重写 title/text，不增加内容，不引用范围外的卡。输出前检查每一段所有 evidenceRefs 的 C 前缀都等于 after，例如 after=C2 时可以用 C2.E2、C2.E3，不能混入 C1.E2。只返回 placements。'
export const ATTACH_OUTPUT='{"placements":[{"section":"P1","after":"C1","evidenceRefs":["C1.E2"]}]}'

export const ANSWER_COMPLETENESS='当前 currentQuestion 是本次必须回答的请求，优先于旧 conceptAlignment.successCheck。用户明确问多个概念或操作时，例子须把它们连起来，不得只回答其中一个，再以“下次学习”推走其余部分。写作前在内部核对问题中的每项要求、用户已知与非目标；围绕一个对象或任务连续推进，避免换几个彼此无关的例子。一个贯穿的例子可以分成几张连续讲解卡，不等于把整篇放进一张卡。先给直接回应，接着在同一例子里逐步计算并解释，最后检查是否回答了原问题。未被问到的基础只有在理解这个例子必需时才补，不凑概念百科。'

export function firstLessonFocus(context:Record<string,unknown>){
 const goal=context.goalContext as {rawGoal?:string;userStatements?:unknown;routeContext?:unknown}|undefined
 return FIRST_LESSON_FOCUS+'\n最后再次核对本次具体任务（不得被来源里的通用建议替换）：'+JSON.stringify({rawGoal:goal?.rawGoal,userStatements:goal?.userStatements,concept:context.concept,routeContext:goal?.routeContext,currentQuestion:context.currentQuestion})
}
