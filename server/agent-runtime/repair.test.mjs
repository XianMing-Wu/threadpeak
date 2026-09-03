import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  PUBLIC_STRUCTURE_FAILURE_MESSAGE,
  STRUCTURE_REPAIR_USER_PREFIX,
  isInternalStructureMessage,
  publicSafeFailureMessage,
  structureRepairUserMessage,
} from './repair.ts'

test('repair user copy matches agent-specs 0.8', async () => {
  const specs = await readFile(new URL('../../agent-specs.md', import.meta.url), 'utf8')
  assert.match(specs, /### 0\.8 同一 Agent 自我修复/)
  assert.ok(specs.includes(STRUCTURE_REPAIR_USER_PREFIX))
  assert.ok(specs.includes(PUBLIC_STRUCTURE_FAILURE_MESSAGE))
  assert.equal(
    structureRepairUserMessage('模型输出不符合该 Agent 的指定结构。'),
    `${STRUCTURE_REPAIR_USER_PREFIX}\n失败原因：模型输出不符合该 Agent 的指定结构。`,
  )
})

test('internal structure jargon never becomes the public failure', () => {
  assert.equal(isInternalStructureMessage('模型输出不符合该 Agent 的指定结构。'), true)
  assert.equal(publicSafeFailureMessage('模型输出不符合该 Agent 的指定结构。'), PUBLIC_STRUCTURE_FAILURE_MESSAGE)
  assert.equal(publicSafeFailureMessage('知乎检索不可用，不能继续制定这条路线。'), '知乎检索不可用，不能继续制定这条路线。')
})
