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
  for (const source of [composer, authors, askAuthors, goalInput]) {
    assert.match(source, /input-motion-glow/)
  }
})

test('the top halo travels right to left with coral-to-gold blur', () => {
  const motion = read('../src/input-motion.css')
  const main = read('../src/main.tsx')
  const pathLabMain = read('../src/path-lab/main.tsx')

  assert.match(main, /import '\.\/input-motion\.css'/)
  assert.match(pathLabMain, /import '\.\.\/input-motion\.css'/)
  assert.match(motion, /tp-input-top-glow 9s ease-in-out infinite/)
  assert.match(motion, /left: 80%/)
  assert.match(motion, /top: -20%/)
  assert.match(motion, /left: 10%/)
  assert.match(motion, /filter: blur\(28px\)/)
  assert.match(motion, /rgba\(255, 94, 98/)
  assert.match(motion, /rgba\(255, 170, 51/)
  assert.match(motion, /\.input-motion-glow \{/)
  assert.match(motion, /overflow: hidden/)
  assert.match(motion, /border-radius: 50%/)
  assert.match(motion, /transform: translate\(-50%, -50%\)/)
  assert.match(motion, /\.input-motion-frame \{[\s\S]*overflow: visible/)
  assert.doesNotMatch(motion, /offset-path/)
  assert.doesNotMatch(motion, /conic-gradient/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(motion, /data-reduce-motion="true"/)
})
