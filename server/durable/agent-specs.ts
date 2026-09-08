import {z} from 'zod'
import {CompositionSchema,COMPOSE_PROMPT,COMPOSE_OUTPUT} from '../knowledge/answer-composition.ts'
import {AGENT_PROMPTS,OUTPUT_STRUCTURE_TEXT} from '../agent-runtime/prompts.ts'
import {DEFAULT_MAX_OUTPUT_TOKENS} from '../agent-runtime/constants.ts'
import {GOAL_EXPLORATION_PROMPT,GOAL_EXPLORATION_OUTPUT} from '../path-generation/goal-exploration.ts'

// Only these route interview steps can use the shared shape parser. R4 has its
// own strict stage planner; removed G/A/L contracts are never dispatchable here.
export const ROUTE_STEP_SPECS={
 R1:{prompt:AGENT_PROMPTS.R1,output:OUTPUT_STRUCTURE_TEXT.R1,maxOutput:DEFAULT_MAX_OUTPUT_TOKENS.R1},
 R2:{prompt:GOAL_EXPLORATION_PROMPT,output:GOAL_EXPLORATION_OUTPUT,maxOutput:16384},
 R3:{prompt:AGENT_PROMPTS.R3,output:OUTPUT_STRUCTURE_TEXT.R3,maxOutput:DEFAULT_MAX_OUTPUT_TOKENS.R3},
 R3b:{prompt:AGENT_PROMPTS.R3b,output:OUTPUT_STRUCTURE_TEXT.R3b,maxOutput:DEFAULT_MAX_OUTPUT_TOKENS.R3b},
} as const
export type RouteStep=keyof typeof ROUTE_STEP_SPECS

export const LEARNING_TOOL_SPECS = {
  'L-search-plan': {
    prompt:'把当前概念改写为恰好三条检索问法；searchScope 指明知乎或全网范围：概念解释、具体应用、误区或不同观点。提供的 materials 是这条路线共同资料，请以其中和当前概念有关的范围理解用户目标；不能因为文件涉及其他内容就偏离当前概念。三个问法都必须围绕概念本身，不能扩展成其他学科或学习路线。每条不超过 200 字。不同表述用于找到不同文章，不承诺穷尽全站。只输出 JSON。',
    output:'{"queries":["问法一","问法二","问法三"]}',
    schema:z.object({queries:z.array(z.string().min(1).max(200)).length(3)}),
  },
  'L-source-select': {
    prompt:'逐条阅读全部检索候选的标题和完整 API 总结，只保留直接讲解目标概念、其应用、组成内容或误区的文章。仅提到同一学科、同名但不同含义或宽泛路线的条目应排除。只用输入 evidenceId，按相关度排列，去重。site/contentType/editedAt/authorityLevel/rankingScore/comments 是平台元数据，可辅助识别来源、时效及争议；赞同数和等级不等于观点正确，不凭人气取代概念相关性。没有合适材料时返回空数组。只输出 JSON。',
    output:'{"evidenceIds":["输入中的证据ID"]}',
    schema:z.object({evidenceIds:z.array(z.string())}),
  },
  'L-answer': {prompt:COMPOSE_PROMPT,output:COMPOSE_OUTPUT,schema:CompositionSchema},
  'A-card-plan': {
    prompt:'将用户针对当前卡片的问题改写成 2–3 条等价知乎检索问法，寻找能解答该问题的新博主。每条不超过 90 字。保持概念和真正疑问，不自行回答、不指定输入没有的人名。只输出 JSON。',
    output:'{"queries":["等价问法一","等价问法二"]}',
    schema:z.object({queries:z.array(z.string().trim().min(1).max(90)).min(2).max(3)}),
  },
  'A-card-select': {
    prompt:'从本次公开知乎文章候选中选择能够回答当前问题的 1–3 位不同的新作者。只返回对应 evidenceId，不复写作者名、链接或内容。排除输入 excludedAuthorIds 中的作者；不要因为不足三人而凑数。零合适时返回空 selections。normalizedQuestion 必须忠实保留用户问题。公开文章是已有观点，不能声称博主收到提问或亲自回复。只输出 JSON。',
    output:'{"normalizedQuestion":"原意不变的问题","selections":[{"evidenceId":"输入证据ID"}]}',
    schema:z.object({normalizedQuestion:z.string().min(1),selections:z.array(z.object({evidenceId:z.string()})).max(3)}),
  },
} as const
export type LearningTool = keyof typeof LEARNING_TOOL_SPECS
