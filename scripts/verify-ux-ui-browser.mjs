/** Local UX/UI regression. Requires an explicitly isolated QA server with test providers.
 * UX_QA_URL=http://127.0.0.1:4404 PLAYWRIGHT_MODULE=/path/to/playwright AXE_MODULE=/path/to/axe-core node scripts/verify-ux-ui-browser.mjs
 * Optional UX_QA_FILTER limits named cases; a filtered report is explicitly partial.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axePath = require.resolve(`${process.env.AXE_MODULE || 'axe-core'}/axe.min.js`)
const base = new URL(process.env.UX_QA_URL || 'http://127.0.0.1:4404/')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('UX QA must target a local isolated server.')
const directory = process.env.UX_QA_EVIDENCE || 'qa/evidence/ux-ui-2026-09-08'
const filter = process.env.UX_QA_FILTER ? new RegExp(process.env.UX_QA_FILTER) : null
const startedAt = new Date().toISOString()
const report = {
  startedAt, completedAt: null, url: base.href,
  scope: 'Local browser UX/UI only. Isolated QA API; explicit test providers; curated examples and synthetic author graph. No live-provider or production-readiness claim.',
  partial: Boolean(filter), filter: filter?.source ?? null,
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  checks: [], audits: [], screenshots: [], pageErrors: [], consoleErrors: [], expectedHttpErrors: [], failedRequests: [],
}
await mkdir(path.join(directory, 'screenshots'), { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist'] })
report.browserVersion = browser.version()
let activeCase = ''
const contexts = new Set()
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', ...options })
  contexts.add(ctx)
  ctx.on('page', page => {
    page.setDefaultTimeout(12000)
    page.on('response', response => { if (response.status() >= 400) report.failedRequests.push({ case: activeCase, url: response.url(), status: response.status(), requestBody: response.url().endsWith('/api/v2/sources/presentation') ? response.request().postData() : null }) })
    page.on('pageerror', error => report.pageErrors.push({ case: activeCase, url: page.url(), message: error.message }))
    page.on('console', message => {
      if (message.type() !== 'error') return
      const item = { case: activeCase, url: page.url(), message: message.text(), location: message.location() }
      if (activeCase.startsWith('library-error') && /503/.test(item.message)) report.expectedHttpErrors.push(item)
      else report.consoleErrors.push(item)
    })
  })
  return ctx
}
async function run(name, fn) {
  if (filter && !filter.test(name)) return
  activeCase = name
  const start = new Date().toISOString()
  try { const evidence = await fn(); report.checks.push({ name, passed: true, startedAt: start, completedAt: new Date().toISOString(), evidence }); console.log('UX_QA_PASS', name) }
  catch (error) { report.checks.push({ name, passed: false, startedAt: start, completedAt: new Date().toISOString(), error: error.stack }); console.log('UX_QA_FAIL', name, error.message) }
}
async function open(page, route) {
  await page.goto(new URL(`#${route}`, base).href)
  await page.locator('.tp-shell').waitFor()
  await page.locator('#main-content main, #main-content .lp-workspace, #main-content .au-page, #main-content .path3d-stage').first().waitFor()
  await settle(page)
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function shot(page, name) {
  await page.evaluate(async () => {
    const visible = [...document.images].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden' })
    await Promise.all(visible.map(image => image.complete ? Promise.resolve() : Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 5000))])))
  })
  await settle(page)
  const file = path.join(directory, 'screenshots', `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push({ name, file, at: new Date().toISOString(), viewport: page.viewportSize(), theme: await page.locator('html').getAttribute('data-theme'), url: page.url() })
}
async function audit(page, name) {
  await settle(page)
  await page.addScriptTag({ path: axePath })
  const a11y = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })
    return { violations: result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, failureSummary: n.failureSummary, any: n.any.map(c => ({ id: c.id, data: c.data, message: c.message })) })) })), incomplete: result.incomplete.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), passes: result.passes.length, axeVersion: result.testEngine.version }
  })
  const layout = await page.evaluate(() => {
    const viewportWidth = innerWidth
    const visible = e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 }
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map(e => ({ tag: e.tagName, text: e.textContent, color: getComputedStyle(e).color, textFillColor: getComputedStyle(e).webkitTextFillColor, fontSize: getComputedStyle(e).fontSize, background: getComputedStyle(e).backgroundColor }))
    const tinyText = [...document.querySelectorAll('button,p,small,label,input,textarea,a,span')].filter(e => visible(e) && !e.closest('.katex,.tp-math') && e.textContent?.trim() && [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11.9).slice(0, 30).map(e => ({ class: e.className, tag: e.tagName, text: e.textContent.slice(0, 80), fontSize: getComputedStyle(e).fontSize }))
    const panels = ['.tp-panel', '.lp-body', '.settings-page', '.peak-market', '.knowledge-library', '.au-page'].flatMap(selector => [...document.querySelectorAll(selector)].filter(visible).map(e => ({ selector, width: e.clientWidth, scrollWidth: e.scrollWidth, horizontalOverflow: e.scrollWidth > e.clientWidth + 1 })))
    return { viewportWidth, bodyWidth: document.body.scrollWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > viewportWidth + 1, headings, tinyText, panels }
  })
  const blockers = a11y.violations.filter(v => ['serious', 'critical'].includes(v.impact))
  const item = { name, at: new Date().toISOString(), url: page.url(), viewport: page.viewportSize(), theme: await page.locator('html').getAttribute('data-theme'), ...a11y, layout, passed: blockers.length === 0 && !layout.horizontalOverflow && !layout.panels.some(p => p.horizontalOverflow) }
  report.audits.push(item)
  await shot(page, name)
  item.images = await page.locator('img').evaluateAll(es => es.map(e => ({ src: e.getAttribute('src'), currentSrc: e.currentSrc, naturalWidth: e.naturalWidth, renderedWidth: e.getBoundingClientRect().width, complete: e.complete })))
  return item
}
async function enterExample(page) {
  await open(page, 'knowledge?tab=example')
  await page.locator('.grid > li button, .knowledge-shelf-track .knowledge-book').first().click()
  await page.locator('.lp-example-note').waitFor()
  await page.locator('.lp-graph-card').first().waitFor()
}
try {
  await run('home-motion-and-input', async () => {
    const ctx = await context(); const page = await ctx.newPage(); await open(page, 'home')
    assert.equal(await page.getByRole('textbox', { name: '输入你的学习目标', exact: true }).count(), 1)
    assert.ok(await page.getByRole('heading', { level: 1 }).innerText())
    assert.equal(await page.locator('.home-coverflow').count(), 2)
    assert.ok(await page.locator('.home-coverflow').first().locator('.cf-card').count() >= 5)
    assert.equal(await page.locator('.home-curation-note').count(), 1)
    const track = page.locator('.suggestion-track'); await page.mouse.move(2, 2)
    const before = await track.evaluate(e => getComputedStyle(e).transform)
    await page.waitForFunction(value => getComputedStyle(document.querySelector('.suggestion-track')).transform !== value, before)
    await page.locator('.suggestion-marquee').hover(); assert.equal(await track.evaluate(e => getComputedStyle(e).animationPlayState), 'paused')
    assert.equal(await page.getByRole('button', { name: '暂停流动', exact: true }).count(), 0)
    await page.locator('.suggestion-marquee').hover()
    await page.locator('.suggestion-group').first().getByRole('button').first().click()
    const textarea = page.getByRole('textbox', { name: '输入你的学习目标', exact: true })
    assert.ok((await textarea.inputValue()).length > 0); assert.ok(await textarea.evaluate(e => e === document.activeElement)); assert.equal(new URL(page.url()).hash, '#home')
    await ctx.close(); return { normalMotion: true, hoverPause: true, pauseButtonRemoved: true, prefillFocusWithoutSend: true, sharedCoverflow: true }
  })
  await run('theme-system-manual-persistence', async () => {
    const ctx = await context({ colorScheme: 'dark' }); const page = await ctx.newPage(); await open(page, 'settings')
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    assert.equal(await page.evaluate(() => localStorage.getItem('threadpeak-theme')), null)
    await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
    await page.getByRole('switch', { name: '夜间模式', exact: true }).click()
    assert.equal(await page.evaluate(() => localStorage.getItem('threadpeak-theme')), 'dark')
    await page.reload(); await page.getByRole('heading', { name: '设置', exact: true }).waitFor()
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    await page.emulateMedia({ colorScheme: 'light' }); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    await ctx.close(); return { systemDefault: true, followsSystemWithoutPreference: true, manualOverrideSurvivesReload: true }
  })
  await run('settings-native-dialog-focus', async () => {
    const ctx = await context(); const page = await ctx.newPage(); await open(page, 'settings')
    const opener = page.getByRole('button', { name: '清空', exact: true }); await opener.click()
    const dialog = page.getByRole('dialog', { name: '清空本地历史？', exact: true }); await dialog.waitFor()
    assert.equal(await dialog.evaluate(e => e.tagName), 'DIALOG')
    assert.ok(await dialog.getByRole('button', { name: '取消', exact: true }).evaluate(e => document.activeElement === e))
    assert.ok(await dialog.evaluate(e => e.matches(':modal')))
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(e => e.contains(document.activeElement) || document.activeElement === document.body)) }
    await audit(page, 'settings-dialog-light-desktop')
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.ok(await opener.evaluate(e => e === document.activeElement))
    await ctx.close(); return { nativeModal: true, initialCancelFocus: true, tabContainment: true, escapeDismissal: true, openerRestored: true }
  })
  for (const pageKind of ['knowledge', 'paths']) await run(`library-error-${pageKind}`, async () => {
    const ctx = await context(); let fail = true; let attempts = 0
    await ctx.route('**/api/v2/library', route => { attempts++; return fail ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'QA_UNAVAILABLE', message: '本地验收：读取暂时不可用' }) }) : route.continue() })
    const page = await ctx.newPage(); await open(page, pageKind)
    await page.getByRole('searchbox').fill('QA_RETRY_QUERY')
    const title = pageKind === 'paths' ? '暂时无法读取路线' : '暂时无法读取你的知识脉络'
    await page.getByRole('heading', { name: title, exact: true }).waitFor(); await audit(page, `${pageKind}-error-light-desktop`)
    fail = false; await page.getByRole('button', { name: '重新连接', exact: true }).click()
    await page.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'hidden' })
    assert.ok(attempts >= 2); await ctx.close(); return { explicitError: title, retryRecovered: true, attempts }
  })
  await run('market-search-clear-example-labels', async () => {
    const ctx = await context(); const page = await ctx.newPage()
    for (const route of ['knowledge?tab=example', 'paths?tab=example']) {
      await open(page, route); const original = await page.locator('.grid > li, .knowledge-shelf-track .knowledge-book-slot').count(); assert.ok(original > 0)
      if (route.startsWith('knowledge')) {
        assert.equal(await page.getByRole('button', { name: '示例知识脉络', exact: true }).count(), 0)
        assert.ok(await page.locator('.knowledge-shelf-origin').count() > 0)
      } else assert.ok(await page.locator('.grid > li').first().innerText().then(text => text.includes('示例')))
      await page.getByRole('searchbox').fill('QA_No_Such_Content_9472')
      await page.getByRole('heading', { name: '没有找到匹配内容', exact: true }).waitFor()
      await page.getByRole('button', { name: '清空搜索', exact: true }).click(); assert.equal(await page.locator('.grid > li, .knowledge-shelf-track .knowledge-book-slot').count(), original)
    }
    await ctx.close(); return { searchEmptyAndClear: true, curatedLabels: true }
  })
  await run('example-edit-new-conversation-source-boundary', async () => {
    const ctx = await context(); const page = await ctx.newPage(); await enterExample(page)
    const count = await page.locator('.lp-graph-card').count()
    await page.getByRole('button', { name: '研究', exact: true }).click(); const articleCount = await page.locator('.lp-article-card').count(); assert.ok(articleCount > 0)
    await page.locator('.lp-article-main').first().click(); await page.getByText('查看原始摘要', { exact: true }).click()
    const originalSummary = await page.locator('.tp-source-reading details').innerText(); assert.ok(originalSummary.length > 80)
    await page.getByRole('button', { name: '知识脉络', exact: true }).last().click(); await page.getByRole('button', { name: '文档模式', exact: true }).click()
    const editor = page.getByRole('button', { name: /^编辑文档内容：/ }).last(); const label = await editor.getAttribute('aria-label'); const editTitle = label.replace('编辑文档内容：', ''); const editId = await editor.evaluate(e => e.closest('[data-doc-id]').dataset.docId)
    await editor.click(); await page.getByRole('textbox', { name: `文档内容：${editTitle}`, exact: true }).fill('浏览器验收笔记：让编辑可恢复，保留原文。')
    await page.locator('.lp-doc-view').getByRole('heading').first().click()
    await page.waitForFunction(id => Object.keys(sessionStorage).filter(k => k.startsWith('tp-example-learning-v2:')).some(k => JSON.parse(sessionStorage.getItem(k)).nodes.some(n => n.id === id && n.text === '浏览器验收笔记：让编辑可恢复，保留原文。')), editId)
    const saved = await page.evaluate(() => { const key = Object.keys(sessionStorage).find(k => k.startsWith('tp-example-learning-v2:')); return { key, data: JSON.parse(sessionStorage.getItem(key)) } })
    await page.reload(); await page.locator('.lp-example-note').waitFor()
    const restored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), saved.key); assert.deepEqual(restored, saved.data)
    await page.getByRole('button', { name: '新对话', exact: true }).click()
    const fresh = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), saved.key)
    assert.equal(fresh.nodes.length, count); assert.deepEqual(fresh.nodes, restored.nodes); assert.deepEqual(fresh.articles, restored.articles); assert.deepEqual(fresh.goalContext, restored.goalContext)
    assert.equal(fresh.conversations.find(c => c.id === fresh.active).messages.length, 0); assert.equal(fresh.conversations.length, restored.conversations.length + 1)
    await page.getByRole('button', { name: '研究', exact: true }).click(); await page.locator('.lp-article-main').first().click(); await page.getByText('查看原始摘要', { exact: true }).click()
    assert.equal(await page.locator('.tp-source-reading details').innerText(), originalSummary)
    await ctx.close(); return { count, articleCount, editId, editRestored: true, originalSummaryUnchanged: true, newConversationPreservesTreeArticlesGoal: true }
  })
  await run('reduced-motion-home-and-author-graph', async () => {
    const ctx = await context({ reducedMotion: 'reduce' }); const page = await ctx.newPage(); await open(page, 'home')
    const motion = await page.locator('.suggestion-track').evaluate(e => ({ name: getComputedStyle(e).animationName, duration: getComputedStyle(e).animationDuration, iterations: getComputedStyle(e).animationIterationCount }))
    assert.ok(motion.name === 'none' || (parseFloat(motion.duration) <= .001 && motion.iterations === '1'))
    await page.goto(new URL('/qa/ux-ui-lab.html', base).href); await page.getByRole('heading', { name: '作者图键盘验收' }).waitFor()
    const svg = page.getByRole('group', { name: '博主与知识的关系图', exact: true }); await svg.focus(); await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-id')), 'carrier:qa')
    await page.keyboard.press('Enter'); assert.equal(await page.locator('#qa-selected').innerText(), 'carrier:qa')
    assert.equal(await page.locator('circle[data-id="carrier:qa"]').getAttribute('aria-pressed'), 'true')
    const before = await page.locator('svg > g').getAttribute('transform'); await svg.focus(); await page.keyboard.press('ArrowRight'); const panned = await page.locator('svg > g').getAttribute('transform'); assert.notEqual(panned, before)
    await page.keyboard.press('+'); const zoomed = await page.locator('svg > g').getAttribute('transform'); assert.notEqual(zoomed, panned)
    await page.keyboard.press('0'); const reset = await page.locator('svg > g').getAttribute('transform'); assert.notEqual(reset, zoomed)
    const audits = [await audit(page, 'author-graph-keyboard-light')]
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' }); audits.push(await audit(page, 'author-graph-keyboard-dark'))
    await ctx.close(); return { motion, keyboardSelect: true, panZoomReset: true, audits: audits.map(a => a.name) }
  })
  await run('route-3d-return', async () => {
    const ctx = await context(); const page = await ctx.newPage(); await open(page, 'paths?tab=example')
    await page.locator('.grid > li button, .knowledge-shelf-track .knowledge-book').first().click(); await page.locator('canvas').waitFor()
    await page.getByText('从这里出发 · 点击任意圆台查看', { exact: true }).waitFor({ timeout: 30000 })
    assert.equal(await page.locator('.path3d-error').count(), 0); assert.ok(await page.getByRole('heading', { level: 1 }).count() > 0)
    await audit(page, 'route-3d-light-desktop'); await page.getByRole('button', { name: /^(返回上一级|返回路线列表)$/, exact: true }).click(); assert.equal(new URL(page.url()).hash, '#paths?tab=example')
    await ctx.close(); return { actualWebGLLoaded: true, h1: true, returnsToExampleRouteList: true }
  })
  for (const theme of ['light', 'dark']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 800, height: 515 }, { width: 390, height: 780 }, { width: 320, height: 720 }]) await run(`matrix-${theme}-${viewport.width}`, async () => {
    const ctx = await context({ viewport, colorScheme: theme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const names = []
    for (const route of ['home', 'knowledge?tab=example', 'paths?tab=example', 'authors', 'settings', 'does-not-exist']) {
      await open(page, route); const name = `${route.split('?')[0]}-${theme}-${viewport.width}`; names.push(name); await audit(page, name)
      if (route.startsWith('knowledge?') || route.startsWith('paths?')) {
        const market = page.locator('.peak-market, .knowledge-library')
        assert.equal(await market.evaluate(e => getComputedStyle(e).overflowY), 'auto')
        await market.hover(); await page.mouse.wheel(0, 100000)
        await page.waitForFunction(() => { const e = document.querySelector('.peak-market, .knowledge-library'); return e.scrollTop >= e.scrollHeight - e.clientHeight - 1 })
        const bottom = await market.evaluate(e => ({ scrollTop: e.scrollTop, lastCardVisible: e.querySelector('.grid li:last-child, .knowledge-shelf:last-child').getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom + 1 }))
        assert.ok(bottom.lastCardVisible); report.audits.at(-1).listScroll = bottom
        await shot(page, `${name}-bottom`)
      }
      if (route === 'home') {
        const composerControls = await page.locator('.home .composer-bar button').evaluateAll(es => es.filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(), p = e.closest('.composer').getBoundingClientRect(); return { label: e.getAttribute('aria-label') || e.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, inside: r.left >= p.left && r.right <= p.right + 1 && r.top >= p.top && r.bottom <= p.bottom + 1 } }));
        assert.ok(composerControls.every(c => c.inside), `Home composer controls must stay in its border: ${JSON.stringify(composerControls)}`); report.audits.at(-1).composerControls = composerControls
        const cards = await page.locator('.home-coverflow .cf-card').evaluateAll(es => es.map(e => ({ className: e.className, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })));
        assert.ok(cards.every(c => c.width >= 40 && c.height >= 100), `Home cover geometry must remain readable: ${JSON.stringify(cards)}`); report.audits.at(-1).homeCardGeometry = cards
        const homeScroll = await page.locator('.home-body').evaluate(e => { e.scrollTop = e.scrollHeight; return { clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, scrollTop: e.scrollTop } });
        await shot(page, `${name}-bottom`); report.audits.at(-1).homeScroll = homeScroll
      }
    }
    await enterExample(page)
    for (const view of ['graph', 'research', 'document']) {
      if (view === 'research') await page.getByRole('button', { name: '研究', exact: true }).click()
      if (view === 'document') { await page.getByRole('button', { name: '知识脉络', exact: true }).last().click(); await page.getByRole('button', { name: '文档模式', exact: true }).click() }
      const name = `learning-${view}-${theme}-${viewport.width}`; names.push(name); await audit(page, name)
      if (view === 'graph') {
        await page.locator('.lp-node[data-node-id]').last().focus(); await page.keyboard.press('Space'); await page.locator('.lp-map-toolbar').waitFor()
        const toolbar = await page.locator('.lp-map-toolbar').evaluate(e => { const a = e.getBoundingClientRect(), b = e.closest('.lp-graph-stage').getBoundingClientRect(); return { left: a.left, right: a.right, top: a.top, bottom: a.bottom, inside: a.left >= b.left && a.right <= b.right + 1 && a.top >= b.top && a.bottom <= b.bottom + 1, scrollLeft: e.closest('.lp-graph-stage').scrollLeft } })
        assert.ok(toolbar.inside, `Selected card toolbar is clipped: ${JSON.stringify(toolbar)}`); assert.equal(toolbar.scrollLeft, 0); report.audits.at(-1).selectedToolbar = toolbar
        await page.locator('.lp-map-toolbar').getByRole('button', { name: '询问 AI', exact: true }).click(); await page.locator('.lp-node-prompt-layer').waitFor(); await settle(page)
        const prompt = await page.locator('.lp-node-prompt-layer').evaluate(e => { const a = e.getBoundingClientRect(), b = e.closest('.lp-graph-stage').getBoundingClientRect(); return { inside: a.left >= b.left && a.right <= b.right + 1 && a.top >= b.top && a.bottom <= b.bottom + 1, width: a.width, height: a.height } })
        assert.ok(prompt.inside, `Card prompt is clipped: ${JSON.stringify(prompt)}`); report.audits.at(-1).selectedPrompt = prompt; await shot(page, `${name}-selected`)
      }
    }
    await ctx.close(); return { audited: names }
  })
  await run('graph-keyboard-descendant-focus', async () => {
    const results = []
    for (const width of [1440, 320]) {
      const ctx = await context({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); await enterExample(page)
      await page.locator('.lp-node[data-node-id]').last().focus(); await page.keyboard.press('Space'); await page.locator('.lp-map-toolbar').waitFor()
      await page.locator('.lp-map-toolbar button').first().focus(); await page.keyboard.press('Shift+Tab'); await settle(page)
      const focused = await page.evaluate(() => { const element = document.activeElement, node = element.closest('.lp-node'), stage = element.closest('.lp-graph-stage'); if (!node || !stage) return { inside: false, node: null, element: element.outerHTML }; const a = element.getBoundingClientRect(), b = stage.getBoundingClientRect(); return { inside: a.left >= b.left && a.right <= b.right + 1 && a.top >= b.top && a.bottom <= b.bottom + 1, node: node.getAttribute('data-node-id'), label: element.getAttribute('aria-label') || element.textContent, scrollLeft: stage.scrollLeft } })
      assert.ok(focused.inside, `Keyboard focus is clipped: ${JSON.stringify(focused)}`); assert.equal(focused.scrollLeft, 0)
      await shot(page, `learning-keyboard-descendant-${width}`); results.push({ width, ...focused }); await ctx.close()
    }
    return results
  })
  await run('auth-landing-theme-and-small-viewport', async () => {
    const ctx = await context({ viewport: { width: 390, height: 780 }, colorScheme: 'dark' });
    await ctx.addInitScript(() => { if (location.protocol.startsWith('http')) localStorage.setItem('threadpeak-authenticated', 'false') })
    await ctx.route('**/api/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ kind: 'anonymous' }) }))
    const page = await ctx.newPage(); await page.goto(base.href); await page.locator('.auth-card').waitFor()
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
    const measurements = []
    for (const appearance of ['dark', 'light']) {
      if (appearance === 'light') { await page.getByRole('button', { name: '切换夜间模式', exact: true }).click(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light') }
      for (const viewport of [{ width: 390, height: 780 }, { width: 320, height: 720 }, { width: 800, height: 515 }]) {
        await page.setViewportSize(viewport); await page.locator('.auth-landing').evaluate(e => { e.scrollTop = 0 }); await settle(page)
        const layout = await page.locator('.auth-intro').evaluate(e => { const intro = e.getBoundingClientRect(), title = e.querySelector('h1').getBoundingClientRect(), card = document.querySelector('.auth-card').getBoundingClientRect(); return { introWidth: intro.width, titleWidth: title.width, cardWidth: card.width, viewportWidth: innerWidth } })
        assert.ok(layout.introWidth >= Math.min(260, viewport.width - 48) && layout.titleWidth >= Math.min(240, viewport.width - 60), `Auth text column is too narrow to read: ${JSON.stringify(layout)}`)
        assert.ok(layout.cardWidth <= viewport.width && layout.cardWidth >= Math.min(260, viewport.width - 48), `Auth login card width is invalid: ${JSON.stringify(layout)}`)
        const name = `auth-${appearance}-${viewport.width}`; await audit(page, name)
        const bottom = await page.locator('.auth-landing').evaluate(e => { e.scrollTop = e.scrollHeight; const r = document.querySelector('.zhihu-authorize').getBoundingClientRect(); return { scrollTop: e.scrollTop, buttonLeft: r.left, buttonRight: r.right, buttonTop: r.top, buttonBottom: r.bottom, buttonWidth: r.width, innerHeight, innerWidth } });
        assert.ok(bottom.buttonTop >= 0 && bottom.buttonBottom <= bottom.innerHeight && bottom.buttonLeft >= 0 && bottom.buttonRight <= bottom.innerWidth && bottom.buttonWidth >= 180, `Auth login button is clipped: ${JSON.stringify(bottom)}`)
        await shot(page, `${name}-bottom`); measurements.push({ appearance, viewport, layout, bottom })
      }
    }
    await ctx.close(); return { darkSurfaceAudited: true, themeSwitch: true, measurements }
  })
  await run('short-sidebar-history-scroll', async () => {
    const ctx = await context({ viewport: { width: 800, height: 515 } });
    const conversations = Array.from({ length: 20 }, (_, i) => ({ id: `qa-history-${i}`, resourceId: `qa-resource-${i}`, kind: 'chat', title: `本地验收历史记录 ${i + 1}`, query: '只用于检查侧栏滚动', updatedAt: Date.now() - i * 86400000 }))
    await ctx.route('**/api/v2/library', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paths: [], knowledge: [], conversations }) }))
    const page = await ctx.newPage(); await open(page, 'home'); await page.getByRole('heading', { name: '今天', exact: true }).waitFor()
    const scroll = await page.locator('#sidebar-history').evaluate(e => { e.scrollTop = e.scrollHeight; const profile = document.querySelector('.tp-profile').getBoundingClientRect(); return { clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, scrollTop: e.scrollTop, profileBottom: profile.bottom, innerHeight, groups: [...e.querySelectorAll('h3')].map(h => h.textContent) } })
    assert.ok(scroll.scrollTop > 0); assert.equal(scroll.scrollTop, scroll.scrollHeight - scroll.clientHeight); assert.ok(scroll.profileBottom <= scroll.innerHeight); assert.deepEqual(scroll.groups, ['今天', '最近', '更早'])
    await audit(page, 'sidebar-history-light-800'); await ctx.close(); return scroll
  })
  await run('narrow-sidebar-navigation-focus', async () => {
    const ctx = await context({ viewport: { width: 390, height: 780 } }); const page = await ctx.newPage(); await open(page, 'home')
    await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
    assert.equal(await page.locator('#main-content').getAttribute('inert'), '')
    const sidebar = page.getByRole('complementary', { name: '问山主导航', exact: true })
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.ok(await sidebar.evaluate(e => e.contains(document.activeElement))) }
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#main-content').getAttribute('inert'), null)
    assert.ok(await page.getByRole('button', { name: '展开侧栏', exact: true }).evaluate(e => e === document.activeElement))
    await ctx.close(); return { backgroundInert: true, focusContained: true, escapeAndFocusRestore: true }
  })
  if (process.env.UX_QA_LIGHTHOUSE_URL) await run('lighthouse-production-home', async () => {
    const target = new URL(process.env.UX_QA_LIGHTHOUSE_URL)
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Lighthouse target must be local')
    const lighthouseModule = require.resolve(process.env.LIGHTHOUSE_MODULE || 'lighthouse')
    const { default: lighthouse } = await import(pathToFileURL(lighthouseModule).href)
    const { default: desktopConfig } = await import(new URL('./config/desktop-config.js', pathToFileURL(lighthouseModule)).href)
    const lighthouseRequire = createRequire(lighthouseModule)
    const chromeLauncher = await import(pathToFileURL(lighthouseRequire.resolve('chrome-launcher')).href)
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--disable-gpu', '--no-first-run'] })
    const results = []
    try {
      for (const formFactor of ['desktop', 'mobile']) {
        const result = await lighthouse(target.href, { port: chrome.port, logLevel: 'error', output: 'json', onlyCategories: ['performance', 'accessibility', 'best-practices'] }, formFactor === 'desktop' ? desktopConfig : undefined)
        const lhr = result.lhr
        const file = path.join(directory, `browser-lighthouse-${formFactor}.json`)
        const record = { measuredAt: new Date().toISOString(), delivery: 'Production build served locally by vite preview, isolated QA API; simulated Lighthouse throttling. Not live/production deployment.', target: target.href, lhr }
        await writeFile(file, `${JSON.stringify(record, null, 2)}\n`)
        const scores = Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, value.score === null ? null : Math.round(value.score * 100)]))
        results.push({ formFactor, file, scores, runtimeError: lhr.runtimeError ?? null, metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map(key => [key, { value: lhr.audits[key]?.numericValue, displayValue: lhr.audits[key]?.displayValue }])) })
        console.log('UX_QA_LIGHTHOUSE', formFactor, JSON.stringify(results.at(-1)))
        assert.equal(lhr.runtimeError, undefined)
      }
    } finally { await chrome.kill() }
    return { delivery: 'production-preview', results }
  })
} finally {
  report.completedAt = new Date().toISOString()
  report.passed = report.checks.length > 0 && report.checks.every(c => c.passed) && report.audits.every(a => a.passed) && report.pageErrors.length === 0 && report.consoleErrors.length === 0
  report.summary = { checks: report.checks.length, failedChecks: report.checks.filter(c => !c.passed).map(c => c.name), audits: report.audits.length, failedAudits: report.audits.filter(a => !a.passed).map(a => a.name), criticalOrSerious: report.audits.flatMap(a => a.violations.filter(v => ['critical', 'serious'].includes(v.impact))).length, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, screenshots: report.screenshots.length }
  await writeFile(path.join(directory, process.env.UX_QA_REPORT_NAME || 'browser-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  for (const ctx of contexts) await ctx.close().catch(() => {})
  await browser.close()
  console.log('UX_QA_SUMMARY', JSON.stringify(report.summary))
  if (!report.passed) process.exitCode = 1
}
