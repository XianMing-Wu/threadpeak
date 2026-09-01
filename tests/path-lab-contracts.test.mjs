import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const html = await read('../path-lab.html')
const app = await read('../src/path-lab/App.tsx')
const session = await read('../src/path-lab/path-lab-session.ts')
const labMain = await read('../src/path-lab/main.tsx')
const input = await read('../src/path-lab/GoalInput.tsx')
const inputPolicy = await read('../src/path-lab/inputPolicy.ts')
const contracts = await read('../src/path-lab/contracts.ts')
const styles = await read('../src/path-lab/styles.css')
const path3d = await read('../src/components/Path3D.tsx')
const vite = await read('../vite.config.ts')

test('path-lab 是独立多入口且不装载产品侧栏或其他页面', () => {
  assert.match(html, /id="path-lab-root"/)
  assert.match(html, /src="\/src\/path-lab\/main\.tsx"/)
  assert.match(vite, /pathLabEntry/)
  assert.match(vite, /pathLab: pathLabEntry/)
  assert.doesNotMatch(app, /WideShell|ProductWorkspace|HomePage|SessionPage|SettingsPage|ChatPage/)
  assert.doesNotMatch(styles, /tp-sidebar|tp-history|settings-page|auth-landing/)
  assert.match(app, /lazy\(async \(\) =>/)
  assert.match(app, /import\('\.\.\/components\/Path3D'\)/)
  assert.doesNotMatch(app, /import \{ LearningPath3DView \} from/)
})

test('受控目标输入覆盖 Enter、Shift+Enter、IME、pending、abort 与安全错误', () => {
  assert.match(input, /value=\{value\}/)
  assert.match(input, /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/)
  assert.match(input, /shouldSubmitGoalFromKey\(\{/)
  assert.match(input, /composingRef\.current \|\| event\.nativeEvent\.isComposing/)
  assert.match(input, /keyCode: event\.nativeEvent\.keyCode/)
  assert.match(inputPolicy, /event\.keyCode !== 229/)
  assert.match(input, /onCompositionStart=\{startComposition\}/)
  assert.match(input, /onCompositionEnd=\{endComposition\}/)
  assert.match(input, /disabled=\{pending\}/)
  assert.match(input, /onClick=\{onAbort\}/)
  assert.match(input, /role="alert"/)
})

test('生成请求只发送 canonical raw_goal 与服务端标识的澄清答案，且密钥不进入 Vite', () => {
  assert.match(session, /PATH_LAB_GENERATE_URL = '\/api\/paths\/generate'/)
  assert.match(session, /requestJson\(/)
  assert.match(session, /JSON\.stringify\(\{ raw_goal: rawGoal, clarification_answers: answers \}\)/)
  assert.doesNotMatch(session, /JSON\.stringify\(\{ goal:/)
  assert.doesNotMatch(app, /fetch\(/)
  assert.match(labMain, /createPathLabSession/)
  assert.match(vite, /target: 'http:\/\/127\.0\.0\.1:4312'/)
  for (const source of [app, session, labMain, input, contracts, vite]) {
    assert.doesNotMatch(source, /import\.meta\.env|OPEN(?:CODE)?_?GO|ZHIHU_?API|API_?KEY/i)
  }
})

test('客户端只发布 renderer_document，diagnostics 是严格本地枚举 sidecar', () => {
  assert.match(contracts, /value\.renderer_document/)
  assert.match(contracts, /rendererDocument: value\.renderer_document/)
  assert.match(contracts, /export function projectDiagnostics\(value: unknown\)/)
  assert.match(contracts, /diagnostics: parseDiagnostics\(value\)/)
  assert.match(contracts, /typeof quality\.passed !== 'boolean'/)
  assert.match(contracts, /isFiniteNumber\(quality\.score, 0, 1\)/)
  assert.match(contracts, /isFiniteNumber\(trace\.total_duration_ms\)/)
  assert.match(contracts, /typeof trace\.degraded !== 'boolean'/)
  assert.match(contracts, /isSafeInteger\(trace\.provider_call_count\)/)
  assert.match(contracts, /QUALITY_ISSUE_LABELS/)
  assert.match(contracts, /DEGRADATION_LABELS/)
  assert.doesNotMatch(app + session + contracts, /JSON\.stringify\([^)]*diagnostic/i)
  assert.doesNotMatch(app + session + contracts, /payload\.(?:prompt|traceback|stack|quoted_text|content_text)/i)
})

test('未通过质量门禁的文档不会替换当前 3D 路径', () => {
  const gate = session.indexOf('result.diagnostics.passed !== true')
  const publish = session.indexOf('document: result.rendererDocument')
  assert.ok(gate >= 0 && publish > gate)
  assert.match(session, /质量门禁未通过/)
  assert.match(session, /上一版路径已保留/)
  assert.match(session.slice(gate, publish), /throw new PublicPathLabError/)
})

test('服务端错误只按本地枚举映射，不读取任意 detail/message', () => {
  assert.match(contracts, /SERVICE_ERROR_MESSAGES/)
  assert.match(contracts, /owns\(SERVICE_ERROR_MESSAGES, payload\.code\)/)
  assert.doesNotMatch(contracts, /payload\.(?:detail|message|explanation|path|safe_alternative)/)
  assert.doesNotMatch(contracts, /response\.text\(|payload\.traceback|payload\.stack/)
})

test('泛化 3D adapter 对新文档执行 dispose 后 remount，旧入口仍兼容', () => {
  assert.match(path3d, /export function LearningPath3DView/)
  assert.match(path3d, /document: LearningPathDocument/)
  assert.match(path3d, /mountLearningPath\(\{/)
  assert.match(path3d, /moduleRef\.current\?\.dispose\(\)/)
  assert.match(path3d, /\[document, instanceIdPrefix, nodeBadgeIconById, onContextualCardAction, onResourceNavigate\]/)
  assert.match(path3d, /if \(disposed\) \{\s*instance\.dispose\(\)/)
  assert.match(path3d, /new URL\('\.\.\/vendor\/learning-path-3d\/assets\/liu-kanshan-idle\.glb', import\.meta\.url\)\.href/)
  assert.match(path3d, /export function RealPath3D/)
  assert.match(path3d, /document=\{threadPeakPathDocument\}/)
})

test('实验台可见内容严格限于输入、状态、3D、证据与质量摘要', () => {
  for (const text of ['目标', '生成路径', '生成状态', '3D 知识脉络', '质量摘要', '概念与证据']) {
    assert.match(app + input, new RegExp(text))
  }
  assert.doesNotMatch(app + input, /首页|会话|设置|侧栏|登录|收藏|历史记录/)
})

test('实验台文字、操作热区和 360×800 适配使用严格可读门禁', () => {
  const fontSizes = [...styles.matchAll(/font-size:\s*(\d+)px/g)].map((match) => Number(match[1]))
  assert.ok(fontSizes.length > 0 && fontSizes.every((size) => size >= 12))
  assert.match(styles, /\.goal-input-actions button \{[^}]*height: 44px/)
  assert.match(styles, /\.path-lab-evidence article a \{[^}]*width: 44px; height: 44px/)
  assert.match(styles, /@media \(max-width: 420px\)/)
  assert.match(styles, /@media \(max-width: 900px\)/)
  assert.match(styles, /\.path-lab-input-panel \{[^}]*padding: 12px/)
  assert.match(styles, /height: max\(400px, 58svh\)/)
  assert.doesNotMatch(styles, /height: 560px/)
  assert.match(styles, /\.path-lab-canvas \[data-learning-path-root\] \.interaction-hint \{ font-size: 12px; \}/)
})
