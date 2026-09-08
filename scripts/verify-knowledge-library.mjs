/** Browser-isolated bookshelf QA. No generated content or writes to user resources.
 * PLAYWRIGHT_MODULE=/path/to/playwright AXE_MODULE=/path/to/axe-core node scripts/verify-knowledge-library.mjs
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { buildPathDocument } from '../src/pathDocument.ts'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axePath = require.resolve(`${process.env.AXE_MODULE || 'axe-core'}/axe.min.js`)
const base = new URL(process.env.UX_QA_URL || 'http://127.0.0.1:4301/')
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Local QA only')
const directory = 'qa/evidence/ux-ui-2026-09-08/knowledge-bookshelf'
const report = { at: new Date().toISOString(), scope: 'Open Three.js metal shelves, printed route/carrier/concept book covers, four whole books per desktop shelf, one-book snapping, persistent shelves during search, curated examples and explicitly intercepted API fixtures. No live-provider or production claim.', checks: [], audits: [], pageErrors: [] }
const empty = { paths: [], knowledge: [], conversations: [] }
const document = buildPathDocument({ id: 'qa-shelf-doc', title: '浏览器验收路线', description: 'QA', goalTitle: '完成', goalSummary: '完成', carriers: [
  { id: 'qa-carrier', title: '论文载体', summary: '阅读', concepts: [['qa-first', '第一个概念', '说明'], ['qa-second', '第二个概念', '说明']] },
] })
const sample = { ...empty, paths: [{ id: 'qa-route', goal: '浏览器验收路线', document, updatedAt: 1 }], knowledge: document.structure.concepts.map((concept, i) => ({ id: `qa-knowledge-${i}`, routeId: 'qa-route', conceptId: concept.id, title: `个人概念 ${i + 1}` })) }
const booksSelector = '.knowledge-shelf-track .knowledge-book'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
async function pageFor({ width = 1440, theme = 'light', library = empty, handler, motion = 'reduce', hash = 'knowledge' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: motion, hasTouch: width < 600 })
  await context.route('**/api/v2/session', route => route.fulfill({ json: { workspaceId: 'qa-knowledge-bookshelf' } }))
  await context.route('**/api/v2/library', handler || (route => route.fulfill({ json: library })))
  const page = await context.newPage()
  page.on('pageerror', error => report.pageErrors.push(error.message))
  await page.goto(new URL(`#${hash}`, base).href)
  await page.locator('.knowledge-shelf').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.knowledge-library-shelves[data-renderer="three"]').waitFor()
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.knowledge-shelf:first-of-type img')).every(image => image.complete))
  return { page, context }
}
async function audit(page, name) {
  const model = await page.locator('.knowledge-shelf-renderer canvas').evaluate(canvas => ({
    context: !!canvas.getContext('webgl2'), width: canvas.width, height: canvas.height,
    books: Number(canvas.dataset.models), shelves: Number(canvas.dataset.shelves),
    visible: getComputedStyle(canvas).visibility,
  }))
  assert.ok(model.context && model.width > 0 && model.height > 0)
  assert.equal(model.books, await page.locator('.knowledge-book').count())
  assert.equal(model.shelves, await page.locator('.knowledge-shelf').count())
  assert.equal(await page.locator('.knowledge-shelf-label, .knowledge-shelf-count, .knowledge-shelf-arrows').count(), 0)
  assert.equal(model.visible, 'visible')
  await page.addScriptTag({ path: axePath })
  const accessibility = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } })
    return result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) }))
  })
  const layout = await page.locator('.knowledge-library').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth }))
  report.audits.push({ name, accessibility, layout, model })
  assert.equal(accessibility.filter(item => ['serious', 'critical'].includes(item.impact)).length, 0, JSON.stringify(accessibility))
  assert.ok(layout.scrollWidth <= layout.width + 1 && layout.documentWidth <= layout.viewport + 1)
  await page.screenshot({ path: `${directory}/${name}.png` })
}
try {
  for (const width of [1440, 900, 390, 320]) {
    const { page, context } = await pageFor({ width })
    assert.equal(await page.locator('.knowledge-shelf').count(), 5)
    assert.equal(await page.locator(booksSelector).count(), 22)
    assert.equal(await page.getByRole('button', { name: /^(我的知识脉络|示例知识脉络)$/ }).count(), 0)
    await audit(page, `shelf-${width}`)
    const shelf = page.locator('.knowledge-shelf').first(), viewport = shelf.locator('.knowledge-shelf-viewport')
    const fullBooks = async () => viewport.evaluate(element => {
      const box = element.getBoundingClientRect()
      const visible = Array.from(element.querySelectorAll('.knowledge-book-slot')).map(book => book.getBoundingClientRect())
        .filter(book => Math.min(book.right, box.right) - Math.max(book.left, box.left) > 1)
      return { count: visible.length, partial: visible.some(book => book.left < box.left - 1 || book.right > box.right + 1) }
    })
    const whole = Number(await page.locator('.knowledge-library-shelves').getAttribute('data-visible-books'))
    assert.equal((await fullBooks()).count, whole)
    assert.equal((await fullBooks()).partial, false)
    if (width === 1440) assert.equal(whole, 4)
    const stride = await viewport.evaluate(element => {
      const slots = element.querySelectorAll('.knowledge-book-slot'); return slots[1].offsetLeft - slots[0].offsetLeft
    })
    const shelfPositions = () => page.locator('.knowledge-shelf-plank').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }
    }))
    const originalShelves = await shelfPositions()
    const initial = await viewport.evaluate(element => element.scrollLeft)
    const otherInitial = await page.locator('.knowledge-shelf-viewport').nth(1).evaluate(element => element.scrollLeft)
    const maximum = await viewport.evaluate(element => element.scrollWidth - element.clientWidth)
    assert.equal(initial, 0)
    assert.equal(await page.locator('.knowledge-book').count(), 22, 'there must be no loop copies')
    const coverFields = await shelf.locator('.knowledge-book').first().evaluate(element => ({
      route: element.querySelector('.knowledge-book-route').textContent,
      carrier: element.querySelector('.knowledge-book-carrier').textContent,
      concept: element.querySelector('.knowledge-book-title').textContent,
    }))
    assert.ok(coverFields.route.includes('Attention') && coverFields.carrier && coverFields.concept)
    await viewport.focus()
    for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight')
    assert.ok(Math.abs(await viewport.evaluate(element => element.scrollLeft) - maximum) <= 1)
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight')
    assert.ok(Math.abs(await viewport.evaluate(element => element.scrollLeft) - maximum) <= 1)
    for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowLeft')
    assert.equal(await viewport.evaluate(element => element.scrollLeft), 0)
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowLeft')
    assert.equal(await viewport.evaluate(element => element.scrollLeft), 0)
    assert.equal(await page.locator('.knowledge-shelf-viewport').nth(1).evaluate(element => element.scrollLeft), otherInitial)
    const box = await viewport.boundingBox()
    await page.mouse.move(box.x + Math.min(160, box.width - 20), box.y + 95)
    await page.mouse.down(); await page.mouse.move(box.x + 20, box.y + 97, { steps: 12 }); await page.mouse.up()
    assert.ok(page.url().endsWith('#knowledge'), 'drag must not open a book')
    if (maximum > 1) assert.ok(Math.abs(await viewport.evaluate(element => element.scrollLeft) - stride) <= 1, 'one drag advances one complete book')
    assert.equal((await fullBooks()).partial, false)
    if (width === 1440) {
      assert.equal((await fullBooks()).count, 4)
      await page.screenshot({ path: `${directory}/shelf-four-books-after-swipe.png` })
    }
    if (width === 390) {
      const cdp = await context.newCDPSession(page), before = await viewport.evaluate(element => element.scrollLeft)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 20, y: box.y + 100 }] })
      for (let index = 1; index <= 8; index++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 20 - index * (box.width - 40) / 8, y: box.y + 100 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForFunction(value => document.querySelector('.knowledge-shelf-viewport').scrollLeft !== value, before)
      await page.waitForTimeout(700)
      const after = await viewport.evaluate(element => element.scrollLeft)
      assert.ok(Math.abs(after - before - stride) <= 1, `touch must advance exactly one book: ${before} → ${after}, stride ${stride}`)
      assert.equal((await fullBooks()).partial, false)
      await cdp.detach()
    }
    const search = page.getByRole('searchbox', { name: '搜索知识脉络', exact: true })
    await search.fill('阅读输入不匹配QA')
    await page.waitForFunction(() => document.querySelector('.knowledge-shelf-renderer canvas').dataset.models === '0')
    assert.equal(await page.locator('.knowledge-shelf').count(), 5)
    assert.equal(await page.locator('.knowledge-book').count(), 0)
    assert.equal(await page.locator('.knowledge-shelf-renderer canvas').getAttribute('data-shelves'), '5')
    assert.deepEqual(await shelfPositions(), originalShelves, 'search must keep the metal bases in place')
    if (width === 1440) await page.screenshot({ path: `${directory}/shelf-search-empty.png` })
    await search.fill('')
    assert.equal(await page.locator(booksSelector).count(), 22)
    await search.fill('分母'); assert.equal(await page.locator(booksSelector).count(), 1)
    await search.fill('看懂输入与匹配'); assert.equal(await page.locator(booksSelector).count(), 2)
    await search.fill('读懂 Attention'); assert.equal(await page.locator(booksSelector).count(), 5)
    await search.fill(''); await search.focus()
    assert.equal(await search.evaluate(element => getComputedStyle(element).outlineStyle), 'none')
    await page.mouse.move(width - 50, 500); await page.mouse.wheel(0, 2000)
    await page.waitForFunction(() => document.querySelector('.knowledge-library').scrollTop > 0)
    const last = page.locator('.knowledge-shelf').last().locator(booksSelector).last()
    await last.focus()
    assert.ok(await last.evaluate(element => { const box = element.getBoundingClientRect(), main = element.closest('main').getBoundingClientRect(); return box.top >= main.top && box.bottom <= main.bottom + 1 }))
    await page.keyboard.press('Enter'); await page.locator('.lp-example-note').waitFor()
    report.checks.push({ width, rows: 5, books: 22, noTabs: true, wholeBooksVisible: whole, snapOneBook: true, searchKeepsShelves: true, boundedScroll: true, noDuplicateBooks: true, shelfLabels: true, independentRows: true, dragWithoutOpen: true, keyboard: true, verticalScroll: true, searchRouteCarrierConcept: true, ...(width === 390 ? { touchSwipe: true } : {}) })
    await context.close()
  }
  {
    const { page, context } = await pageFor({ theme: 'dark' })
    await audit(page, 'shelf-dark-1440'); await context.close()
  }
  {
    const { page, context } = await pageFor({ library: sample, hash: 'knowledge?tab=example' })
    assert.equal(await page.locator('.knowledge-shelf').count(), 6)
    assert.equal(await page.locator('.knowledge-shelf').first().getByRole('heading', { name: '浏览器验收路线' }).count(), 1)
    assert.equal(await page.locator('.knowledge-shelf').first().locator(booksSelector).count(), 2)
    await audit(page, 'personal-and-example-fixture')
    // Abort navigation after proving the original resource URL; never write a fixture to the user's backend.
    await context.route('**/api/v2/learning/**', route => route.fulfill({ status: 404, json: { message: 'QA resource only', code: 'QA_NOT_PERSISTED' } }))
    await page.locator(booksSelector).first().click()
    await page.waitForURL('**/#knowledge-detail?resource=qa-knowledge-0')
    report.checks.push({ unifiedLegacyQuery: true, personalAndExampleTogether: true, personalResourceTarget: true, fixtureOnly: true })
    await context.close()
  }
  {
    let release, fail = true, attempts = 0
    const gate = new Promise(resolve => { release = resolve })
    const { page, context } = await pageFor({ handler: async route => {
      attempts++; await gate
      return fail ? route.fulfill({ status: 503, json: { code: 'QA_UNAVAILABLE', message: '读取失败测试' } }) : route.fulfill({ json: sample })
    } })
    await page.locator('.knowledge-library-loading[aria-busy="true"]').waitFor()
    await audit(page, 'loading-fixture')
    release()
    await page.getByRole('heading', { name: '暂时无法读取你的知识脉络', exact: true }).waitFor()
    assert.equal(await page.locator('.knowledge-shelf').count(), 5)
    await audit(page, 'error-fixture')
    fail = false
    await page.getByRole('button', { name: '重新连接', exact: true }).click()
    await page.locator('[data-shelf-id="mine:qa-route"]').waitFor()
    assert.ok(attempts >= 2)
    report.checks.push({ loading: true, examplesDoNotHidePersonalError: true, retryRestoresOwnShelf: true, fixtureOnly: true })
    await context.close()
  }
  {
    const { page, context } = await pageFor({ width: 900 })
    await page.evaluate(() => { window.originalShelfCanvas = document.querySelector('.knowledge-shelf-renderer canvas') })
    const search = page.getByRole('searchbox', { name: '搜索知识脉络', exact: true })
    for (const query of ['分母', '', '不存在的书架QA', '', 'Three', '', 'Attention', '']) {
      await search.fill(query)
      if (!query) await page.waitForFunction(() => document.querySelector('.knowledge-shelf-renderer canvas').dataset.models === '22')
    }
    assert.ok(await page.evaluate(() => window.originalShelfCanvas === document.querySelector('.knowledge-shelf-renderer canvas')), 'search must reuse one WebGL context')
    await page.evaluate(() => {
      const extension = document.querySelector('.knowledge-shelf-renderer canvas').getContext('webgl2').getExtension('WEBGL_lose_context')
      if (!extension) throw new Error('WebGL context loss test extension unavailable')
      window.restoreShelfContext = () => extension.restoreContext()
      extension.loseContext()
    })
    await page.locator('.knowledge-library-shelves[data-renderer="unavailable"]').waitFor()
    await page.getByText('3D 暂时不可用，已切换为普通书架，仍可浏览和打开概念。', { exact: true }).waitFor()
    const viewport = page.locator('.knowledge-shelf-viewport').first()
    await viewport.focus(); await page.keyboard.press('ArrowRight')
    const offset = await viewport.evaluate(element => element.scrollLeft)
    assert.ok(offset > 0)
    await page.evaluate(() => window.restoreShelfContext())
    await page.locator('.knowledge-library-shelves[data-renderer="three"]').waitFor()
    assert.equal(await viewport.evaluate(element => element.scrollLeft), offset)
    await audit(page, 'context-restored')
    await page.evaluate(() => { location.hash = 'paths' })
    await page.locator('.knowledge-library').waitFor({ state: 'detached' })
    await page.evaluate(() => { location.hash = 'knowledge' })
    await page.locator('.knowledge-library-shelves[data-renderer="three"]').waitFor()
    assert.equal(await page.locator('.knowledge-shelf-renderer canvas').count(), 1)
    report.checks.push({ searchReusesWebGL: true, contextLossFallback: true, contextRestoresScroll: true, routeRemount: true })
    await context.close()
  }
  {
    const { page, context } = await pageFor({ width: 900, motion: 'no-preference' })
    const viewport = page.locator('.knowledge-shelf-viewport').first()
    await viewport.evaluate(element => { window.shelfMotion = []; window.shelfMotionStart = performance.now(); const capture = () => { window.shelfMotion.push(element.scrollLeft); if (performance.now() - window.shelfMotionStart < 850) requestAnimationFrame(capture) }; capture() })
    await viewport.focus(); await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    const frames = await page.evaluate(() => window.shelfMotion)
    assert.ok(new Set(frames.map(Math.round)).size > 4)
    const step = await viewport.evaluate(element => { const slots = element.querySelectorAll('.knowledge-book-slot'); return slots[1].offsetLeft - slots[0].offsetLeft })
    assert.ok(Math.abs(await viewport.evaluate(element => element.scrollLeft) - step) <= 1, 'animated movement must settle on a whole book')
    const box = await viewport.boundingBox()
    await page.mouse.move(box.x + 150, box.y + 100); await page.mouse.down()
    await page.mouse.move(box.x + 95, box.y + 100, { steps: 6 }); await page.mouse.up()
    await page.waitForTimeout(400)
    assert.ok(Math.abs(await viewport.evaluate(element => element.scrollLeft) - step * 2) <= 1, 'a short mouse swipe must smoothly finish the next book')
    await audit(page, 'motion-default')
    report.checks.push({ animatedBrowseFrames: frames.length, reducedMotionCoveredByMatrix: true })
    await context.close()
  }
  assert.equal(report.pageErrors.length, 0)
  report.passed = true
} catch (error) {
  report.passed = false; report.error = error.stack; process.exitCode = 1
} finally {
  await browser.close()
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, audits: report.audits.length, error: report.error }))
}
