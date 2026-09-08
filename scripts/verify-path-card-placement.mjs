// Browser regression for endpoint-card clipping and camera oscillation.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PATH_CARD_QA_URL || 'http://127.0.0.1:4404'
const directory = 'qa/evidence/ux-ui-2026-09-08/user-steering/path-card'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { at: new Date().toISOString(), scope: 'Local WebGL example routes; card placement and movement only', checks: [], errors: [] }
try {
  for (const [width, height, reducedMotion] of [[1440, 620, 'no-preference'], [900, 480, 'no-preference'], [390, 780, 'no-preference'], [320, 568, 'reduce']]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion })
    page.on('pageerror', error => report.errors.push(error.message))
    await page.goto(`${base}/#paths?tab=example`)
    await page.locator('.grid li').first().click()
    await page.locator('.path3d-mount[data-snapshot]').waitFor()
    await page.waitForFunction(() => {
      const snapshot = JSON.parse(document.querySelector('.path3d-mount').dataset.snapshot || '{}')
      return snapshot.phase === 'ready' && snapshot.session?.interactionEnabled === true
    })
    // Let the initial responsive canvas resize settle before measuring card motion.
    await page.waitForTimeout(300)
    const canvas = page.locator('canvas')
    await canvas.focus(); await page.keyboard.press('End')
    await page.locator('[role="option"][data-node-id="goal-understanding"][aria-selected="true"]').waitFor({ state: 'attached' })
    await page.evaluate(() => {
      window.pathCardFrames = []
      const started = performance.now()
      const sample = () => {
        const card = document.querySelector('.lp-context-card')
        if (!card.hidden) {
          const rect = card.getBoundingClientRect()
          window.pathCardFrames.push({ t: performance.now() - started, top: rect.top, left: rect.left, bottom: rect.bottom, anchor: Number(card.dataset.anchorClientY), placed: card.dataset.placed === 'true' })
        }
        if (performance.now() - started < 3200) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.keyboard.press('Enter')
    const card = page.locator('.lp-context-card[data-node-id="goal-understanding"]')
    await card.waitFor()
    await page.waitForTimeout(3300)
    const samples = await page.evaluate(() => window.pathCardFrames)
    await writeFile(`${directory}/frames-${width}-${height}.json`, JSON.stringify(samples) + '\n')
    const frames = samples.slice(samples.findIndex(f => f.placed))
    const reversals = frames.slice(1).map((f, i) => f.top - frames[i].top)
    assert.ok(frames.length > 10)
    assert.ok(frames.every(f => f.placed), 'Visible card must not blink off when the camera settles')
    const maxReverse = Math.max(0, ...reversals)
    // Reduced motion applies the offset immediately; the bordered viewport can
    // require one correction within 2px. Its settled position must stay fixed.
    const tolerance = reducedMotion === 'reduce' ? 2 : 1
    assert.ok(maxReverse < tolerance, `Card reverses direction by ${maxReverse}px at ${width} × ${height}`)
    const settled = frames.filter(f => f.t > 1500)
    assert.ok(Math.max(...settled.map(f => f.top)) - Math.min(...settled.map(f => f.top)) < 1)
    const bounds = await card.evaluate(e => {
      const viewport = e.closest('.learning-path-viewport').getBoundingClientRect()
      const panel = e.querySelector('.lp-context-card__panel')
      const button = e.querySelector('[data-slot="primary"]')
      const rect = e.getBoundingClientRect(), action = button.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, viewportBottom: viewport.bottom, panelScroll: panel.scrollHeight - panel.clientHeight, buttonTop: action.top, buttonBottom: action.bottom, anchorGap: rect.top - Number(e.dataset.anchorClientY) }
    })
    assert.ok(bounds.bottom <= bounds.viewportBottom - 10)
    assert.ok(Math.abs(bounds.anchorGap - 18) < 1, 'Card remains attached below its platform')
    const button = card.getByRole('button', { name: '走到这', exact: true })
    await button.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${directory}/goal-${width}-${height}.png` })
    await button.click()
    await card.waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.querySelector('[role="option"][data-node-id="goal-understanding"]')?.getAttribute('aria-current') === 'step', null, { timeout: 20000 })
    assert.match(page.url(), /#path-3d/)
    assert.equal(await page.locator('.path3d-error').count(), 0)
    report.checks.push({ width, height, reducedMotion, maxReverse, bounds, buttonMovesToGoal: true })
    await page.close()
  }
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.passed = false; report.errors.push(error.stack); process.exitCode = 1
} finally {
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close(); console.log(JSON.stringify(report, null, 2))
}
