import assert from 'node:assert/strict'
import test from 'node:test'
import { projectRouteToDocument } from './project-document.ts'
import { parseAgentOutput } from '../agent-runtime/schemas.ts'
import { hasSplitSiblingEdge, hasUnbalancedSplitJoin } from '../../src/path-3d/host-subject-flow.ts'
import { isLearningPathRendererDocument } from '../../src/path-3d/validate-renderer-document.ts'

const route = {
  version: '1.0',
  routeId: '550e8400-e29b-41d4-a716-446655440000',
  title: '线性映射入门',
  carriers: [
    { id: 'carrier-a', title: '线性代数', description: '对象与运算' },
    { id: 'carrier-b', title: '矩阵', description: '坐标表示' },
    { id: 'carrier-c', title: '应用', description: '把映射用起来' },
  ],
  concepts: [
    { id: 'n1', carrierId: 'carrier-a', title: '向量空间', hasDispute: false, detailedDescription: '先建立对象', attachmentSourceIds: [] },
    { id: 'n2', carrierId: 'carrier-a', title: '线性映射', hasDispute: true, detailedDescription: '讲清保运算', attachmentSourceIds: ['att-1'] },
    { id: 'n3', carrierId: 'carrier-b', title: '矩阵表示', hasDispute: false, detailedDescription: '同一映射的坐标', attachmentSourceIds: [] },
    { id: 'n4', carrierId: 'carrier-c', title: '投影', hasDispute: false, detailedDescription: '一个应用', attachmentSourceIds: [] },
  ],
  carrierEdges: [
    { id: 'e1', fromCarrierId: 'carrier-a', toCarrierId: 'carrier-b', reason: '从对象到表示' },
    { id: 'e2', fromCarrierId: 'carrier-a', toCarrierId: 'carrier-c', reason: '也可以直接看应用' },
    { id: 'e3', fromCarrierId: 'carrier-b', toCarrierId: 'carrier-c', reason: '表示之后再应用' },
  ],
  conceptEdges: [
    { id: 'ce1', fromConceptId: 'n1', toConceptId: 'n2', reason: '有空间才有映射' },
    { id: 'ce2', fromConceptId: 'n2', toConceptId: 'n3', reason: '理解后再看矩阵' },
    { id: 'ce3', fromConceptId: 'n2', toConceptId: 'n4', reason: '也可以看应用' },
  ],
  entryConceptIds: ['n1'],
  terminalConceptIds: ['n4'],
}

test('R4 fork/join projects to a valid renderer document and keeps concept ids enterable', () => {
  assert.equal(parseAgentOutput('R4', route, { attachmentSourceIds: ['att-1'] }).ok, true)
  const projected = projectRouteToDocument(route)
  assert.equal(projected.ok, true)
  assert.equal(isLearningPathRendererDocument(projected.value.document), true)
  assert.ok(projected.value.document.structure.flow.length >= 3)
  assert.equal(projected.value.document.structure.concepts.length, 4)
  const goalIds = new Set(projected.value.document.structure.goalSubjectIds)
  assert.ok(projected.value.document.structure.concepts.every((item) => !goalIds.has(item.subjectId)))
  assert.ok(projected.value.document.data.actions.every((item) => item.href === undefined || item.resourceId))
  assert.ok(projected.value.document.data.resources.every((item) => item.href === '#session-learning'))
  assert.ok(projected.value.document.structure.flowGroups.some((item) => item.type === 'split'))
  assert.ok(projected.value.document.structure.flowGroups.some((item) => item.type === 'join'))
  const projectedFlow = projected.value.document.structure.flow.map((edge) => ({
    from: edge.fromSubjectId,
    to: edge.toSubjectId,
  }))
  assert.equal(hasSplitSiblingEdge(projectedFlow), false)
  assert.equal(hasUnbalancedSplitJoin(projectedFlow, projected.value.document.structure.goalSubjectIds), false)
  assert.ok(Object.keys(projected.value.wireIdByConceptId).includes('n2'))
})

test('a start fork with a sibling shortcut projects both lanes onto the same next carrier', () => {
  const forked = {
    ...route,
    routeId: '550e8400-e29b-41d4-a716-446655440001',
    carriers: [
      { id: 'carrier-math', title: '数学基础', description: '并列入口' },
      { id: 'carrier-code', title: '编程基础', description: '并列入口' },
      { id: 'carrier-graphics', title: '图形学', description: '汇合后继续' },
    ],
    concepts: [
      { id: 'n1', carrierId: 'carrier-math', title: '线性代数', hasDispute: false, detailedDescription: '先建立对象', attachmentSourceIds: [] },
      { id: 'n2', carrierId: 'carrier-code', title: '编程入门', hasDispute: false, detailedDescription: '先能写代码', attachmentSourceIds: [] },
      { id: 'n3', carrierId: 'carrier-graphics', title: '渲染管线', hasDispute: false, detailedDescription: '两路汇合后再学', attachmentSourceIds: [] },
    ],
    carrierEdges: [
      { id: 'e1', fromCarrierId: 'carrier-math', toCarrierId: 'carrier-code', reason: '旧投影会丢掉的直边' },
      { id: 'e2', fromCarrierId: 'carrier-code', toCarrierId: 'carrier-graphics', reason: '继续学图形学' },
    ],
    conceptEdges: [
      { id: 'ce1', fromConceptId: 'n1', toConceptId: 'n3', reason: '数学之后看渲染' },
      { id: 'ce2', fromConceptId: 'n2', toConceptId: 'n3', reason: '编程之后看渲染' },
    ],
    entryConceptIds: ['n1', 'n2'],
    terminalConceptIds: ['n3'],
  }
  const projected = projectRouteToDocument(forked)
  assert.equal(projected.ok, true)
  const subjects = Object.fromEntries(
    projected.value.document.structure.subjects.map((item) => {
      const card = projected.value.document.data.cards.find((entry) => entry.id === item.cardRef)
      return [card?.title ?? item.id, item.id]
    }),
  )
  const keys = new Set(projected.value.document.structure.flow.map((edge) => `${edge.fromSubjectId}->${edge.toSubjectId}`))
  const goalId = projected.value.document.structure.goalSubjectIds[0]
  assert.equal(keys.has(`${subjects['数学基础']}->${subjects['图形学']}`), true)
  assert.equal(keys.has(`${subjects['编程基础']}->${subjects['图形学']}`), true)
  assert.equal(keys.has(`${subjects['数学基础']}->${goalId}`), false)
  assert.equal(hasUnbalancedSplitJoin(projected.value.document.structure.flow.map((edge) => ({
    from: edge.fromSubjectId,
    to: edge.toSubjectId,
  })), projected.value.document.structure.goalSubjectIds), false)
})

test('R2 exploration objects are not published as renderer documents', () => {
  const exploration = { 线性代数: { 线性映射: { 争议: true } } }
  assert.equal(parseAgentOutput('R4', exploration).ok, false)
})
