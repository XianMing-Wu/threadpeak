import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the product entry loads the shared input motion orbit', () => {
  const motion = read('../src/input-motion.css')
  const main = read('../src/main.tsx')

  assert.match(main, /import '\.\/input-motion\.css'/)
  assert.match(motion, /animation: tp-input-motion-orbit 2s linear infinite/)
  assert.match(motion, /mask-composite: exclude/)
  assert.match(motion, /filter: blur\(6px\) saturate\(\.92\)/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(motion, /data-reduce-motion="true"/)
})
