import { z } from 'zod'
import { LearningGoalSchema } from '@threadpeak/contracts/learning-goal'
import type { SearchGroup } from '../agent-runtime/types.ts'

const text = z.string().trim().min(1).max(1600)
const refs = z.array(z.string().trim().min(1))
const materialRefs = z.array(z.string().regex(/^F[1-9]\d*$/))
const necessity = z.enum(['direct', 'prerequisite', 'optional'])
export const PerspectiveSchema = z.object({
  id: z.string().regex(/^P[1-9]\d*$/), advice: text, forWhom: text, conditions: text,
  tradeoffs: text, fitToGoal: text, basis: z.enum(['source', 'inference']),
}).strict()
export const CarrierSchema = z.object({
  id: z.string().regex(/^C[1-9]\d*$/), name: z.string().trim().min(1).max(150),
  kind: z.enum(['subject', 'course', 'book', 'resource']),
  identity: text, goalRole: text, scope: text, necessity, condition: text,
  basis: z.enum(['source', 'inference', 'user']),
  materialRefs, perspectiveRefs: refs,
}).strict()
export const CoverageSchema = z.object({
  boundary: text,
  excluded: z.array(z.object({ name: text, reason: text }).strict()),
  gaps: z.array(text),
}).strict()
export const CarrierDiscoverySchema = z.object({
  goalHypothesis: LearningGoalSchema,
  perspectives: z.array(PerspectiveSchema),
  carriers: z.array(CarrierSchema).min(1),
  decisionPoints: z.array(z.object({ uncertainty: text, whyItChangesRoute: text }).strict()),
  coverage: CoverageSchema,
}).strict()
const DisputeSchema = z.object({
  status: z.enum(['observed', 'not_observed', 'insufficient_evidence']),
  dimension: z.enum(['method', 'scope', 'sequence', 'carrier', 'conditions', 'experience', 'none']),
  reason: text, perspectiveRefs: refs,
}).strict()
export const CarrierExpansionSchema = z.object({
  carrierId: z.string().regex(/^C[1-9]\d*$/),
  catalogStatus: z.enum(['subject_inferred', 'source_supported', 'not_found', 'scope_limited']),
  catalogNote: text,
  concepts: z.array(z.object({
    id: z.string().regex(/^K[1-9]\d*$/), concept: text, purpose: text, depth: text, condition: text,
    necessity, materialRefs, perspectiveRefs: refs,
    contentBasis: z.enum(['subject_knowledge', 'source']),
    dispute: DisputeSchema,
  }).strict()),
  coverage: CoverageSchema,
}).strict()
export type CarrierDiscovery = z.infer<typeof CarrierDiscoverySchema>
export type Carrier = z.infer<typeof CarrierSchema>
export type CarrierExpansion = z.infer<typeof CarrierExpansionSchema>
export type ExpandedCarrier = Carrier & CarrierExpansion & { catalogSearchGroups: SearchGroup[] }
export type ExplorationInput = {
  goal: string; goalContext?: unknown; searchScope?: { kind: string }; searchQuestions?: unknown;
  searchGroups: SearchGroup[];
  attachments?: { ref?: string; sourceId: string; fileName: string; content: string; contentBasis?: string }[];
}
export type DiscoveryInput = Omit<ExplorationInput,'searchGroups'|'searchQuestions'> & { firstSearch:{summary:string} }
export type ExpansionInput = Omit<DiscoveryInput,'firstSearch'> & {
  carrier: Carrier; perspectives: CarrierDiscovery['perspectives']; catalogSearch:{summary:string};
  goalBoundary?: z.infer<typeof CoverageSchema>;
}
/** All API summaries in their original order, with only a newline inserted between them. */
export function mergeSearchSummaries(groups:SearchGroup[]):string{
  return groups.flatMap(group=>group.results.map(result=>result.summary)).join('\n')
}
function hasSourceContent(input:DiscoveryInput|ExpansionInput){
  return !!(('firstSearch'in input&&input.firstSearch.summary.trim())||('catalogSearch'in input&&input.catalogSearch.summary.trim())||(input.attachments??[]).some(a=>a.content.trim()))
}
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label} 不得重复`)
}
function checkExclusions(names:string[],excluded:{name:string}[]){
  const key=(s:string)=>s.split(/[（(]/u)[0]!.trim().replace(/(?:基础|入门|概述|简介)$/u,'').toLocaleLowerCase()
  const rejected=new Set(excluded.flatMap(e=>e.name.split(/[、，,]/u).map(key)))
  const conflict=names.find(name=>[...rejected].some(excluded=>excluded.length>=2&&(key(name)===excluded||key(name).startsWith(`${excluded}的`))))
  if(conflict)throw new Error(`${conflict} 不能同时列入保留内容和 coverage.excluded；按原始目标决定其去留，不得只删除排除说明来掩盖无关扩展`)
}
function checkRefs(values: string[], allowed: Set<string>, label: string) {
  if (values.some(v => !allowed.has(v))) throw new Error(`${label} 引用了不在本次输入中的 ID`)
  unique(values, label)
}
export function validateCarrierDiscovery(value: unknown, input: DiscoveryInput): CarrierDiscovery {
  const result = CarrierDiscoverySchema.parse(value)
  const intent=input.goalContext as {rawGoal?:string;userStatements?:{text:string}[]}|undefined
  const statements=[input.goal,intent?.rawGoal??'',...(intent?.userStatements??[]).map(s=>s.text)]
  for(const item of [result.goalHypothesis.motivation,result.goalHypothesis.startingPoint,...result.goalHypothesis.constraints,...result.goalHypothesis.nonGoals]){
    if(item&&!statements.some(s=>s.includes(item)))throw new Error('motivation、startingPoint、constraints、nonGoals 只能逐字摘取用户明确说过的内容，没有则留空；推测不要写入这些字段')
  }
  if(result.goalHypothesis.assumptions.length)throw new Error('assumptions 必须 []，未知的个人基础、时间和偏好只放 openQuestions')
  const files = new Set((input.attachments ?? []).map((_, i) => `F${i + 1}`))
  unique(result.perspectives.map(p => p.id), '观点 ID')
  unique(result.carriers.map(c => c.id), '载体 ID')
  unique(result.carriers.map(c => c.name.toLocaleLowerCase()), '载体名称')
  checkExclusions(result.carriers.map(c=>c.name),result.coverage.excluded)
  const ps = new Set(result.perspectives.map(p => p.id))
  for (const item of [...result.perspectives, ...result.carriers]) {
    if(item.basis==='source'&&!hasSourceContent(input))throw new Error('没有提供内容总结或附件，不能声称基于来源')
  }
  for (const c of result.carriers) {
    checkRefs(c.materialRefs, files, 'materialRefs')
    checkRefs(c.perspectiveRefs, ps, 'perspectiveRefs')
    if (c.basis === 'user' && !JSON.stringify({ goal: input.goal, goalContext: input.goalContext }).includes(c.name)) throw new Error('basis=user 的载体名称必须由用户明确说出')
  }
  return result
}
export function catalogQuery(carrier: Carrier): string | undefined {
  if (carrier.kind === 'subject') return undefined
  // Discovery includes known disambiguating author/edition information in the name.
  const query = `${carrier.name} ${carrier.kind === 'book' ? '目录 章节' : '课程目录 教学大纲 章节内容'}`
  if (query.length > 200) throw new Error('载体名称过长，无法完整构造目录搜索')
  return query
}
export function validateCarrierExpansion(value: unknown, input: ExpansionInput): CarrierExpansion {
  const result = CarrierExpansionSchema.parse(value), subject = input.carrier.kind === 'subject'
  if (result.carrierId !== input.carrier.id) throw new Error('只能展开本次 carrier.id')
  const files = new Set((input.attachments ?? []).map((_, i) => `F${i + 1}`))
  const ps = new Map(input.perspectives.map(p => [p.id, p]))
  unique(result.concepts.map(c => c.id), '载体内概念 ID')
  unique(result.concepts.map(c => c.concept), '载体内概念名称')
  checkExclusions(result.concepts.map(c=>c.concept),result.coverage.excluded)
  if(input.goalBoundary)checkExclusions(result.concepts.map(c=>c.concept),input.goalBoundary.excluded)
  if (!subject && result.catalogStatus === 'subject_inferred') throw new Error('具体课程/书籍不能用通用知识冒充目录')
  if (subject && result.catalogStatus !== 'subject_inferred') throw new Error('通用学科目录标记 subject_inferred，逐项说明内容依据')
  if (result.catalogStatus === 'scope_limited' && input.searchScope?.kind !== 'collections') throw new Error('只有限定资料范围才可标记 scope_limited')
  if (['not_found', 'scope_limited'].includes(result.catalogStatus) && result.concepts.length) throw new Error('无目录支持时保留缺口和空 concepts，不能编课程内容')
  if (result.catalogStatus === 'source_supported' && !result.concepts.length) throw new Error('source_supported 需要至少一个有来源支持的相关概念')
  if (!result.concepts.length && !result.coverage.gaps.length) throw new Error('空概念必须说明目录或目标关联缺口')
  for (const c of result.concepts) {
    checkRefs(c.materialRefs, files, 'materialRefs')
    checkRefs(c.perspectiveRefs, new Set(ps.keys()), 'perspectiveRefs')
    checkRefs(c.dispute.perspectiveRefs, new Set(ps.keys()), 'dispute.perspectiveRefs')
    if(!subject&&c.contentBasis!=='source')throw new Error('具体书课的内容只能由输入总结或附件支持，不能用学科常识伪造目录')
    if(c.contentBasis==='source'&&!hasSourceContent(input))throw new Error('source 内容需要本次输入提供总结或附件')
    if (c.dispute.status === 'observed') {
      if (c.dispute.dimension === 'none' || !c.dispute.perspectiveRefs.length) throw new Error('已观察到的争议必须说明差异维度并引用首轮观点')
      if (c.dispute.perspectiveRefs.some(ref => ps.get(ref)?.basis !== 'source')) throw new Error('概念争议只能由首轮真实来源观点支持，不能用模型推断冒充社区争议')
    } else if (c.dispute.dimension !== 'none' || c.dispute.perspectiveRefs.length) throw new Error('未观察到/证据不足时 dimension=none，争议引用为空；普通推荐可写外层 perspectiveRefs')
  }
  return result
}

export function assembleExploration(discovery: CarrierDiscovery, expansions: ExpandedCarrier[]) {
  if (discovery.carriers.length !== expansions.length || discovery.carriers.some((c, i) => expansions[i]?.carrierId !== c.id)) throw new Error('必须保留并按输入载体顺序合并全部展开结果')
  return {
    schemaVersion: 'goal-exploration-v3' as const,
    goalHypothesis: discovery.goalHypothesis, perspectives: discovery.perspectives,
    carriers: expansions, decisionPoints: discovery.decisionPoints, coverage: discovery.coverage,
    // Compatibility projection for R3/R4 and historical readers; never ask the LLM to duplicate this list.
    candidates: expansions.flatMap(carrier => carrier.concepts.map(c => ({
      id: `${carrier.id}/${c.id}`, carrierId: carrier.id, carrier: carrier.name, concept: c.concept,
      purpose: c.purpose, depth: c.depth, condition: c.condition, necessity: c.necessity,
      materialRefs: c.materialRefs, perspectiveRefs: c.perspectiveRefs,
      dispute: { ...c.dispute, exists: c.dispute.status === 'observed' },
    }))),
  }
}

export const CARRIER_DISCOVERY_PROMPT = `你执行 R2a：在首轮搜索后发现所有与用户目标有关的合理候选载体，并保留学习选择上的不同主张。此时不展开课程目录，不生成最终路线。
“穷尽”限定为对当前目标有用的候选。读完 firstSearch.summary 合并的全部内容总结与 attachments；不能只取热门/排名靠前来源。剔除无关结果，保留目标相关的不同实现方式、入门路径、资源替代与必要前置。不能为了凑数扩到完整专业培养方案，也不能为了最短路径提前只选一条。不要机械指定载体数量。
载体是可承载一组相关内容的学科、课程、书籍或具体资源。GAMES101、GAMES202 是 course；线性代数、微积分、概率论、数字信号处理是 subject；具体书籍是 book。某知识可以在不同上下文扮演不同层级：线性代数复习属于 GAMES101 的一部分，线性代数也可独立作载体。不要因名称相关就合并不同载体；也不要把每个知识点都提升成载体。
每个载体写 name、kind、identity（作者/授课者/版本；来源未说明就写未说明）、goalRole（对目标的具体用途）、scope（仅需涉及的内容范围）、necessity、condition（在哪条可行方式/何种待确认条件下有用）。necessity 只允许 direct（直接服务成果）、prerequisite（所选方式的必要前置）、optional（同一目标的其他可行方式），禁止 recommended、alternative 等其他值。optional 只能表示目标相关的条件分支，不能用来收留与目标无关的拓展。条件必须仍然达成原目标，不可用“如果想深入/进阶/感兴趣”偷偷换成更大的目标。例如写基础渲染器不需要完整游戏引擎、SVD 或可微渲染；相关大课程可取有用的局部，不能整课必学。用户点名但偏进阶的课程仍可列为待比较候选，scope 只保留本目标有用的部分，或在 excluded 说明为何不适用。C++ 等语言只在采用对应实现方式时必要，不能把某语言写成所有方式必需。
专门名称保留可检索的原名；若版本/作者是辨别同名书课所必需的信息，将已知信息也写进 name。未知信息不猜。AI辅助开发等学习方向可以作为 subject，不要编造名为“AI做网页教程”的特定课程。GitHub项目/互动教程属于 resource，只有明确是书的载体才是 book。
一般知识可补出搜索未提及但目标必需的学科候选，basis=inference。具体资源若来自常识也标 inference，后续必须查证目录。用户明确点名的载体可标 user。来源推荐标 source；source 表示基于本次总结的归纳，不表示服务端逐条查证了原文。知乎输入只有各条内容总结按换行合并的 firstSearch.summary，不含标题、作者字段、链接、评论、证据编号或分组元数据。不要要求这些字段，也不输出 sourceRefs/anchors/quote/excerptId。总结中本来出现的书课名、作者名或方法主张可以用于理解，但不得补造未提供的信息。保留原话目标，未知个人条件写 openQuestions。
争议在本产品中包含：不同实现方式、内容范围/深度、先后顺序、书课推荐、适用条件及使用经验。它可以是替代、互补或条件差异，不要求两派争吵。把与目标相关的不同建议逐条写 perspectives，保留 advice、forWhom、conditions、tradeoffs、fitToGoal。不能把某人推荐 A、另一人推荐 B 压成单一最优推荐，也不能把所有不同推荐说成互相反对。同一回答提供 A/B 两本书可任选，也是两种学习载体选择。forWhom、conditions、tradeoffs 只能概括来源明确说出的内容，没说就写“未说明”；尤其不能给可视化教材补“但不深入”、给基础路线补“但耗时长”、给实践路径补“缺乏严谨性”。你提出的条件或优缺点假设只能单独标 inference，不能混进 source 主张。首轮没有相关主张就留空，不造争议。
goalHypothesis 的 motivation、startingPoint、constraints、nonGoals 必须逐字摘取用户明确原话，没有则空串/空数组，不能推断用户不追求研究或有足够时间。assumptions 必须 []，未知个人信息只放 openQuestions；successCriteria 用目标成果检验，不能添加“读论文”等用户未要求的新成果，更不能把完成某门课当用户目标。
coverage.boundary 说明目标边界；excluded 每项只能有 name、reason（不是 carrier 字段），记录材料中出现但本目标无关的主要载体及理由；gaps 是字符串数组，记录证据缺口。decisionPoints 每项严格只有 uncertainty、whyItChangesRoute 两个字符串字段，禁止 options、question、id、affects；此时不设计访谈题。禁止输出最终节点、边、学习顺序或全专业目录。
通用学科候选不能只依赖书单：确保目标的核心知识关系有可展开的通用载体，不把核心内容全部寄托于尚未确认目录的一本书。书名与学科同名、且无法辨认具体作者版本时，优先按通用学科理解；不要把不同书目的作者拼在一起。identity 未由所选片段明确说明就写未说明。
从目标成果反查必要前置，不能只列搜索中的专业名词：若用户说从零，任何候选范围中用到的积分、复数、矩阵等，都应在相关通用载体内有可展开的基础范围，不得留成“基础未知所以不补”。例如从零完整理解二维傅里叶与卷积关联，连续推导需要微积分中的积分、二重积分与换元，复指数需要复数与三角函数，矩阵视角需要线性代数；概率论只有采用随机变量或噪声解释分支时取相关局部，不是全部必学。不能为了类比而要求完整SVD理论，也不能漏掉直接用于推导的积分。此处只写载体及scope，不展开概念清单。
搜索内容在讲解某个知识或使用某个例子，不自动等于作者推荐一种学习路线。只有明确的推荐、先后主张、书课选择或经验判断才标source观点；由讲解方式推得的学习方法标inference。未说明的取舍写“未说明”，不能复制输出示例里的说明性文字。
提交前最后检查目标边界：载体必须帮助达成用户原有成果。一个参考资源的相关章节可以有用，但“以后想进阶、深入研究、转向游戏引擎/着色器开发时”不是原目标的另一种实现方式，不能以这种 condition 入选。例如只想写基础渲染器时，GAMES104、Unity Shader、神经渲染等新目标方向应排除；用户点名的GAMES202可解释其定位，但只保留对当前目标有用的局部，找不到有用局部则排除并说明。不能同时把GAMES104等载体写进 carriers 和 excluded。不要替用户添加“学术论文/Windows游戏/商业项目”等成果，也不能把来源的“最好、必须、周末就能完成”不加归属地当客观结论。不因这些筛选丢掉同一目标的其他可行方法与资源。只输出指定 JSON。`

export const CARRIER_EXPANSION_PROMPT = `你执行 R2b。只输出当前 carrier 内、确实帮助达成用户原目标的概念。两个条件必须同时满足：属于此载体；服务原目标。不要把原目标扩展为更大的学习目标。
字段值对照（禁止混用）：catalogStatus 是载体目录状态，学科始终 subject_inferred；书课有依据为 source_supported；无依据为 not_found 或限定收藏的 scope_limited。contentBasis 是单个概念的内容依据，只能 subject_knowledge 或 source。catalogStatus 不能填 source；contentBasis 不能填 source_supported。输出示例已按当前载体类型选择。
1. 原始 goal/goalContext 优先。carrier.scope 是候选理解，可能过宽；goalBoundary.excluded 是已排除方向，必须遵守。每个概念写 purpose（具体用途）、depth（足够的理解或操作深度）、condition（同一目标的哪种实现方式下需要）、necessity=direct/prerequisite/optional。optional 也必须对原目标有用，不能表示以后想深入别的领域。
2. 层级相对载体定义。GAMES101 下可有“线性代数复习”；独立线性代数下才有“矩阵运算”“基与坐标”。Python语言载体只展开所需语法和库操作，不把光栅化、光照等整个图形学大纲移植进去。不同载体的同名概念各自保留，局部 id=K1、K2…；不生成最终路线或跨载体顺序。
3. subject 允许以通用知识补全，catalogStatus=subject_inferred，contentBasis=subject_knowledge。不能因主题相关就要求学完整微积分、概率论或信号与系统。每项都说明它具体支撑目标中的哪个关系或操作。
4. course/book/resource 只从 catalogSearch.summary 和附件明确描述当前载体的内容抽取。首轮总结已经形成 carrier 和 perspectives，本步不重复接收首轮检索原文。目录结果只有内容总结按换行合并，没有标题、作者、链接、评论或证据编号；不要要求或输出这些检索元数据，不编造 anchors/sourceRefs。依据总结文本中的实际内容辨认书课归属；单纯推荐一本书不等于给出了其目录，同文另一门课的内容不能移植过来。总结不能确认的目录写缺口，不能用记忆补成已核实的章节。例：仅说明“DFT、循环卷积”不能据此声称书内讲解“FFT算法”；只有一维内容不能补出二维章节。
5. 有部分相关内容依据：catalogStatus=source_supported，catalogNote 明确是搜索摘要支持的局部内容，不能声称已核实完整官方目录；未知部分写 coverage.gaps。完全没有可靠的相关内容归属：concepts=[]，catalogStatus=not_found，写具体缺口。collections 无可用目录时为 scope_limited，不外搜、不凭记忆伪造书课章节。
6. 对每个概念比较全部首轮 perspectives 中 basis=source 的学习建议，不限于 carrier.perspectiveRefs。争议指学习选择的差异，不要求数学结论存在冲突。不同方法、范围、顺序、书课推荐、条件和经验都可构成差异：status=observed，dimension=method/scope/sequence/carrier/conditions/experience，写清 reason 和 perspectiveRefs。
争议示例：P1说“傅里叶理论可选教材A或B”，当前概念是傅里叶变换或卷积定理，则标 observed/carrier，reason写“同一知识可选A或B两种教材，尚未比较各自适用条件”，引用[P1]即可；不能因为只有一个作者、或定理没有争议就标 not_observed。P2提出先学数学再理解卷积，P3提出结合图像实例理解卷积，则该概念可标 observed/method，保留[P2,P3]并说明两种方式可以互补，不编造互相反对。若本概念是教材A的无关章节，则不能套用傅里叶教材选择差异。仅有一个孤立推荐且没有其他替代、范围或方法差异时，外层 perspectiveRefs 保留该建议，dispute不自动标observed。
不把整门课评价复制到每个概念。无相关差异证据为 not_observed；证据不足为 insufficient_evidence；两者 dimension=none、争议 perspectiveRefs=[]，都不声称客观无争议。目录补搜不冒充首轮争议。不能用“首轮未见差异”模板跳过输入中已存在的同一知识多资源/多方式建议。
7. 外层 perspectiveRefs 可关联普通建议；materialRefs 仅真实附件 F 编号。coverage={boundary,excluded:[{name,reason}],gaps:[]}。概念不能同时保留和排除。用途、条件和限制写得具体，不写“全面掌握”“所有学习者必需”这类无边界要求。
范围示例一：目标是自己写基础渲染器，GAMES101目录有变换、光栅化、动画模拟。可保留变换和光栅化，动画模拟只放 excluded；不能以“简单了解/以后有兴趣/optional”保留。针孔相机可直接服务成像，整套透镜与光场不因此必需。
范围示例二：目标是理解二维傅里叶变换与二维卷积关联，书中有傅里叶变换、卷积、小波、图像压缩。只取有关傅里叶与卷积的内容，小波和图像压缩排除；可选的矩阵或图像直觉仍应解释同一个目标关系。不要为“更深入理解背后结构”加入解析函数、调和函数、势函数等新方向；它们不影响本目标的卷积定理理解。可用一张图像的滤波实验辅助观察该关系，但不引入“去噪与压缩”这一整个应用方向作为概念，也不要求掌握FFT优化算法才能理解卷积定理。若只搜到一维内容，不伪造书中存在二维章节。
排除项逐个写成明确知识名称，不把“二重积分”与无关的曲线曲面积分揉成一项后全部排除。二维连续变换与卷积的积分证明仍需二重积分；只排除不服务当前关系的技巧。
从零目标的学科范围应落实为可以进入学习的基础：微积分内保留所需的积分、二重积分、变量替换与交换积分条件；复数与三角函数内保留所需表示和复指数；线性代数内保留所需向量、矩阵和基。傅里叶与卷积的矩阵表达不要求另学SVD来做类比。每项仍受当前载体限制，不能把这些基础全部塞进任意载体。
不为数量而扩写，也不按固定数量截断。只输出指定 JSON。`

const goalExample = { outcome: '用户目标', motivation: '', successCriteria: ['可观察成果'], startingPoint: '', constraints: [], nonGoals: [], assumptions: [], openQuestions: [] }
export const CARRIER_DISCOVERY_OUTPUT = JSON.stringify({
  goalHypothesis: goalExample,
  perspectives: [{ id: 'P1', advice: '来源明确提出的学习建议', forWhom: '未说明', conditions: '未说明', tradeoffs: '未说明', fitToGoal: '该建议如何服务用户当前目标', basis: 'source' }],
  carriers: [{ id: 'C1', name: '线性代数', kind: 'subject', identity: '通用学科', goalRole: '支撑目标中的矩阵操作', scope: '只涉及目标中的表示与运算', necessity: 'prerequisite', condition: '需要理解数学关系时', basis: 'inference', materialRefs: [], perspectiveRefs: [] }],
  decisionPoints: [{uncertainty:'仍未知且会影响选择的条件',whyItChangesRoute:'将改变哪些范围或方式'}], coverage: { boundary: '目标范围', excluded: [{name:'与目标无关的候选名称',reason:'为何不是当前目标需要的内容'}], gaps: ['尚未得到的相关证据'] },
})
export const CARRIER_EXPANSION_OUTPUT = JSON.stringify({
  carrierId: 'C1', catalogStatus: 'subject_inferred', catalogNote: '根据通用学科知识展开，非查证的课程目录',
  concepts: [{ id: 'K1', concept: '矩阵及其运算', purpose: '解决目标中的具体障碍', depth: '能完成目标所需运算，不展开无关证明', condition: '该方法分支下需要', necessity: 'prerequisite', materialRefs: [], perspectiveRefs: [], contentBasis: 'subject_knowledge', dispute: { status: 'not_observed', dimension: 'none', reason: '首轮未见与本概念有关的选择差异', perspectiveRefs: [] } }],
  coverage: { boundary: '只保留目标需要的内容', excluded: [{name:'目录中但目标不需要的主题',reason:'不影响目标成果的理由'}], gaps: ['尚未能核实的目录部分；没有缺口则数组为空'] },
})

/** Only the format example changes with the carrier; this does not generate business concepts. */
export function carrierExpansionExample(carrier:Carrier):string{
  const value=JSON.parse(CARRIER_EXPANSION_OUTPUT)
  value.carrierId=carrier.id
  if(carrier.kind!=='subject'){
    value.catalogStatus='source_supported'
    value.catalogNote='示例：只有以下局部内容有来源支持；无依据时改为 not_found 和空 concepts'
    value.concepts[0].concept='当前载体内有来源支持且服务用户目标的概念名称'
    value.concepts[0].contentBasis='source'
  }
  return JSON.stringify(value)
}

/** Preserve all learning content; raw API records remain outside model context. */
export function explorationForPlanning<T>(value:T):T|unknown {
  const v=value as (Omit<ReturnType<typeof assembleExploration>,'schemaVersion'> & {schemaVersion:string;catalogSearchGroups?:unknown;conceptHints?:unknown})|undefined
  if(!v||!['goal-exploration-v3','goal-exploration-v4','goal-exploration-v5'].includes(v.schemaVersion))return value
  const {candidates:_projection,carriers,catalogSearchGroups:_rawGroups,conceptHints:_hints,...rest}=v
  return {...rest,carriers:carriers.map(({catalogSearchGroups:_raw,...carrier})=>carrier)}
}
