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

test('legacy repair copy remains isolated from the active deterministic recovery contract', async () => {
  const specs = await readFile(new URL('../../docs/agents.md', import.meta.url), 'utf8')
  assert.match(specs, /### 0\.1 任务、预算与修复/)
  assert.ok(specs.includes("各生成步骤只调用一次模型"))
  assert.ok(!specs.includes("面向用户的普通结构失败文案为"))
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
