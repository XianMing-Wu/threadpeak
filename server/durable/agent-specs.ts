import {querySchema,LEARNING_SEARCH_PROMPT,AUTHOR_SEARCH_PROMPT} from '../knowledge/search-planning.ts'
import {z} from 'zod'
import {AUTHOR_EVIDENCE_GUIDANCE} from '../knowledge/author-evidence.ts'
import {CompositionSchema,COMPOSE_PROMPT,COMPOSE_OUTPUT} from '../knowledge/answer-composition.ts'
import {AGENT_PROMPTS,OUTPUT_STRUCTURE_TEXT} from '../agent-runtime/prompts.ts'
import {DEFAULT_MAX_OUTPUT_TOKENS} from '../agent-runtime/constants.ts'
import {CATALOG_NAMES_PROMPT,CATALOG_NAMES_OUTPUT,ROUTE_INTERVIEW_PROMPT,ROUTE_INTERVIEW_OUTPUT} from '../path-generation/direct-route.ts'

// Only these route interview steps can use the shared shape parser. R4 has its
// own strict stage planner; removed G/A/L contracts are never dispatchable here.
export const ROUTE_STEP_SPECS={
 R1:{prompt:AGENT_PROMPTS.R1,output:OUTPUT_STRUCTURE_TEXT.R1,maxOutput:DEFAULT_MAX_OUTPUT_TOKENS.R1},
 R2:{prompt:CATALOG_NAMES_PROMPT,output:CATALOG_NAMES_OUTPUT,maxOutput:1024},
 // R3 dispatch uses RouteInterviewSchema in routeInterview, never the legacy shared parser.
 R3:{prompt:ROUTE_INTERVIEW_PROMPT,output:ROUTE_INTERVIEW_OUTPUT,maxOutput:4096},
 R3b:{prompt:AGENT_PROMPTS.R3b,output:OUTPUT_STRUCTURE_TEXT.R3b,maxOutput:DEFAULT_MAX_OUTPUT_TOKENS.R3b},
} as const
export type RouteStep=keyof typeof ROUTE_STEP_SPECS

export const LEARNING_TOOL_SPECS = {
  'L-search-plan': {
    prompt:LEARNING_SEARCH_PROMPT,
    output:'{"queries":["建立本概念理解的具体问题","用于目标内实例的互补问题"]}',
    schema:querySchema(6),
  },
  'L-source-select': {
    prompt:'逐条阅读全部检索候选的标题和完整 API 总结，只保留直接讲解目标概念、其应用、组成内容或误区的文章。仅提到同一学科、同名但不同含义或宽泛路线的条目应排除。先按本概念的目标用途和所需深度筛选；宽泛资料只有其总结包含可直接使用的局部才保留，完整专业路线不因包含关键词入选。保留互补解释及有依据的不同条件，合并重复文章，不用多数意见排除相关的少数方法。选择组成一份可读学习材料集的互补文章，通常3–6篇，最多8篇；不是把所有沾边结果都收进来。重复讲同一要点只留更清楚的一篇，但保留目标相关的少数不同条件或反例。根据concept.learningSummary四项教学总结（旧路线才用description）、goalContext.routeContext的衔接和searchQueries的检索目的，按能构成一堂课的逻辑顺序排列：前文提供后文需要的解释或例子。来源不必逐篇成一段。只用输入 evidenceId，去重。site/contentType/editedAt/authorityLevel/rankingScore/comments 是平台元数据，可辅助识别来源、时效及争议；标题命中不等于总结有教学依据；数学只剩空白公式、跳步结论而无可解释信息时不要优先选择。明显错误或营销保证不能作为事实依据，有更清楚且条件完整的来源时优先。赞同数和等级不等于观点正确，不凭人气取代概念相关性。没有合适材料时返回空数组。只输出 JSON。',
    output:'{"evidenceIds":["输入中的证据ID"]}',
    schema:z.object({evidenceIds:z.array(z.string()).max(8)}),
  },
  'L-answer': {prompt:COMPOSE_PROMPT,output:COMPOSE_OUTPUT,schema:CompositionSchema},
  'A-card-plan': {
    prompt:AUTHOR_SEARCH_PROMPT,
    output:'{"queries":["当前疑问的核心问题","具体症状或关系的互补问法"]}',
    schema:querySchema(4),
  },
  'A-card-select': {
    prompt:'从本次公开知乎文章候选中选择能够回答当前问题的 1–3 位不同的新作者。只返回对应 evidenceId、reason、limitation，不复写作者名、链接或内容。排除输入 excludedAuthorIds 中的作者；不要因为不足三人而凑数。有候选时必须至少选择相对最能帮助当前问题的一位，最多三位。先按回答具体问题的程度、适用条件和可用例子判断，再考虑互补性；1–2位已经够用就不凑三位，第三位须带来不同的有用解释或条件，而不是重复相似工具推广文。不要仅因不能完整解答就全部丢弃。每位选一个最合适的文章 evidenceId，同一作者不能重复。reason具体说明该资料能帮助回答什么，不把来源经验写成效果保证，不声称适用于任何工具或任何人；limitation说明没有覆盖什么或条件哪里不同，完全适配可用空串，不能宣称部分匹配完整解答。normalizedQuestion 必须忠实保留用户问题。公开文章是已有观点，不能声称博主收到提问或亲自回复。结合当前conversation判断这次具体缺口，旧助手讲解不代表用户已经理解；sourceContext只用于区分原文与所选卡。只输出 JSON。'+AUTHOR_EVIDENCE_GUIDANCE,
    output:'{"normalizedQuestion":"原意不变的问题","selections":[{"evidenceId":"输入证据ID","reason":"能帮助解答什么","limitation":"缺口或空串"}]}',
    schema:z.object({normalizedQuestion:z.string().min(1),selections:z.array(z.object({evidenceId:z.string(),reason:z.string().trim().min(1).max(600),limitation:z.string().max(600)}).strict()).min(1).max(3)}),
  },
} as const
export type LearningTool = keyof typeof LEARNING_TOOL_SPECS
