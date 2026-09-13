import content from './learning-content.json';
import extraAuthors from './consultation-extra-authors.json';
import {projectScenario} from './learning-story-content';
// Editorial presentation of the saved public evidence. No fabricated search response,
// availability, private reply or new author identity is written into the product.
export const consultationQuestion=projectScenario.question;
const topics=['请求链路，核对上下文','会话状态，厘清责任','并发与归属，评审方案'];
const leads=['带着失败请求，追查上下文。','对照真实链路，厘清状态归属。','把偶发故障，带到实战评审里。'];
const summaries=[
 '学习时曾参考这篇文章核对请求内容。现在可带上两人试用的失败记录，请教是否在调用模型前就混入了错误上下文。',
 '学习时曾借助这篇文章梳理会话管理责任。现在可对照实际调用与存储链路，请教问题发生在哪一层状态衔接。',
 '你已记录“单人正常、双人偶发串会话”。这篇文章涉及会话归属、版本冲突和多实例更新，是进一步请教隔离方案的相关线索。',
];
const quotes=[
 '忘不忘，取决于历史有没有被真正送进第二轮请求。',
 '谁管历史：你（客户端）',
 '把整个会话序列化成一个巨大 JSON，更新方便但并发冲突和网络开销会随历史增长。',
];
const limitations=[
 '文章主要介绍接口机制；具体平台的状态保留规则仍需单独核对。',
 '文章中的协议兼容情况有时间边界，具体支持以对应平台为准。',
 '先确认作者是否有相关排障经验、能否提供评审，再约定付费范围；文章相关不等于已确认接单。',
];
const learnedAuthors=content.authorFollowup.paragraphs.map((p,i)=>({
 id:p.author.id,name:p.author.name,avatar:p.author.avatar,evidenceId:p.author.evidenceId,
 title:p.title.replace(/\s*-\s*知乎$/,''),url:p.author.url,topic:topics[i],lead:leads[i],summary:summaries[i],quote:quotes[i],limitation:limitations[i],
 provenance:'learning-evidence',ask:['希望与你一起核对脱敏请求，判断上下文是否在调用模型前就混入了错误会话。','希望结合我们的实际调用链，梳理应用、存储与模型接口各自负责的会话状态。','希望结合脱敏日志和部署结构共同复现问题，也想了解你在类似项目中亲历的故障、取舍与上线验证过程。'][i],text:p.text,badge:'badge' in p.author?p.author.badge:'知乎内容作者',
}));
const furtherAngles=[
 {topic:'记忆写入，检查权限',lead:'沿着记忆读写，检查权限边界。',summary:'这篇文章提到在工具层控制权限、范围和审计。可据此请教：试用中的错误信息是否来自跨会话记忆的读写。',ask:'希望结合我们的记忆读写链路，请教权限和作用域应在哪一层约束，并共同检查错误信息的来源。'},
 {topic:'策略配置，对照失败样本',lead:'拿实际失败样本，检验策略。',summary:'作者公开了上下文策略的实现及局限。可带着两人交替使用的失败样本，请教如何观察画像、摘要和最近对话的加载。',ask:'希望带上失败样本与当前配置，请教如何观察画像、摘要和最近对话的加载过程，验证是否误用了其他会话的信息。'},
 {topic:'企业实践，核对作用域',lead:'对照企业实践，核对每层作用域。',summary:'文章展示了 Working、Session、User 和 Agent 的作用域与加载链路。可据此请教多层记忆如何隔离，以及实际项目中的验证方式。',ask:'希望结合我们的调用链和数据归属，请教各层记忆的隔离边界，以及类似工程在上线前如何验证。'},
];
export const consultationAuthors=[...learnedAuthors,...extraAuthors.map((a,i)=>({...a,...furtherAngles[i]}))];
export function consultationDraftFor(index:number,purpose='consult'){
 const a=consultationAuthors[index];
 return `${a.name}，你好！\n\n我在做一个能连续追问的文档助手。单人测试已跑通，但双人试用时偶发串会话；按 AI 建议修改了几版，问题仍会出现。\n\n看到你的《${a.title}》。${a.ask}\n\n我可以先整理失败录屏、脱敏请求链路、部署结构，以及试过但无效的改法。\n\n${purpose==='invite'?'如果你有类似项目的实践经验，想邀请你分享处理过程，尤其是如何复现、验证和决定上线范围。谢谢！':'请问你是否有类似问题的排查经验，是否愿意提供付费结对排查或方案评审？希望先确认范围、所需材料与费用，再约时间。谢谢！'}`;
}
