import captured from './learning-content.json';

/** Presentation copy for one continuous demonstration; captured evidence stays intact. */
export const projectScenario = {
 goal: '做一个能连续追问的文档助手',
 question: '文档助手原型已经能检索资料、接住追问。我想请有同类项目经验的人评估试用边界，看看遗漏了哪些场景，听听真实上线时的取舍。',
 context: '作品已经跑通：带着测试记录，寻找外部评审与实战经验。',
 footprintQuestion: '文档助手接住了第二轮追问。历史由客户端管理还是交给接口保存，各有什么适用条件？',
 note: '### 把追问接进作品\n\n**目标**：做能查资料、能追问的求职助手。\n\n**选择**：先由应用管理历史，按角色顺序传入下一轮，便于检查与切换接口。\n\n$$\nT_{\\mathrm{in}} + T_{\\mathrm{out}} \\leq W\n$$\n\n**预算**：输入含指令、资料、历史与当前问题；按接口窗口，为输出留空间。\n\n**已验证**：连问两轮，核对历史与回复。\n\n**下一步**：继续完成检索、工具与评测。',
};

const answerPreviews: Record<number, {title:string; markdown:string}> = {
 4: {title:'为我的文档助手，接住第二轮追问',markdown:'### 在已有能力上，补上这一步\n\n已经会 Python 和 HTTP，就在同一个助手里实践：\n\n1. 保存上一轮问题与回复\n2. 把需要的历史连同追问传入\n3. 核对消息顺序与返回正文\n\n**本节检验**：先问“手册有什么用”，再问“那它能帮新同事做什么”，检查第二轮有没有收到前文。'},
 5: {title:'把“学懂了”，变成可验证的进展',markdown:'### 每一步，都回到我的作品里\n\n| 检查任务 | 要留下的证据 |\n| :--- | :--- |\n| 第一轮试答 | 请求与回复记录 |\n| 连续追问 | 实际传入的历史 |\n| 确认本节理解 | 说清角色、顺序与返回正文 |\n\n这一步验证调用与上下文；资料检索和多人试用，留到对应阶段继续验证。'},
};
const readingPreviews: Record<number,string> = {
 0:'### 先读“如何发出请求”\n\n复用已有 Python 基础，聚焦助手接入：\n\n1. 配置接口与密钥\n2. 组织职责和当前问题\n3. 读取模型返回的正文\n\n**用在作品里**：完成第一轮试答。',
 3:'### 请求不成功，先定位环节\n\n| 现象 | 先检查哪里 |\n| :--- | :--- |\n| 认证失败 | 凭据与权限 |\n| 连接失败 | 网络与地址 |\n| 请求限流 | 返回的限制信息 |\n\n**实践记录**：记录错误类别与耗时，避免记录密钥。',
 1:'### 对照请求，理解消息结构\n\n- `system`：助手的职责与边界\n- `user`：当前要解决的问题\n- `assistant`：已经给出的回复\n\n**带着问题读**：下一轮追问，需要补回哪些上下文？',
};
const replies = [
 {title:'让追问接上前文，先分清两个问题',markdown:'### 保存在哪里，与传入什么，是两件事\n\n对需要逐次提交消息的接口，应用应把所需历史按顺序放进下一次请求。仅把历史存进数据库，模型不会自动读到它。\n\n有些接口提供服务端会话状态；使用前要核对支持方式、保留期限与取回条件。\n\n**对我的作品**：先检查第二轮实际收到的消息，再决定历史由哪一层管理。'},
 {title:'把选择理由留在自己的卡片里',markdown:'### 用当前条件作选择\n\n| 做法 | 我需要考虑什么 |\n| :--- | :--- |\n| 应用管理历史 | 便于检查和切换接口；自己处理存储与裁剪 |\n| 接口保存状态 | 依赖接口能力；核对保留和迁移规则 |\n\n**当前选择**：先在应用中管理历史，用两轮问答验证。\n\n**继续查证**：看看公开实践中，这两种方式各适合什么情况。'},
];
const authorPreviews = [
 '### 观点一：核对历史是否真正送入\n\n这篇文章区分不同接口的历史传递方式，提醒读者：请求成功，不等于所需历史已经进入模型。\n\n**用在我的作品里**：检查第二轮实际提交的消息。\n\n**适用边界**：接口机制概览，具体支持需核对平台文档。',
 '### 观点二：选择时考虑接口切换\n\n文章比较客户端与服务端的历史管理责任，并讨论不同接口的兼容条件。\n\n**用在我的作品里**：若希望切换接口，应考虑会话状态如何迁移。\n\n**适用边界**：兼容情况随时间变化，不把旧表格当永久保证。',
 '### 观点三：保存之后，还有治理\n\n文章讨论会话归属、裁剪、过期与并发更新，说明保存历史只是工程设计的一部分。\n\n**用在后续阶段**：把这些条件列进试用检查。\n\n**适用边界**：这是架构检查线索，不是对我的项目作出的评审。',
];

const content = {
 ...captured,
 articles:captured.articles.map((a,i)=>readingPreviews[i]?{...a,markdown:readingPreviews[i]}:a),
 answers: captured.answers.map((a,i)=>answerPreviews[i]?{...a,...answerPreviews[i],text:answerPreviews[i].markdown}:a),
 followup: {...captured.followup,question:'第二轮追问已经跑通。如果历史由客户端管理，和交给接口保存相比，我该怎么选？',paragraphs:captured.followup.paragraphs.map((a,i)=>({...a,...replies[i],text:replies[i].markdown}))},
 authorFollowup: {...captured.authorFollowup,question:projectScenario.footprintQuestion,paragraphs:captured.authorFollowup.paragraphs.map((a,i)=>({...a,markdown:authorPreviews[i]}))},
};
export default content;
