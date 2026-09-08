// Browser checks for the decorative author hero, on an isolated local QA origin.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = new URL(process.env.UX_QA_URL || 'http://127.0.0.1:4404/')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))
const directory = process.env.UX_QA_EVIDENCE || 'qa/evidence/ux-ui-2026-09-08/author-hero'
await mkdir(path.join(directory, 'screenshots'), { recursive: true })
const report = { startedAt: new Date().toISOString(), target: base.href, scope: 'Decorative author hero only; isolated local QA, no real account or live provider acceptance.', checks: [], errors: [], warnings: [] }
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' })
page.on('pageerror', e => report.errors.push(e.message))
page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); if (e.type() === 'warning') report.warnings.push(e.text()) })
async function check(name, run) {
  try { const evidence = await run(); report.checks.push({ name, passed: true, evidence }); console.log('AUTHOR_HERO_PASS', name) }
  catch (e) { report.checks.push({ name, passed: false, error: e.stack }); console.log('AUTHOR_HERO_FAIL', name, e.message) }
}
async function state() {
  return page.locator('.au-discovery-hero').evaluate(root => {
    const stage = root.querySelector('.au-discovery-stage'), r = stage.getBoundingClientRect()
    const deck = root.querySelector('.au-hero-deck'), glass = root.querySelector('.au-magnifier').getBoundingClientRect()
    const handle = new DOMMatrix(getComputedStyle(root.querySelector('.au-magnifier-handle')).transform)
    return {
      motion: root.dataset.motion, width: r.width, height: r.height, time: performance.now(),
      angle: Math.atan2(handle.b, handle.a) * 180 / Math.PI,
      lensX: glass.x + glass.width / 2 - r.x, lensY: glass.y + glass.height / 2 - r.y,
      cards: [...deck.querySelectorAll('.au-orbit-card')].map(slide => {
        const card = slide.querySelector('article'), box = card.getBoundingClientRect()
        const matrix = new DOMMatrix(getComputedStyle(slide).transform)
        return { key: slide.dataset.authorId, id: slide.dataset.authorId, shown: slide.style.opacity === '1', orbitX: matrix.m41, orbitZ: matrix.m43, orbitAngle: Number(slide.style.transform.match(/rotateY\(([^r]+)rad/)[1]), x: box.x + box.width / 2 - r.x, left: box.left - r.x, right: box.right - r.x, height: box.height, width: box.width }
      }),
    }
  })
}
try {
  await page.goto(new URL('#authors', base).href)
  await page.locator('.au-magnifier').waitFor()
  await check('real-avatars-and-requested-presentation', async () => {
    const data = await page.locator('.au-discovery-hero').evaluate(root => {
      const deck = root.querySelector('.au-hero-deck')
      return { headings: root.querySelectorAll('h1,h2,h3,summary').length,
        names: [...new Set([...deck.querySelectorAll('strong')].map(e => e.textContent))],
        images: [...deck.querySelectorAll('img')].map(e => ({ complete: e.complete, width: e.naturalWidth })),
        aspect: [...deck.querySelectorAll('.au-orbit-card')].map(e => e.clientHeight / e.clientWidth) }
    })
    assert.equal(data.headings, 0); assert.equal(data.names.length, 12)
    assert.ok(data.images.every(i => i.complete && i.width > 0))
    assert.ok(data.aspect.every(ratio => ratio > 1.2))
    return data
  })
  await check('complete-loop-with-visible-depth-and-fixed-lens-angle', async () => {
    const samples = []
    for (let i = 0; i < 460; i++) { samples.push(await state()); await page.waitForTimeout(100) }
    await writeFile(path.join(directory, 'motion-samples.json'), JSON.stringify(samples) + '\n')
    const centerIds = [], approaches = [], gaps = [], backwards = [], frontSpeeds = [], rearSpeeds = [], radii = []
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i], center = s.width / 2
      const visible = s.cards.filter(c => c.shown && c.x > 20 && c.x < s.width - 20).sort((a, b) => a.x - b.x)
      assert.ok(visible.length >= 5, 'The stream must fill both sides throughout looping')
      const nearest = visible.reduce((a, b) => Math.abs(a.x - center) < Math.abs(b.x - center) ? a : b)
      assert.ok(Math.abs(nearest.x - center) < 130, 'Unexpected central gap')
      if (centerIds.at(-1) !== nearest.id) centerIds.push(nearest.id)
      assert.ok(Math.abs(s.angle + 45) < .01)
      assert.ok(Math.hypot(s.lensX - center, s.lensY - s.height / 2) <= 7.1)
      for (let j = 1; j < visible.length; j++) {
        if (visible[j].height > 85 && visible[j - 1].height > 85) gaps.push(visible[j].left - visible[j - 1].right)
      }
      if (!i) continue
      for (const card of s.cards) {
        if (Math.abs(card.orbitZ) > 1) radii.push((card.orbitX ** 2 + card.orbitZ ** 2) / (-2 * card.orbitZ))
        const previous = samples[i - 1].cards.find(c => c.key === card.key)
        if (previous.shown === card.shown && card.orbitAngle > previous.orbitAngle) {
          const speed = (card.orbitAngle - previous.orbitAngle) / (s.time - samples[i - 1].time)
          ;(card.shown ? frontSpeeds : rearSpeeds).push(speed)
        }
      }
      for (const card of visible) {
        const previous = samples[i - 1].cards.find(c => c.key === card.key)
        if (previous?.shown && previous.x > 20 && previous.x < s.width - 20 && card.x - previous.x < -1) backwards.push({ i, key: card.key, delta: card.x - previous.x })
      }
    }
    for (const key of samples[0].cards.map(c => c.key)) {
      const trajectory = samples.flatMap(s => s.cards.filter(c => c.shown && c.key === key).map(c => ({ ...c, distance: c.x - s.width / 2 })))
      const far = trajectory.filter(c => c.distance < -400 && c.distance > -435)
      const near = trajectory.filter(c => Math.abs(c.distance) < 20)
      if (far.length && near.length) approaches.push({ key, nearHeight: Math.max(...near.map(c => c.height)), farHeight: Math.max(...far.map(c => c.height)) })
    }
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const returnSpeedRatio = median(rearSpeeds) / median(frontSpeeds)
    const radiusRange = [Math.min(...radii), Math.max(...radii)]
    const evidence = { centerIds, approaches, minimumCardGap: Math.min(...gaps), backwards, returnSpeedRatio, radiusRange }
    await writeFile(path.join(directory, 'motion-summary.json'), JSON.stringify(evidence, null, 2) + '\n')
    assert.ok(approaches.length >= 8 && approaches.every(a => a.nearHeight / a.farHeight > 1.12), 'Cards should grow along the near circular arc')
    assert.ok(radiusRange[1] - radiusRange[0] < .1, 'Every position must lie on the same real circle, allowing computed matrix rounding')
    assert.ok(returnSpeedRatio > 2, 'The hidden return must be faster than the visible arc')
    assert.ok(centerIds.length >= 13 && new Set(centerIds).size === 12, 'All twelve authors must cycle and repeat')
    assert.ok(Math.min(...gaps) >= -1, 'Foreground cards must not intersect')
    assert.equal(backwards.length, 0, 'Visible cards must not jump backwards at the loop boundary')
    await page.locator('.au-discovery-hero').screenshot({ path: path.join(directory, 'screenshots', 'desktop-moving.png') })
    return evidence
  })
  await check('lens-mirrors-the-actual-card-underneath', async () => {
    const result = await page.locator('.au-discovery-hero').evaluate(root => {
      const source = root.querySelector('.au-hero-deck'), mirror = root.querySelector('.au-lens-copy .au-hero-deck')
      return { source: [...source.querySelectorAll('.au-orbit-card')].map(e => e.dataset.authorId), mirror: [...mirror.querySelectorAll('.au-orbit-card')].map(e => e.dataset.authorId), zoom: new DOMMatrix(getComputedStyle(root.querySelector('.au-lens-copy')).transform).a, inert: mirror.hasAttribute('inert') }
    })
    assert.deepEqual(result.source, result.mirror); assert.equal(result.zoom, 1.55); assert.equal(result.inert, true)
    return result
  })
  await check('reduced-motion-and-responsive-themes', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('.au-discovery-hero')?.dataset.motion === 'paused', null, { timeout: 5000 })
    await page.waitForTimeout(150)
    const first = await state(); await page.waitForTimeout(400); const second = await state()
    assert.equal(first.motion, 'paused'); assert.deepEqual(first.cards, second.cards); assert.equal(first.lensX, second.lensX); assert.equal(first.lensY, second.lensY)
    const layouts = []
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
      for (const width of [1440, 900, 390, 320]) {
        await page.setViewportSize({ width, height: 850 }); await page.waitForTimeout(150)
        const s = await state()
        const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
        assert.ok(fits); assert.ok(Math.abs(s.angle + 45) < .01)
        await page.locator('.au-discovery-hero').screenshot({ path: path.join(directory, 'screenshots', `${theme}-${width}.png`) })
        layouts.push({ theme, width, fits, angle: s.angle })
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(500)
    assert.equal((await state()).motion, 'running')
    return layouts
  })
  await check('route-cleanup-and-remount', async () => {
    await page.evaluate(() => { location.hash = 'home' }); await page.locator('.au-magnifier').waitFor({ state: 'detached' })
    await page.evaluate(() => { location.hash = 'authors' }); await page.locator('.au-magnifier').waitFor()
    assert.equal(await page.locator('.au-discovery-hero').count(), 1)
    assert.equal(await page.locator('.au-lens-copy > .au-hero-deck').count(), 1)
    return { hero: 1, lensMirror: 1 }
  })
} finally {
  report.completedAt = new Date().toISOString()
  report.passed = report.checks.every(c => c.passed) && report.errors.length === 0 && report.warnings.length === 0
  await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
  console.log('AUTHOR_HERO_RESULT', report.passed)
  if (!report.passed) process.exitCode = 1
}
