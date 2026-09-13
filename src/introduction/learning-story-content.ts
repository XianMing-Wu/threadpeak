import captured from './learning-content.json';

/** Editorial demo scenario, separate from the captured provider/source evidence.
 * Real article titles, text, identity and URLs remain unchanged. These learning
 * steps illustrate a user's project; they are not a new provider execution.
 */
export const projectScenario = {
 goal: '做一个能连续追问的文档助手',
 question: '双人试用偶发串会话，AI 多次修改仍未解决。想请上线过同类系统的人结对排查，复盘亲历的取舍，评审上线边界。',
 context: '双人试用偶发串会话：带上脱敏日志，请行家共同排查。',
 footprintQuestion: '单人测试正常，双人试用却偶发串会话。AI 改了几版仍复现，下一步该查哪条链路？',
 note: '### 从“能回复”到“能试用”\n\n**我的目标**：文档助手能接住追问，也能区分不同用户。\n\n$$\nT_{\\mathrm{history}} + T_{\\mathrm{question}} + T_{\\mathrm{reply}} \\leq W\n$$\n\n**记住这个边界**：窗口限制回答能带多少上下文；它不负责隔离用户。\n\n**本次实践**：单人追问已跑通；双人试用仍偶发串会话。\n\n**请教前整理**：失败录屏、脱敏请求链路，以及试过但无效的改法。',
};

const answerPreviews: Record<number, {title:string; markdown:string}> = {
 4: {title:'为我的文档助手，接住第二轮追问',markdown:'### 只补上当前目标缺的这一步\n\n已经会 Python 和 HTTP，就直接在自己的助手里实践：\n\n1. 保存上一轮问答\n2. 把相关历史带入追问\n3. 对照实际请求，检查上下文\n\n**下一步验收**：先测连续追问，再测两人交替使用。'},
 5: {title:'把“学懂了”，变成可验证的进展',markdown:'### 每一步，都回到我的项目里验证\n\n| 检查任务 | 要留下的证据 |\n| :--- | :--- |\n| 第一轮试答 | 请求与回复记录 |\n| 连续追问 | 实际传入的历史 |\n| 双人试用 | 会话归属与失败链路 |\n\n哪里没通过，就从那张卡继续追问。'},
};
const readingPreviews: Record<number,string> = {
 0:'### 为这个目标，先读“如何发出请求”\n\n已经会 Python，跳过入门复习，聚焦助手接入：\n\n1. 配置接口与密钥\n2. 组织职责和当前问题\n3. 读取模型返回的正文\n\n**用在项目里**：完成第一轮试答。',
 3:'### 出错时，回到对应的检查步骤\n\n| 现象 | 先检查哪里 |\n| :--- | :--- |\n| 认证失败 | 凭据与权限 |\n| 连接失败 | 网络与地址 |\n| 请求限流 | 返回的限制信息 |\n\n**留下实践记录**：失败发生在哪一步，试过什么。',
 1:'### 对照我的请求，理解消息结构\n\n- `system`：助手的职责与边界\n- `user`：当前要解决的问题\n- `assistant`：已经给出的回复\n\n**带着问题读**：下一轮追问，需要补回哪些上下文？',
};
const replies = [
 {title:'单人跑通了，为什么双人试用会串会话？',markdown:'### 带着实践结果继续学\n\n**已完成**：单人连续追问正常。\n\n**卡住了**：两人同时试用，偶尔混入对方的上下文；AI 建议的改法仍未消除问题。\n\n**接下来**：整理失败链路，请上线过同类系统的人共同复现，结合亲历的故障评审隔离方案。'},
 {title:'把试过的办法，留成下一次排查的起点',markdown:'### 让每次尝试都接得上\n\n| 我的尝试 | 还没解决什么 |\n| :--- | :--- |\n| 分开两人的消息列表 | 并发时仍偶发异常 |\n| 核对请求里的会话 ID | 服务端读写链路待查 |\n| 按 AI 建议修改并重测 | 仍未找到稳定复现条件 |\n\n保留失败记录，请教时不用从头讲一遍。'},
];
const authorPreviews = [
 '### 请教切入点：请求里到底带了什么\n\n文章提醒：请求成功，不代表历史正确传入。\n\n**带上我的失败记录**，核对是否在调用前就混入了其他会话。\n\n**覆盖边界**：这篇资料不足以评审多实例存储。',
 '### 请教切入点：谁在维护这段会话\n\n文章对比客户端与服务端的历史管理责任。\n\n**对照我的调用与存储链路**，梳理状态在哪一层衔接。\n\n**覆盖边界**：实际并发行为需要现场复现。',
 '### 请教切入点：并发、归属与存储\n\n文章涉及会话归属、版本冲突和多实例更新。\n\n**最贴近当前卡点**：带着脱敏日志与部署结构，请教隔离和更新方案。\n\n先确认相关经验，再约定付费评审范围。',
];

const content = {
 ...captured,
 articles:captured.articles.map((a,i)=>readingPreviews[i]?{...a,markdown:readingPreviews[i]}:a),
 answers: captured.answers.map((a,i)=>answerPreviews[i]?{...a,...answerPreviews[i],text:answerPreviews[i].markdown}:a),
 followup: {...captured.followup,question:projectScenario.footprintQuestion,paragraphs:captured.followup.paragraphs.map((a,i)=>({...a,...replies[i],text:replies[i].markdown}))},
 authorFollowup: {...captured.authorFollowup,question:projectScenario.question,paragraphs:captured.authorFollowup.paragraphs.map((a,i)=>({...a,markdown:authorPreviews[i]}))},
};
export default content;
