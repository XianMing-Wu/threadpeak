import {showcaseBlueprints,showcaseLesson,showcaseSourceCount} from '../showcase/catalog.ts'
import {showcaseRoute} from '../showcase/content.ts'
import { type CanvasEdge, type CanvasNode } from '../knowledge-canvas/content'
import { buildPathDocument } from '../pathDocument'
import { readableLayerTitle } from '../session/layer-title.ts'
import type {
  FirstLesson,
  KnowledgeGraph,
  KnowledgeRecord,
  PathCarrierSpec,
  RouteBlueprint,
  RouteRecord,
} from './types'

export const exampleBlueprints = showcaseBlueprints

export function documentFromBlueprint(blueprint: RouteBlueprint) {
  return buildPathDocument({id:blueprint.documentId,title:blueprint.title,description:blueprint.description,goalTitle:blueprint.goalTitle,goalSummary:blueprint.goalSummary,startSummary:blueprint.startSummary,carriers:blueprint.carriers,stages:blueprint.stages})
}

export function routeRecordFromBlueprint(blueprint: RouteBlueprint, extra?: Partial<RouteRecord>): RouteRecord {
  return {id:blueprint.id,owner:blueprint.owner,title:blueprint.title,summary:blueprint.summary,outcome:blueprint.outcome,duration:blueprint.duration,tags:blueprint.tags,icon:blueprint.icon,document:documentFromBlueprint(blueprint),conversationIds:[],knowledgeId:blueprint.owner==='example'?`knowledge-${blueprint.id}`:null,createdAt:0,...extra}
}

function cloneGraph(graph: KnowledgeGraph): KnowledgeGraph {
  return {
    nodes: graph.nodes.map((node) => ({ ...node, turns: node.turns.map((turn) => ({ ...turn, paragraphs: [...turn.paragraphs] })) })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  }
}

export function blueprintConcepts(blueprint: RouteBlueprint) {
  return blueprint.carriers.flatMap((carrier) => carrier.concepts.map(([id, title, summary]) => ({ id, title, summary, carrierId: carrier.id, carrierTitle: carrier.title })))
}

export function conceptAccent(blueprint: RouteBlueprint, conceptId: string) {
  const palette = blueprint.icon === 'brain'
    ? ['#5a4df8', '#1772f6', '#c28a2e', '#158f81']
    : blueprint.icon === 'layers'
      ? ['#1772f6', '#158f81', '#c28a2e', '#5a4df8']
      : ['#158f81', '#1772f6', '#c28a2e', '#5a4df8']
  const index = Math.max(0, blueprintConcepts(blueprint).findIndex((item) => item.id === conceptId))
  return palette[index % palette.length]
}

export function exampleConceptGraphs(blueprint: RouteBlueprint): Record<string, KnowledgeGraph> {
  const graphs: Record<string, KnowledgeGraph> = {}
  for (const concept of blueprintConcepts(blueprint)) {
    const lesson = showcaseLesson(blueprint.id, concept.id)
    if (!lesson) continue
    graphs[concept.id] = graphFromLesson(concept.title, lesson, conceptAccent(blueprint, concept.id))
  }
  return graphs
}

export function exampleKnowledgeRecord(blueprint: RouteBlueprint): KnowledgeRecord {
  const graphs = exampleConceptGraphs(blueprint)
  const seed = blueprint.carriers[0]?.concepts[0]?.[0] ?? 'root'
  const graph = graphs[seed] ?? { nodes: [], edges: [] }
  return {
    id: `knowledge-${blueprint.id}`,
    routeId: blueprint.id,
    owner: 'example',
    title: showcaseRoute(blueprint.id)?.knowledgeTitle ?? blueprint.title,
    description: blueprint.summary,
    icon: blueprint.icon,
    sources: showcaseSourceCount(blueprint.id),
    type: '知乎来源',
    seedConceptId: seed,
    graph: cloneGraph(graph),
    graphs,
    createdAt: 0,
    updatedAt: 0,
  }
}

export function findExampleBlueprint(id: string) {
  return exampleBlueprints.find((item) => item.id === id)
}

export function conceptTitle(blueprint: RouteBlueprint, conceptId: string) {
  for (const carrier of blueprint.carriers) {
    const hit = carrier.concepts.find(([id]) => id === conceptId)
    if (hit) return hit[1]
  }
  return conceptId
}

export function conceptCarrier(blueprint: RouteBlueprint, conceptId: string) {
  for (const carrier of blueprint.carriers) {
    if (carrier.concepts.some(([id]) => id === conceptId)) {
      return { id: carrier.id, title: readableLayerTitle(carrier.title) }
    }
  }
  return { id: '', title: '' }
}

export function conceptSummary(blueprint: RouteBlueprint, conceptId: string) {
  for (const carrier of blueprint.carriers) {
    const hit = carrier.concepts.find(([id]) => id === conceptId)
    if (hit) return hit[2]
  }
  return ''
}

export function firstConceptId(blueprint: RouteBlueprint) {
  return blueprint.carriers[0]?.concepts[0]?.[0] ?? ''
}

export function catalogLesson(routeId: string, conceptId: string): FirstLesson | undefined {
  if (exampleBlueprints.some((item) => item.id === routeId)) return showcaseLesson(routeId, conceptId)
  return undefined
}

function slugPart(text: string, fallback: string) {
  const compact = text.replace(/\s+/g, '').replace(/[^\u4e00-\u9fffA-Za-z0-9-]/g, '')
  if (!compact || compact.length < 2 || /^\d+$/.test(compact)) return fallback
  return compact.slice(0, 12)
}

export function draftMineBlueprint(query: string, choices: string[]): RouteBlueprint {
  const goal = query.replace(/^帮我|请|给我/, '').trim() || query
  const title = goal.length > 18 ? `${goal.slice(0, 18)}…` : goal
  const pace = choices[1] || '按你自己的节奏推进'
  const destination = choices[0] || '形成可以判断的理解'
  const id = `mine-${Date.now().toString(36)}`
  const prefix = id
  if (/线性|代数|矩阵|pca|机器学习数学/i.test(query)) {
    return {
      id,
      owner: 'mine',
      title: title.includes('路线') ? title : `${title}学习路线`,
      summary: `围绕“${goal}”，先建立向量与变换的几何语言，再接到可计算的数据方向。`,
      outcome: destination,
      duration: /8–10|集中/.test(pace) ? '约 3 周' : '约 5 周',
      tags: ['数学基础', '个性化'],
      icon: 'function',
      documentId: `${prefix}-doc`,
      description: `由“${goal}”生成的个性化数学路线，不复用示例路线文档。`,
      goalTitle: destination,
      goalSummary: `按“${pace}”推进，最终能用自己的话解释核心变换与降维。`,
      startSummary: '这条路线是刚生成的，知识脉络要等你第一次进入学习才会出现。',
      carriers: [
        { id: `${prefix}-c1`, title: '几何语言', summary: '先能解释向量、基和矩阵在做什么。', concepts: [[`${prefix}-vector`, '向量与基', `针对“${goal}”先建立可计算的方向语言`], [`${prefix}-map`, '变换动作', '把矩阵写成空间中的规则，而不是数字表']] },
        { id: `${prefix}-c2`, title: '结构与数据', summary: '从稳定方向走到数据里的主轴。', concepts: [[`${prefix}-kernel`, '压缩与保留', '看清哪些方向会消失'], [`${prefix}-axis`, '主轴选择', '用方差而不是感觉决定投影方向']] },
      ],
    }
  }
  if (/批判|论证|思维|反例|前提/i.test(query)) {
    return {
      id,
      owner: 'mine',
      title: title.includes('路线') ? title : `${title}学习路线`,
      summary: `围绕“${goal}”训练拆解结论、前提和证据的方法。`,
      outcome: destination,
      duration: '约 3 周',
      tags: ['通识', '个性化'],
      icon: 'brain',
      documentId: `${prefix}-doc`,
      description: `由“${goal}”生成的论证训练路线。`,
      goalTitle: destination,
      goalSummary: `按“${pace}”练习，直到能独立画出一篇长回答的论证骨架。`,
      startSummary: '路线已经落下；知识脉络仍要等第一次进入学习。',
      carriers: [
        { id: `${prefix}-c1`, title: '拆开观点', summary: '先分离结论和故事。', concepts: [[`${prefix}-claim`, '写出结论', `把“${goal}”里真正要判断的那句话单独列出`], [`${prefix}-premise`, '补上台阶', '找出跳过的隐含前提']] },
        { id: `${prefix}-c2`, title: '检验理由', summary: '给证据分级并寻找边界。', concepts: [[`${prefix}-evidence`, '证据分级', '区分例子、统计和可复核事实'], [`${prefix}-counter`, '画出边界', '构造让原结论失效的具体反例']] },
      ],
    }
  }
  if (/前端|react|组件|架构|浏览器/i.test(query)) {
    return {
      id,
      owner: 'mine',
      title: title.includes('路线') ? title : `${title}学习路线`,
      summary: `围绕“${goal}”连接浏览器机制、状态所有权和工程边界。`,
      outcome: destination,
      duration: '约 4 周',
      tags: ['前端', '个性化'],
      icon: 'layers',
      documentId: `${prefix}-doc`,
      description: `由“${goal}”生成的前端路径，不复用示例架构文档。`,
      goalTitle: destination,
      goalSummary: `按“${pace}”走完从渲染到发布的关键决策。`,
      startSummary: '先进入路线看载体；知识脉络会在第一次学习时生成。',
      carriers: [
        { id: `${prefix}-c1`, title: '运行时', summary: '从浏览器真实步骤开始。', concepts: [[`${prefix}-pipe`, '渲染顺序', `解释“${goal}”里页面变慢可能发生在哪一步`], [`${prefix}-comp`, '责任边界', '决定组件该知道什么、不该知道什么']] },
        { id: `${prefix}-c2`, title: '系统化', summary: '把能跑变成可维护。', concepts: [[`${prefix}-state`, '数据所有权', '只提升必须共享的事实'], [`${prefix}-ship`, '可回滚发布', '让一次上线可以退回']] },
      ],
    }
  }
  const topic = slugPart(goal, '')
  const routeTitle = goal.length >= 2 && !/^\d+$/.test(goal)
    ? (title.includes('路线') ? title : `${title}学习路线`)
    : '个性化学习路线'
  return {
    id,
    owner: 'mine',
    title: routeTitle,
    summary: `围绕“${goal}”，先确定达标状态，再只保留必要载体和最终概念。`,
    outcome: destination,
    duration: /8–10|集中/.test(pace) ? '约 2 周' : '约 4 周',
    tags: ['个性化', '目标导向'],
    icon: 'route',
    documentId: `${prefix}-doc`,
    description: `由目标“${goal}”生成的独立路线文档。`,
    goalTitle: destination,
    goalSummary: `按“${pace}”完成“${goal}”的可判定结果。`,
    startSummary: '这是新建路线。知识脉络不会在此刻生成。',
    carriers: [
      { id: `${prefix}-c1`, title: topic ? `${topic}基础` : '先立对象', summary: `先能解释“${goal}”里最容易被跳过的前提。`, concepts: [[`${prefix}-core`, topic ? `${topic}的核心对象` : '必须先命名的对象', `针对“${goal}”先命名必须理解的对象`], [`${prefix}-rule`, topic ? `${topic}的关键规则` : '判断对错的规则', '写出判断对错时真正用到的规则']] },
      { id: `${prefix}-c2`, title: topic ? `${topic}应用` : '落到一次产物', summary: '把理解落到一个可以完成的产物。', concepts: [[`${prefix}-use`, topic ? `${topic}的一次应用` : '一次最小应用', `用一个最小例子完成“${destination}”`], [`${prefix}-check`, topic ? `${topic}的回看` : '回看还缺什么', '检查哪些条件仍然不足，避免假装已经精通']] },
    ],
  }
}

function conceptKind(conceptId: string, title: string) {
  const token = `${conceptId}${title}`
  if (/-core$|核心对象|必须先命名/.test(token)) return 'core'
  if (/-rule$|关键规则|判断对错/.test(token)) return 'rule'
  if (/-use$|一次应用|最小应用/.test(token)) return 'use'
  if (/-check$|回看/.test(token)) return 'check'
  if (/-vector$|向量|基/.test(token)) return 'vector'
  if (/-map$|变换动作|线性变换/.test(token)) return 'map'
  if (/-kernel$|压缩/.test(token)) return 'kernel'
  if (/-axis$|主轴/.test(token)) return 'axis'
  if (/-claim$|写出结论|论点/.test(token)) return 'claim'
  if (/-premise$|前提|台阶/.test(token)) return 'premise'
  if (/-evidence$|证据/.test(token)) return 'evidence'
  if (/-counter$|反例|边界/.test(token)) return 'counter'
  if (/-pipe$|渲染/.test(token)) return 'pipe'
  if (/-comp$|责任边界|组件/.test(token)) return 'comp'
  if (/-state$|所有权|状态/.test(token)) return 'state'
  if (/-ship$|发布|回滚/.test(token)) return 'ship'
  return 'generic'
}

export function draftFirstLesson(blueprint: RouteBlueprint, conceptId: string): FirstLesson {
  const cataloged = catalogLesson(blueprint.id, conceptId)
  if (cataloged) return { ...cataloged, paragraphs: [...cataloged.paragraphs] }
  const title = conceptTitle(blueprint, conceptId)
  const summary = conceptSummary(blueprint, conceptId)
  const outcome = blueprint.outcome
  const routeTitle = blueprint.title
  const kind = conceptKind(conceptId, title)
  const lessons: Record<string, FirstLesson> = {
    core: {
      heading: `先给「${title}」起一个能抓住的名字`,
      paragraphs: [
        `进入「${routeTitle}」后，不要先堆材料。先问：这条路线里真正要处理的对象叫什么，它和日常口语里的同名事物差在哪里。`,
        summary || `针对当前目标，把必须理解的对象写成一句可以指认的话，而不是一个宽泛主题。`,
        `后面所有规则和应用，都建立在这个对象站得住的前提上。目标仍然是：${outcome}。`,
      ],
      quote: '先命名对象，再谈理解和材料。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    rule: {
      heading: `先写出「${title}」里那条会判对错的规则`,
      paragraphs: [
        `对象已经有了名字之后，关键不再是再收集定义，而是：什么情况下你能判断自己做对了。`,
        summary || '把判断对错时真正用到的那条规则单独写出来，不要把它藏在例子或口号里。',
        `这条规则要能服务「${routeTitle}」的达标状态：${outcome}。`,
      ],
      quote: '规则是判断，不是又一段解释。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    use: {
      heading: `用一次最小例子把「${title}」做完`,
      paragraphs: [
        `到这里不要继续加概念。选一个能在一页纸里做完的例子，把前面的对象和规则用进去。`,
        summary || `这个最小例子必须能让你看见“${outcome}”有没有发生，而不是只复述定义。`,
        `做完后只保留这个例子里真正用到的步骤，其余材料可以先放下。`,
      ],
      quote: '一次应用是检验，不是又一次阅读。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    check: {
      heading: `回看「${title}」：还缺哪一个条件`,
      paragraphs: [
        `现在把「${routeTitle}」当成已经走完一遍的草稿。问自己：哪一步仍然说不清楚，哪条规则还没有被例子碰到。`,
        summary || '回看不是复习清单，而是找出那个会让目标失败的缺口。',
        `如果缺口会阻止“${outcome}”，就只补这一处，不要重新铺一条新路线。`,
      ],
      quote: '回看是为了暴露缺口，不是为了假装已经精通。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    vector: {
      heading: `先把「${title}」看成可计算的方向`,
      paragraphs: [
        `在「${routeTitle}」里，向量和基不是画箭头的装饰，而是一套能相加、能数乘的语言。`,
        summary || '先选定一组最少方向，后面的矩阵才知道自己在对什么做动作。',
        `能用自己的话指出“哪个是基、哪个是坐标”，才继续往变换走。目标：${outcome}。`,
      ],
      quote: '基是描述空间的最小方向组。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    map: {
      heading: `把「${title}」写成空间中的动作`,
      paragraphs: [
        `矩阵在这条路线里不是数字表。它记录一个规则：每个向量被送到哪里。`,
        summary || '先看两列分别把两条基方向送到何处，再谈乘法步骤。',
        `这个动作视角，是后面压缩和主轴选择的共同入口。目标：${outcome}。`,
      ],
      quote: '矩阵是某个基下对变换的坐标写法。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    kernel: {
      heading: `先看见「${title}」里被压扁的方向`,
      paragraphs: [
        `有些方向变换后消失，有些方向还能到达。先把这两类分开，再谈信息损失。`,
        summary || '压缩不是错误，它是你准备丢掉哪些方向的决定。',
        `后面选主轴时，你其实是在有意识地选择压缩。目标：${outcome}。`,
      ],
      quote: '先看见消失的方向，公式才有几何意义。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    axis: {
      heading: `用变化最大的方向决定「${title}」`,
      paragraphs: [
        `主轴不是感觉上“重要”的轴，而是数据散得最开、最能区分样本的方向。`,
        summary || '用方差而不是直觉来排序方向，再决定留下几条。',
        `这一步把几何语言接到可计算的选择上。目标：${outcome}。`,
      ],
      quote: '主轴是算出来的，不是看起来顺眼的坐标。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    claim: {
      heading: `先把「${title}」写成一句能反对的话`,
      paragraphs: [
        `故事、态度和例子都先放下。作者到底要你接受哪一句判断？`,
        summary || '结论必须能单独被赞成或反驳，否则后面的证据都会飘。',
        `在「${routeTitle}」里，这一句就是后面所有拆解的锚点。目标：${outcome}。`,
      ],
      quote: '结论必须能单独被赞成或反驳。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    premise: {
      heading: `补上「${title}」里没写出来的台阶`,
      paragraphs: [
        `从例子直接跳到“你也应该如此”时，中间缺的那一级才是真正受力的地方。`,
        summary || '把隐含前提写出来后，争议往往不在故事，而在这个没说出口的假设。',
        `只补会改变结论的台阶。目标：${outcome}。`,
      ],
      quote: '隐含前提是论证真正受力的地方。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    evidence: {
      heading: `给「${title}」分级，而不是同等采信`,
      paragraphs: [
        `亲身经历、统计和权威名字强度不同，不能被当成同一种证明。`,
        summary || '问来源能否复核、样本是否匹配结论、有没有同样强度的反证。',
        `证据类型决定它最多能支持到哪一步。目标：${outcome}。`,
      ],
      quote: '证据的类型决定它最多能支持到哪一步。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    counter: {
      heading: `用一个具体反例画出「${title}」`,
      paragraphs: [
        `有效反例满足原论证的前提，却让结论失败。它不是抬杠。`,
        summary || '如果对方在这个情形里必须改口，你就找到了边界。',
        `边界清楚后，才知道原结论还能用到哪里。目标：${outcome}。`,
      ],
      quote: '反例用来画边界，不是用来赢吵架。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    pipe: {
      heading: `跟着浏览器走完「${title}」`,
      paragraphs: [
        `页面变慢很少是因为某一行 JSX 不够漂亮，而是解析、布局、绘制或合成出了问题。`,
        summary || '先指出卡顿可能发生在管线的哪一步，再谈框架调度。',
        `这一步是后面拆组件和谈性能的地面。目标：${outcome}。`,
      ],
      quote: '渲染管线是性能讨论的地面。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    comp: {
      heading: `先画清「${title}」，再增加组件数量`,
      paragraphs: [
        `拆得碎但边界乱，比拆得少更难改。先问这个单元因为什么而存在。`,
        summary || '它该不该知道路由、请求或全局用户信息，比它叫什么名字重要。',
        `责任清楚后，状态提升才有依据。目标：${outcome}。`,
      ],
      quote: '组件模型处理的是责任，不是文件数量。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    state: {
      heading: `先问「${title}」归谁，再选库`,
      paragraphs: [
        `能留在靠近界面的局部状态，就不要提升。共享只处理两处必须看到的同一份事实。`,
        summary || '选错放置位置，比选错 Redux 或 Context 更伤。',
        `所有权清楚，发布和回滚才不会把界面和数据绑死。目标：${outcome}。`,
      ],
      quote: '状态管理的第一问是所有权。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    ship: {
      heading: `把「${title}」当成系统的一部分`,
      paragraphs: [
        `一次可回滚的发布，比一次“全部重构完成”更接近工程。`,
        summary || '分层是为了让改动局部化，不是为了目录好看。',
        `能退回，目标「${outcome}」才站得住。`,
      ],
      quote: '工程化处理的是可回退的变化。',
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
    generic: {
      heading: `只从「${title}」这一步解释「${routeTitle}」`,
      paragraphs: [
        `这里不复用其他概念的讲稿。「${title}」要单独回答：它改变了你对问题的哪一个判断。`,
        summary || `先用自己的话复述「${title}」在这条路线里不可替代的作用。`,
        `如果去掉这一步仍能声称已经达到“${outcome}”，说明它还没有被真正理解。`,
      ],
      quote: `「${title}」必须能单独改变一个判断。`,
      placeholder: `围绕“${title}”继续提问，或选择上方模式深入理解…`,
    },
  }
  return lessons[kind]
}

export function graphFromLesson(conceptTitleText: string, lesson: FirstLesson, accent = '#158f81'): KnowledgeGraph {
  const root: CanvasNode = {
    id: 'root',
    accent,
    title: conceptTitleText,
    role: 'flow',
    turns: [{
      question: lesson.quote ? `为什么先抓住「${lesson.quote}」？` : `进入「${conceptTitleText}」时，首先要站住的是哪一句判断？`,
      replyKind: 'full',
      paragraphs: lesson.paragraphs,
      figure: lesson.figureCaption ? { caption: lesson.figureCaption } : undefined,
    }],
  }
  const edges: CanvasEdge[] = []
  return { nodes: [root], edges }
}

export function linkedRouteIntro(routeTitle: string, conversationOrdinal: number) {
  return `这是「${routeTitle}」下的第 ${conversationOrdinal} 段对话。路线本身不会重做，知识脉络也还是同一份；我们只是换一个入口继续问。`
}
