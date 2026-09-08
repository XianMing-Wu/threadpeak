/** Bake Three.js's MIT-licensed procedural RoomEnvironment into a small reusable CubeUV atlas.
 * Start Vite first. PLAYWRIGHT_MODULE=/path/to/playwright node scripts/build-shelf-reflections.mjs
 */
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = new URL(process.env.UX_QA_URL || 'http://127.0.0.1:4301/')
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw new Error('Local asset generation only')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.goto(base.href)
  const baked = await page.evaluate(async ({ threeUrl, environmentUrl }) => {
    const THREE = await import(threeUrl)
    const { RoomEnvironment } = await import(environmentUrl)
    const renderer = new THREE.WebGLRenderer({ antialias: false })
    const scene = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer)
    const target = pmrem.fromScene(scene, .04, .1, 100, { size: 64 })
    const pixels = new Uint16Array(target.width * target.height * 4)
    renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels)
    const result = { width: target.width, height: target.height, values: Array.from(pixels) }
    target.dispose(); scene.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss()
    return result
  }, {
    threeUrl: new URL('/node_modules/three/build/three.module.js', base).href,
    environmentUrl: new URL('/node_modules/three/examples/jsm/environments/RoomEnvironment.js', base).href,
  })
  const data = gzipSync(Buffer.from(new Uint16Array(baked.values).buffer))
  await mkdir('public/art/shelf', { recursive: true })
  await writeFile('public/art/shelf/studio-cubeuv.bin.gz', data)
  await writeFile('public/art/shelf/studio-cubeuv.json', JSON.stringify({
    width: baked.width, height: baked.height, type: 1016, format: 'RGBA half float, little endian',
    source: 'Three.js RoomEnvironment r185, PMREM sigma 0.04, generated for the metal shelf',
  }, null, 2))
  console.log({ width: baked.width, height: baked.height, compressedBytes: data.length })
} finally { await browser.close() }
