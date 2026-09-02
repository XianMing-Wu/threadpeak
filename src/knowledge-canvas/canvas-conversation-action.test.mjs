import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const action = await readFile(new URL('./canvas-conversation-action.tsx', import.meta.url), 'utf8')
const canvas = await readFile(new URL('../pages/KnowledgeCanvas.tsx', import.meta.url), 'utf8')
const mine = await readFile(new URL('./mine-graph-canvas.tsx', import.meta.url), 'utf8')

test('from a learning session the canvas shows 回到对话; from the knowledge list it does not show 新对话', () => {
  assert.match(action, /Icon name="message"[\s\S]{0,20}回到对话/)
  assert.match(action, /returnTo !== 'session-learning'/)
  assert.doesNotMatch(action, /新对话/)
  assert.doesNotMatch(action, /openNewLearningFromCanvas/)
  assert.doesNotMatch(action, /openLearning/)
  assert.match(canvas, /CanvasConversationAction/)
  assert.match(canvas, /closeConceptKnowledge\(\)/)
  assert.doesNotMatch(canvas, /location.hash = 'session-learning'/)
  assert.match(mine, /KnowledgeCanvasPage/)
})
