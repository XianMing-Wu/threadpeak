// Image delivery derivatives; the reviewed original assets are never overwritten.
// SHARP_MODULE=/path/to/node_modules/sharp node scripts/build-cover-thumbnails.mjs
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require(process.env.SHARP_MODULE || 'sharp')
const sourceDir = fileURLToPath(new URL('../public/art/covers/', import.meta.url))
const outputDir = path.join(sourceDir, 'responsive')
await mkdir(outputDir, { recursive: true })
const records = []
for (const name of (await readdir(sourceDir)).filter(name => /^\d{2}-[a-z]+\.webp$/.test(name)).sort()) {
  const source = await readFile(path.join(sourceDir, name))
  const sourceHash = createHash('sha256').update(source).digest('hex')
  const variants = []
  for (const width of [384, 768]) {
    const output = path.join(outputDir, name.replace('.webp', `-${width}.webp`))
    await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 6 }).toFile(output)
    const bytes = await readFile(output)
    const metadata = await sharp(bytes).metadata()
    if (metadata.format !== 'webp' || metadata.width !== width) throw new Error(`Invalid cover derivative: ${output}`)
    variants.push({ file: path.basename(output), width: metadata.width, height: metadata.height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  if (createHash('sha256').update(await readFile(path.join(sourceDir, name))).digest('hex') !== sourceHash) throw new Error(`Original cover changed: ${name}`)
  records.push({ source: name, sourceBytes: source.length, sourceHash, variants })
}
const manifest = { generatedAt: new Date().toISOString(), source: 'Reviewed public/art/covers WebP files', transform: 'Proportional resize only; WebP quality 80; no crop or content changes', records }
await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Verified ${records.length * 2} responsive covers; originals unchanged.`)
