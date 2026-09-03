import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

const app = await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
const session = await readFile(new URL('../src/pages/Session.tsx',import.meta.url),'utf8')
const chat = await readFile(new URL('../src/pages/Chat.tsx',import.meta.url),'utf8')
const authors = await readFile(new URL('../src/pages/Authors.tsx',import.meta.url),'utf8')
const canvas = await readFile(new URL('../src/pages/KnowledgeCanvas.tsx',import.meta.url),'utf8')

test('授权入口包裹 Hash 页面且非法 Hash 进入独立 404',()=>{for(const id of ['home','chat','paths','path-3d','knowledge','knowledge-detail','session-learning','authors','settings','not-found'])assert.match(app,new RegExp(id));assert.match(app,/<AuthLanding/);assert.match(app,/routes\.has\(key\)\?key:'not-found'/);assert.match(app,/NotFoundPage/)})
test('问题会话支持普通回答、路线澄清与相关图文三种入口',()=>{assert.match(chat,/resolveOrdinaryAnswer/);assert.match(chat,/OrdinaryAnswerUnavailable/);assert.match(chat,/ChatRoutePanel/);assert.match(chat,/resolveVisualAnswer/);assert.match(chat,/VisualAnswerUnavailable/);assert.match(chat,/followUp/);assert.match(chat,/resolveChatLaunch/);assert.doesNotMatch(chat,/DefaultAnswer|defaultAnswerMock|function VisualAnswer\b|selectVisualFrames|性价比高的显卡/)})
test('学习追问必须有问题且图文模式显式失败',()=>{assert.match(session,/resolveFollowUpHost/);assert.match(session,/requestFollowUp/);assert.match(session,/图文模式/);assert.match(session,/resolveVisualAnswer/)})
test('新对话清空当前会话并形成后续树分支入口',()=>{assert.match(session,/setTurns\(\[\]\)/);assert.match(session,/new-chat/)})
test('博主搜索支持放大镜展开临时输入、每次重新搜索，且搜索与网络缺 provider 显式失败',()=>{assert.match(authors,/openSearch/);assert.match(authors,/setSearchOpen\(true\)/);assert.match(authors,/submitSearch/);assert.match(authors,/setSearchOpen\(false\)/);assert.match(authors,/setQuery\(''\)/);assert.match(authors,/resolveAuthorSearch/);assert.match(authors,/AuthorSearchUnavailable/);assert.match(authors,/resolveAuthorNetwork/);assert.match(authors,/AuthorNetworkUnavailable/);assert.match(authors,/>搜索博主</);assert.match(authors,/>博主网络</);assert.match(authors,/AuthorNetworkGraph/);assert.match(authors,/projectAuthorNetworkGraph/);assert.doesNotMatch(authors,/useAuthorNetwork|hydrateNetworkFromAnnotations|runAuthorGraphRag|startRadar|setInterval|setRevealedCount|changeGoal|changeView|hideAuthor|restoreHidden|setAuthorFeedback/)})
test('边序号是鼠标和键盘都可操作的按钮且弹层可关闭',()=>{assert.match(canvas,/role="button"/);assert.match(canvas,/event\.key==='Enter'/);assert.match(canvas,/查看第 \$\{label\} 条分支/);assert.match(canvas,/setReason\(edge\)/);assert.match(canvas,/setReason\(null\)/)})
test('知识脉络划选改为添加到对话和问博主并在节点右侧展开批注栏',()=>{assert.match(canvas,/SelectionToolbar/);assert.match(canvas,/AskAuthorsPrompt/);assert.match(canvas,/placement="node"/);assert.match(canvas,/AnnotatedText/);assert.doesNotMatch(canvas,/className="selection-quote"/)})
test('从学习页进入画布时右上角是回到对话，从知识脉络进入不显示新对话',()=>{assert.match(canvas,/CanvasConversationAction/);assert.match(canvas,/<CanvasConversationAction routeId=\{knowledge\?\.routeId \?\? ''\} conceptId=\{conceptId \|\| ''\}\/>/);assert.doesNotMatch(canvas,/新对话/)})
