import content from './learning-content.json';
import extraAuthors from './consultation-extra-authors.json';
import {projectScenario} from './learning-story-content';
// Editorial presentation of the saved public evidence. No fabricated search response,
// availability, private reply or new author identity is written into the product.
export const consultationQuestion=projectScenario.question;
const topics=['请求链路，核对上下文','会话状态，厘清责任','并发与归属，评审方案'];
const leads=['从请求记录，检查上下文。','对照作品设计，厘清状态归属。','从可用原型，走向试用评审。'];
const summaries=[
 '学习时曾参考这篇文章核对请求内容。现在可带上作品与测试记录，进一步确认作者是否愿意评估上下文设计。',
 '学习时曾借助这篇文章梳理会话管理责任。现在可对照作品的调用与存储链路，进一步请教不同方案的取舍。',
 '作品原型已经跑通，希望评估试用边界。这篇文章涉及会话归属、版本冲突和多实例更新，与当前评审需求相关。',
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
 provenance:'learning-evidence',ask:['希望请你结合脱敏请求记录，评估作品的上下文组织是否遗漏了重要场景。','希望结合我们的实际调用链，梳理应用、存储与模型接口各自负责的会话状态。','希望请你评估会话隔离与并发设计；如果你有类似项目的实践经验，也想了解上线前如何验证、如何确定试用范围。'][i],text:p.text,badge:'badge' in p.author?p.author.badge:'知乎内容作者',
}));
const furtherAngles=[
 {topic:'记忆写入，检查权限',lead:'沿着记忆读写，检查权限边界。',summary:'这篇文章提到在工具层控制权限、范围和审计。可据此请教：作品中记忆读写的权限与作用域是否清楚。',ask:'希望结合我们的记忆读写链路，请教权限和作用域应在哪一层约束，并共同检查错误信息的来源。'},
 {topic:'策略配置，对照试用样本',lead:'拿实际试用样本，检验策略。',summary:'作者公开了上下文策略的实现及局限。可带着两人交替使用的测试样本，请教如何观察画像、摘要和最近对话的加载。',ask:'希望带上测试样本与当前配置，请教如何观察画像、摘要和最近对话的加载过程，验证是否误用了其他会话的信息。'},
 {topic:'企业实践，核对作用域',lead:'对照企业实践，核对每层作用域。',summary:'文章展示了 Working、Session、User 和 Agent 的作用域与加载链路。可据此请教多层记忆如何隔离，以及实际项目中的验证方式。',ask:'希望结合我们的调用链和数据归属，请教各层记忆的隔离边界，以及类似工程在上线前如何验证。'},
];
export const consultationAuthors=[...learnedAuthors,...extraAuthors.map((a,i)=>({...a,...furtherAngles[i]}))];
export function consultationDraftFor(index:number,purpose='consult'){
 const a=consultationAuthors[index];
 return `${a.name}，你好！\n\n我在做一个能连续追问的文档助手。原型已能检索资料、接住追问，现在想进一步评估试用边界，补齐容易遗漏的场景。\n\n看到你的《${a.title}》。${a.ask}\n\n我可以先整理演示录屏、脱敏请求记录、部署结构，以及已通过和待验证的测试。\n\n${purpose==='invite'?'如果你有类似项目的实践经验，想邀请你分享处理过程，尤其是如何验证、权衡方案和决定试用范围。谢谢！':'请问你是否有类似问题的排查经验，是否愿意提供付费方案评审或实践交流？希望先确认范围、所需材料与费用，再约时间。谢谢！'}`;
}
