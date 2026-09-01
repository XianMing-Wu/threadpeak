import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

const app = await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
const session = await readFile(new URL('../src/pages/Session.tsx',import.meta.url),'utf8')
const chat = await readFile(new URL('../src/pages/Chat.tsx',import.meta.url),'utf8')
const authors = await readFile(new URL('../src/pages/Authors.tsx',import.meta.url),'utf8')
const canvas = await readFile(new URL('../src/pages/KnowledgeCanvas.tsx',import.meta.url),'utf8')

test('授权入口包裹九个 Hash 页面且非法 Hash 回落到首页',()=>{for(const id of ['home','chat','paths','path-3d','knowledge','knowledge-detail','session-learning','authors','settings'])assert.match(app,new RegExp(id));assert.match(app,/<AuthLanding/);assert.match(app,/routes\.has\(key\)\?key:'home'/)})
test('问题会话支持普通回答、路线澄清与相关图文三种入口',()=>{assert.match(chat,/resolveOrdinaryAnswer/);assert.match(chat,/OrdinaryAnswerUnavailable/);assert.match(chat,/ChatRoutePanel/);assert.match(chat,/resolveVisualAnswer/);assert.match(chat,/VisualAnswerUnavailable/);assert.match(chat,/followUp/);assert.doesNotMatch(chat,/DefaultAnswer|defaultAnswerMock|function VisualAnswer\b|selectVisualFrames/)})
test('明确意图可自动进入图文或博主模式',()=>{assert.match(session,/图\|可视化\|思维导图\|时间线/);assert.match(session,/博主\|作者/);assert.match(session,/mode\|\|detect\(value\)/)})
test('新对话清空当前会话并形成后续树分支入口',()=>{assert.match(session,/setTurns\(\[\]\)/);assert.match(session,/new-chat/)})
test('博主网络支持放大镜展开临时输入、扫描逐个显露和每次重新搜索',()=>{assert.match(authors,/openSearch/);assert.match(authors,/setSearchOpen\(true\)/);assert.match(authors,/startRadar/);assert.match(authors,/setSearchOpen\(false\)/);assert.match(authors,/setQuery\(''\)/);assert.match(authors,/setInterval/);assert.match(authors,/setRevealedCount/);assert.match(authors,/dynamicConcepts/);assert.match(authors,/setHovered/);assert.match(authors,/is-dimmed/);assert.match(authors,/>搜索博主</);assert.match(authors,/runAuthorGraphRag/);assert.doesNotMatch(authors,/changeGoal|changeView|hideAuthor|restoreHidden|setAuthorFeedback/)})
test('边序号是鼠标和键盘都可操作的按钮且弹层可关闭',()=>{assert.match(canvas,/role="button"/);assert.match(canvas,/event\.key==='Enter'/);assert.match(canvas,/查看第 \$\{edge\.label\} 条分支/);assert.match(canvas,/setReason\(edge\)/);assert.match(canvas,/setReason\(null\)/)})
test('知识脉络划选改为添加到对话和问博主并在节点右侧展开批注栏',()=>{assert.match(canvas,/SelectionToolbar/);assert.match(canvas,/AskAuthorsPrompt/);assert.match(canvas,/placement="node"/);assert.match(canvas,/AnnotatedText/);assert.doesNotMatch(canvas,/className="selection-quote"/)})
