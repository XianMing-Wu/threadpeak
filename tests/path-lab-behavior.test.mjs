import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseGenerationResponse,
  projectDiagnostics,
  readSafeServiceFailure,
} from '../src/path-lab/contracts.ts'
import { shouldSubmitGoalFromKey } from '../src/path-lab/inputPolicy.ts'

const rendererDocument = {
  protocol: 'learning-path',
  version: '1.0',
  id: 'test-path',
  metadata: { title: '从概念到实作', locale: 'zh-CN' },
  structure: {
    entrySubjectId: 'subject-start',
    goalSubjectIds: ['subject-goal'],
    subjects: [
      { id: 'subject-start', cardRef: 'card-start' },
      { id: 'subject-goal', cardRef: 'card-goal' },
    ],
    concepts: [],
    flow: [{ id: 'flow-start-goal', fromSubjectId: 'subject-start', toSubjectId: 'subject-goal' }],
    flowGroups: [],
  },
  data: {
    cards: [
      { id: 'card-start', title: '开始', summary: '建立可执行的基线。' },
      { id: 'card-goal', title: '完成', summary: '交付可验证的作品。' },
    ],
    resources: [],
    actions: [],
  },
  presentation: { layout: { direction: 'top-to-bottom' } },
}

function validEnvelope() {
  return {
    renderer_document: structuredClone(rendererDocument),
    quality_report: {
      passed: true,
      score: 1,
      issues: [],
      invariant_count: 20,
      repair_rounds: 0,
    },
    trace: {
      total_duration_ms: 823,
      degraded: false,
      stages: [],
      provider_call_count: 3,
      provider_call_budget: 8,
    },
    diagnostics: {
      degradation_codes: [],
      source_counts: { total: 6, zhihu: 4, anchor_documents: 1, independent: 3 },
    },
  }
}

test('完整 canonical 响应通过，只投影安全质量摘要', () => {
  const result = parseGenerationResponse(validEnvelope())
  assert.equal(result.rendererDocument.id, 'test-path')
  assert.equal(result.diagnostics.passed, true)
  assert.equal(result.diagnostics.qualityScore, 1)
  assert.deepEqual(result.diagnostics.sourceCounts, [
    { label: '全部来源', value: 6 },
    { label: '知乎', value: 4 },
    { label: '锚点文档', value: 1 },
    { label: '独立证据', value: 3 },
  ])
  assert.equal('trace' in result.diagnostics, false)
})

test('质量门禁 fail-closed：passed 或必要字段缺失即拒绝', () => {
  for (const mutate of [
    (payload) => { delete payload.quality_report.passed },
    (payload) => { delete payload.quality_report.invariant_count },
    (payload) => { delete payload.trace.provider_call_count },
    (payload) => { delete payload.diagnostics.degradation_codes },
  ]) {
    const payload = validEnvelope()
    mutate(payload)
    assert.throws(() => parseGenerationResponse(payload))
  }
})

test('未通过的报告保留本地安全问题标签，不投影原始 message', () => {
  const payload = validEnvelope()
  payload.quality_report = {
    passed: false,
    score: 0.8,
    issues: [{
      code: 'dependency_evidence_invalid',
      severity: 'error',
      message: 'sk-secret /Users/private/traceback.py',
    }],
    invariant_count: 20,
    repair_rounds: 2,
  }
  const diagnostics = projectDiagnostics(payload)
  assert.equal(diagnostics.passed, false)
  assert.deepEqual(diagnostics.qualityIssueLabels, ['硬前置缺少闭合的冻结证据'])
  assert.doesNotMatch(JSON.stringify(diagnostics), /sk-secret|Users|traceback/)
})

test('未登记的质量或降级代码被拒绝，结论矛盾也被拒绝', () => {
  const unknownIssue = validEnvelope()
  unknownIssue.quality_report.issues = [{ code: 'future_untrusted_code', severity: 'error' }]
  unknownIssue.quality_report.passed = false
  assert.throws(() => projectDiagnostics(unknownIssue), /未登记/)

  const unknownDegradation = validEnvelope()
  unknownDegradation.trace.degraded = true
  unknownDegradation.diagnostics.degradation_codes = ['future_degradation']
  assert.throws(() => projectDiagnostics(unknownDegradation), /未登记/)

  const contradictory = validEnvelope()
  contradictory.quality_report.issues = [{ code: 'cyclic_prerequisites', severity: 'error' }]
  assert.throws(() => projectDiagnostics(contradictory), /不一致/)
})

test('部分检索成功必须以登记降级状态呈现', () => {
  const payload = validEnvelope()
  payload.trace.degraded = true
  payload.diagnostics.degradation_codes = ['partial_search']

  const diagnostics = projectDiagnostics(payload)

  assert.deepEqual(diagnostics.degradationCodes, ['partial_search'])
  assert.match(diagnostics.degradationLabels[0], /部分证据检索/)
})

test('缺少 flowGroup type/policy/anchor 的文档不能进入生成链', () => {
  const payload = validEnvelope()
  payload.renderer_document.structure.flowGroups = [{ id: 'group-1' }]
  assert.throws(() => parseGenerationResponse(payload), /renderer v1/)
})

test('renderer 关键字段类型异常不会进入 3D 发布', () => {
  const payload = validEnvelope()
  payload.renderer_document.metadata.title = { unsafe: true }
  assert.throws(() => parseGenerationResponse(payload), /renderer v1/)
})

test('服务错误只使用本地 code 映射，完全忽略恶意 detail/message/path', async () => {
  const response = new Response(JSON.stringify({
    code: 'provider_deferred',
    detail: 'sk-secret-do-not-show',
    message: '/Users/private/traceback.py',
    path: '/etc/passwd',
  }), { status: 503, headers: { 'content-type': 'application/json' } })
  const failure = await readSafeServiceFailure(response)
  assert.equal(failure.message, 'Provider 当前超时或繁忙，本次路径未发布，请稍后重试。')
  assert.doesNotMatch(JSON.stringify(failure), /sk-secret|Users|traceback|passwd/)

  const unknown = await readSafeServiceFailure(new Response(JSON.stringify({
    code: 'attacker_controlled',
    message: 'render me',
  }), { status: 418 }))
  assert.equal(unknown.message, '生成服务返回错误（HTTP 418）')
})

test('错误响应若附带完整安全 diagnostics，失败尝试可被定位', async () => {
  const payload = validEnvelope()
  payload.code = 'quality_gate_failed'
  payload.quality_report = {
    passed: false,
    score: 0.8,
    issues: [{ code: 'full_coverage_incomplete', severity: 'error', message: 'raw internal text' }],
    invariant_count: 23,
    repair_rounds: 2,
  }
  const failure = await readSafeServiceFailure(new Response(JSON.stringify(payload), { status: 503 }))
  assert.equal(failure.diagnostics?.passed, false)
  assert.deepEqual(failure.diagnostics?.qualityIssueLabels, ['完整模式仍有未覆盖需求'])
  assert.doesNotMatch(JSON.stringify(failure), /raw internal text/)
})

test('Enter 提交策略覆盖 Shift、标准 IME 与 Safari keyCode 229', () => {
  assert.equal(shouldSubmitGoalFromKey({ key: 'Enter', shiftKey: false, isComposing: false }), true)
  assert.equal(shouldSubmitGoalFromKey({ key: 'Enter', shiftKey: true, isComposing: false }), false)
  assert.equal(shouldSubmitGoalFromKey({ key: 'Enter', shiftKey: false, isComposing: true }), false)
  assert.equal(shouldSubmitGoalFromKey({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 229 }), false)
  assert.equal(shouldSubmitGoalFromKey({ key: 'a', shiftKey: false, isComposing: false }), false)
})
