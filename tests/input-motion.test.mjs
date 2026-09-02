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
    assert.match(source, /ambient-glow/)
  }
})

test('the top halo is a detached ellipse with gaussian blur, not a radial stop', () => {
  const motion = read('../src/input-motion.css')
  const main = read('../src/main.tsx')
  const pathLabMain = read('../src/path-lab/main.tsx')

  assert.match(main, /import '\.\/input-motion\.css'/)
  assert.match(pathLabMain, /import '\.\.\/input-motion\.css'/)
  assert.match(motion, /\.ambient-glow \{/)
  assert.match(motion, /top: -40px/)
  assert.match(motion, /width: 250px/)
  assert.match(motion, /height: 80px/)
  assert.match(motion, /border-radius: 50%/)
  assert.match(motion, /linear-gradient\(90deg, #ff6b6b 0%, #ffb75e 100%\)/)
  assert.match(motion, /filter: blur\(45px\)/)
  assert.match(motion, /opacity: \.6/)
  assert.match(motion, /will-change: transform/)
  assert.match(motion, /animation: glowSlide 8s ease-in-out infinite alternate/)
  assert.match(motion, /transform: translateX\(max\(0px, calc\(100cqw - 250px\)\)\)/)
  assert.match(motion, /container-type: inline-size/)
  assert.match(motion, /\.input-motion-frame \{[\s\S]*overflow: visible/)
  assert.match(motion, /\.input-motion-frame > \.input-motion-glow \{[\s\S]*overflow: hidden/)
  assert.doesNotMatch(motion, /radial-gradient/)
  assert.doesNotMatch(motion, /background-position/)
  assert.doesNotMatch(motion, /conic-gradient/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(motion, /data-reduce-motion="true"/)
})
