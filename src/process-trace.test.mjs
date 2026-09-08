import assert from 'node:assert/strict'
import test from 'node:test'
import { applyReasoning, asProcessSteps, confirmStep, flowSteps, pillTitle, agentStep, searchStep, settleTrace, thinkStep, thoughtForDisplay, uniqueTrace } from './process-trace.ts'

test('agent and search bars keep their own titles; think bars only say 思考中 after reasoning exists', () => {
  assert.equal(pillTitle(agentStep('r1', '拆成检索问题')), '拆成检索问题')
  assert.equal(pillTitle(searchStep('rs-1', '线性映射 怎么学')), '检索知乎')
  assert.equal(pillTitle(thinkStep('r1-think')), '思考中')
  assert.equal(pillTitle(thinkStep('r1-think', 'done', '先把目标拆开')), '思考完成')
  assert.equal(pillTitle(thinkStep('r1-think', 'stopped')), '已停止思考')
  assert.equal(pillTitle(confirmStep('q1', '先看例子')), '已确认：先看例子')
})

test('path-start and follow-up catalogs do not pretend every agent is 思考中', () => {
  assert.deepEqual(flowSteps('path-start').map((step) => step.kind), ['agent'])
  assert.deepEqual(flowSteps('follow-up').map((step) => `${step.kind}:${step.title}`), [
    'agent:判断脉络位置',
    'agent:组织这次追问',
  ])
  assert.deepEqual(flowSteps('first-entry'), [])
})

test('asProcessSteps keeps valid bars and skips a bad item instead of dropping the whole list', () => {
  const steps = asProcessSteps([
    agentStep('r1', '拆成检索问题', undefined, 'done'),
    { id: 'bad' },
    confirmStep('q-1', '定义'),
  ])
  assert.deepEqual(steps?.map((step) => `${step.id}:${step.kind}`), ['r1:agent', 'q-1:confirm'])
})

test('uniqueTrace keeps first-seen order and the latest copy of each id', () => {
  const steps = uniqueTrace([
    agentStep('r1', '拆成检索问题', undefined, 'running'),
    confirmStep('q-1', '定义'),
    agentStep('r1', '拆成检索问题', undefined, 'done'),
  ])
  assert.equal(steps.length, 2)
  assert.equal(steps[0].status, 'done')
  assert.equal(steps[1].title, '已确认：定义')
})

test('JSON round-trip keeps published bars so a refresh can hydrate them', () => {
  const stored = [
    agentStep('r1', '拆成检索问题', undefined, 'done'),
    confirmStep('q-1', '定义'),
    agentStep('r4', '生成学习路线', undefined, 'done'),
  ]
  const restored = asProcessSteps(JSON.parse(JSON.stringify(stored)))
  assert.deepEqual(restored?.map((step) => `${step.id}:${step.title}`), [
    'r1:拆成检索问题',
    'q-1:已确认：定义',
    'r4:生成学习路线',
  ])
})

test('thought display strips dumped JSON so the think bar stays readable', () => {
  const raw = `先把概念串起来。\n${JSON.stringify({ id: 'e1', fromConceptId: 'n1', toConceptId: 'n2', reason: '对照' })}\n再检查入口。`
  assert.match(thoughtForDisplay(raw), /先把概念串起来/)
  assert.match(thoughtForDisplay(raw), /再检查入口/)
  assert.doesNotMatch(thoughtForDisplay(raw), /fromConceptId/)
})

test('thought display hides streaming JSON fragments that never form a complete object', () => {
  const fragment = `"id": "f6e5d4c3-b2a1-4f8e-9d0c-1a2b3c4d5e23",
"fromConceptId": "b2a3c4d5-6e7f-4a8b-9c0d-1e2f3a4b5c19",
"toConceptId": "b2a3c4d5-6e7f-4a8b-9c0d-1e2f3a4b5c23",
"reason": "对角化与特征分解的几何直觉可立即在 MATLAB 的 eig 调用中对照，适合边学边验证。"
}
],`
  assert.equal(thoughtForDisplay(fragment), '')
  assert.doesNotMatch(thoughtForDisplay(`还差入口可达。\n${fragment}`), /fromConceptId/)
  assert.match(thoughtForDisplay(`还差入口可达。\n${fragment}`), /还差入口可达/)
})

test('failed settle keeps a think bar with thought as 思考完成', () => {
  const steps = settleTrace([
    agentStep('r1', '拆成检索问题', undefined, 'running'),
    thinkStep('r1-think', 'running', '先把目标拆开'),
  ], 'failed')
  assert.equal(steps[0].status, 'failed')
  assert.equal(steps[1].status, 'done')
  assert.equal(pillTitle(steps[1]), '思考完成')
})

test('applyReasoning inserts a think bar after the matching agent', () => {
  const next = applyReasoning(flowSteps('ordinary'), 'r5-think', '先看当前问题再组织回答')
  assert.equal(next[0].kind, 'agent')
  assert.equal(next[1].kind, 'think')
  assert.equal(next[1].thought, '先看当前问题再组织回答')
  assert.equal(pillTitle(next[1]), '思考中')
})
