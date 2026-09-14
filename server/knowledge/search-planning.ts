import {z} from 'zod'
import {settledParallel} from '../durable/worker.ts'

export const querySchema=(max:number)=>z.object({queries:z.array(z.string().trim().min(2).max(160)).min(2).max(max)}).strict().refine(v=>new Set(v.queries).size===v.queries.length,'搜索项不能重复')

/** A completed pair is a barrier: no request from the next pair starts early. */
export async function searchInPairs<T>(queries:readonly string[],search:(query:string,index:number)=>Promise<T>):Promise<T[]> {
  const results:T[]=[]
  for(let i=0;i<queries.length;i+=2)results.push(...await settledParallel(queries.slice(i,i+2).map((q,j)=>search(q,i+j))))
  return results
}

export const SEARCH_QUERY_GUIDANCE=`这是搜索引擎查询，不是让聊天模型回答的指令。每项先确定一个证据缺口，再保留标准对象名、决定相关性的情境和一个核心问题；一般15–45字，最多160字。自然问句与具体操作短语均可，不堆整份目标、数个问题或无关关键词，不加角色、格式、引用要求。
区分目标对象和条件：用户的设备、基础、可访问性与时间用于筛选可行内容，不能把这些条件误当成新主题。将口语映射为来源作者通用术语，但保留动作和条件。尚未确定对象时开放探索，不自行补零基础、职业或用途。结果需要新信息，所以相邻查询分别查解释、实例、症状、比较条件或真实代价，不能只换“如何/怎么”，也不机械加“争议/避坑”。需要真实经验就查具体动作、后续结果和适用处境，不能退成泛泛学习路线或名人推荐。没有理由预期对立就不制造两派。只输出当前任务JSON。`

export const LEARNING_SEARCH_PROMPT=`你为刘看山的首次概念教学寻找有用的知乎材料。先读concept.learningSummary四项教学总结（旧路线缺失时才参考description）、goalContext的真实目标与回答、conceptAlignment的用途/深度/资料锚点，以及routeContext中的载体和前后概念说明。当前概念总结决定本节边界；用户可能跳着进入，前置在路线里不等于已经学会。materials是实际路线资料，以其中相关片段的符号、例子、范围定位当前学习，不把整份材料扩大成当前一课。
生成2–6条互补搜索项，数量由本节需要决定，通常3–4条即可。按教会当前单元需要的顺序覆盖：建立概念直觉的解释、目标内可逐步完成的例子或推导、必要的局部前置、真正影响理解的方法差异/成立条件/误区。简单单元不凑满六条；没有相关争议不制造正反争论。已经选定路线的方法不重新搜索整套路线取舍；书课名只有在查该载体的具体内容时加入，不能让每项都被书课名限制。最终检验要求的关键操作要有查询覆盖，零基础不要直接跳到无前置的综合计算。
${SEARCH_QUERY_GUIDANCE}`

export const AUTHOR_SEARCH_PROMPT=`你为用户针对所选卡的当前疑问寻找博主已有的公开回答。先读question、host与当前conversation来理解指代、已尝试的方法和仍未解决的地方；对话中用户原话与助手讲解分开，不能假定讲过就已掌握。sourceContext仅解释宿主的原始出处，当前host可能是用户编辑副本，不冒充作者原话。再用goalContext、当前概念总结及路线说明消除指代歧义。当前问题优先，不把用户的整个学习目标当作这次问题，也不要仅因卡片标题相同就搜索宽泛入门课。
在内部判断用户想要解释因果、操作示例、排错、经验条件还是方法比较，以及问题中的“这/它”指什么。生成2–4条互补搜索项：至少一条正面查核心问题，其余换成具体症状、关键关系、适用条件或另一种作者常用表述；不要求同义重复，不预先给结论，不指定未提供的人名。保留影响答案的条件，搜索结果应能为这个具体问题贡献回答，即使只能解决其中一部分。
${SEARCH_QUERY_GUIDANCE}`
