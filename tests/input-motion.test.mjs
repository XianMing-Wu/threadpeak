import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('every visible text-entry surface uses the shared input motion frame', () => {
  const composer = read('../src/components/Composer.tsx')
  const authors = read('../src/pages/Authors.tsx')
  const askAuthors = read('../src/components/AskAuthorsPrompt.tsx')
  const goalInput = read('../src/path-lab/GoalInput.tsx')

  assert.match(read('../src/components/Shell.tsx'), /cloud ux-ui :5032/)
  assert.match(composer, /composer input-motion-frame/)
  assert.match(authors, /radar-query input-motion-frame/)
  assert.match(askAuthors, /ask-authors-prompt__input-frame input-motion-frame/)
  assert.match(goalInput, /goal-input input-motion-frame/)
})

test('the reference orbit is a path-local radial leak, not a conic ribbon', () => {
  const motion = read('../src/input-motion.css')
  const main = read('../src/main.tsx')
  const pathLabMain = read('../src/path-lab/main.tsx')

  assert.match(main, /import '\.\/input-motion\.css'/)
  assert.match(pathLabMain, /import '\.\.\/input-motion\.css'/)
  assert.match(motion, /animation: tp-input-motion-orbit 2s linear infinite/)
  assert.match(motion, /--tp-input-orb-x/)
  assert.match(motion, /--tp-input-orb-y/)
  assert.match(motion, /radial-gradient\(/)
  assert.match(motion, /circle 5px at var\(--tp-input-orb-x\) var\(--tp-input-orb-y\)/)
  assert.match(motion, /circle 14px at var\(--tp-input-orb-x\) var\(--tp-input-orb-y\)/)
  assert.match(motion, /\.input-motion-frame > \* \{/)
  assert.match(motion, /z-index: 1/)
  assert.doesNotMatch(motion, /z-index: -1/)
  assert.doesNotMatch(motion, /conic-gradient/)
  assert.doesNotMatch(motion, /mask-composite/)
  assert.doesNotMatch(motion, /padding: 28px/)
  assert.doesNotMatch(motion, /blur\(16px\)/)
  assert.doesNotMatch(motion, /--tp-input-motion-band/)
  assert.doesNotMatch(motion, /--tp-input-motion-angle/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(motion, /data-reduce-motion="true"/)
})
