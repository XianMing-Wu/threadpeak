import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasSplitSiblingEdge,
  hasUnbalancedSplitJoin,
  stabilizeHostSubjectDrafts,
} from './host-subject-flow.ts'
import { repairHostDocument } from './repair-host-document.ts'
import { validRendererDocumentFixture, validateRendererDocument } from './validate-renderer-document.ts'

test('diamond drafts drop the sibling edge and join both branches at the same next node', () => {
  const drafts = stabilizeHostSubjectDrafts([
    { from: 'start', to: 'a' },
    { from: 'start', to: 'b' },
    { from: 'a', to: 'b' },
    { from: 'b', to: 'goal' },
  ], 'start', 'goal', ['start', 'a', 'b', 'goal'])
  assert.deepEqual(drafts, [
    { from: 'start', to: 'a' },
    { from: 'start', to: 'b' },
    { from: 'b', to: 'goal' },
    { from: 'a', to: 'goal' },
  ])
  assert.equal(hasSplitSiblingEdge(drafts), false)
  assert.equal(hasUnbalancedSplitJoin(drafts), false)
})

test('a parallel fork joins at the continuing node instead of skipping to the goal', () => {
  const drafts = stabilizeHostSubjectDrafts([
    { from: 'start', to: 'math' },
    { from: 'start', to: 'code' },
    { from: 'math', to: 'code' },
    { from: 'code', to: 'graphics' },
    { from: 'graphics', to: 'goal' },
  ], 'start', 'goal', ['start', 'math', 'code', 'graphics', 'goal'])
  assert.deepEqual(new Set(drafts.map((edge) => `${edge.from}->${edge.to}`)), new Set([
    'start->math',
    'start->code',
    'math->graphics',
    'code->graphics',
    'graphics->goal',
  ]))
  assert.equal(hasSplitSiblingEdge(drafts), false)
  assert.equal(hasUnbalancedSplitJoin(drafts), false)
})

test('renderer validation rejects an authored edge between split siblings', () => {
  const fixture = validRendererDocumentFixture('diamond-path')
  const diamond = {
    ...fixture,
    structure: {
      ...fixture.structure,
      subjects: [
        ...fixture.structure.subjects,
        { id: 'subject-alt', cardRef: 'card-alt', orderHint: 4 },
      ],
      flow: [
        {
          id: 'flow-start-core',
          fromSubjectId: 'subject-start',
          toSubjectId: 'subject-core',
          semantics: { splitGroupId: 'fg-split-start' },
        },
        {
          id: 'flow-start-alt',
          fromSubjectId: 'subject-start',
          toSubjectId: 'subject-alt',
          semantics: { splitGroupId: 'fg-split-start', joinGroupId: 'fg-join-alt' },
        },
        {
          id: 'flow-core-alt',
          fromSubjectId: 'subject-core',
          toSubjectId: 'subject-alt',
          semantics: { joinGroupId: 'fg-join-alt' },
        },
        { id: 'flow-alt-goal', fromSubjectId: 'subject-alt', toSubjectId: 'subject-goal' },
      ],
      flowGroups: [
        { id: 'fg-split-start', type: 'split', anchorSubjectId: 'subject-start', policy: 'parallel' },
        { id: 'fg-join-alt', type: 'join', anchorSubjectId: 'subject-alt', policy: 'all-required' },
      ],
    },
    data: {
      ...fixture.data,
      cards: [...fixture.data.cards, { id: 'card-alt', title: '并行载体', summary: '另一条推荐入口。' }],
    },
  }
  const validated = validateRendererDocument(diamond)
  assert.equal(validated.ok, false)
  assert.ok(validated.issues.includes('structure.flow.split-sibling-edge'))
  const repaired = repairHostDocument(diamond)
  const after = validateRendererDocument(repaired)
  assert.equal(after.ok, true)
  const repairedFlow = after.document.structure.flow.map((edge) => ({
    from: edge.fromSubjectId,
    to: edge.toSubjectId,
  }))
  assert.equal(hasSplitSiblingEdge(repairedFlow), false)
  assert.equal(hasUnbalancedSplitJoin(repairedFlow, ['subject-goal']), false)
})

test('a published shortcut from one fork lane to the goal is rejected then joined at the continuing node', () => {
  const fixture = validRendererDocumentFixture('shortcut-path')
  const shortcut = {
    ...fixture,
    structure: {
      ...fixture.structure,
      subjects: [
        { id: 'subject-start', cardRef: 'card-start', orderHint: 1 },
        { id: 'subject-math', cardRef: 'card-math', orderHint: 2 },
        { id: 'subject-code', cardRef: 'card-code', orderHint: 3 },
        { id: 'subject-graphics', cardRef: 'card-graphics', orderHint: 4 },
        { id: 'subject-goal', cardRef: 'card-goal', orderHint: 5 },
      ],
      concepts: [
        {
          id: 'concept-start',
          subjectId: 'subject-graphics',
          cardRef: 'card-concept',
          actionRef: 'action-concept',
          orderHint: 1,
        },
      ],
      flow: [
        {
          id: 'flow-start-math',
          fromSubjectId: 'subject-start',
          toSubjectId: 'subject-math',
          semantics: { splitGroupId: 'fg-split-start' },
        },
        {
          id: 'flow-start-code',
          fromSubjectId: 'subject-start',
          toSubjectId: 'subject-code',
          semantics: { splitGroupId: 'fg-split-start' },
        },
        { id: 'flow-math-goal', fromSubjectId: 'subject-math', toSubjectId: 'subject-goal' },
        { id: 'flow-code-graphics', fromSubjectId: 'subject-code', toSubjectId: 'subject-graphics' },
        { id: 'flow-graphics-goal', fromSubjectId: 'subject-graphics', toSubjectId: 'subject-goal' },
      ],
      flowGroups: [
        { id: 'fg-split-start', type: 'split', anchorSubjectId: 'subject-start', policy: 'parallel' },
      ],
    },
    data: {
      ...fixture.data,
      cards: [
        ...fixture.data.cards,
        { id: 'card-math', title: '数学基础', summary: '并列入口。' },
        { id: 'card-code', title: '编程基础', summary: '并列入口。' },
        { id: 'card-graphics', title: '图形学', summary: '两路汇合后继续。' },
      ],
    },
  }
  const validated = validateRendererDocument(shortcut)
  assert.equal(validated.ok, false)
  assert.ok(validated.issues.includes('structure.flow.split-unbalanced-join'))
  const repaired = repairHostDocument(shortcut)
  const after = validateRendererDocument(repaired)
  assert.equal(after.ok, true)
  const keys = new Set(after.document.structure.flow.map((edge) => `${edge.fromSubjectId}->${edge.toSubjectId}`))
  assert.equal(keys.has('subject-math->subject-graphics'), true)
  assert.equal(keys.has('subject-code->subject-graphics'), true)
  assert.equal(keys.has('subject-math->subject-goal'), false)
  assert.equal(hasUnbalancedSplitJoin(after.document.structure.flow.map((edge) => ({
    from: edge.fromSubjectId,
    to: edge.toSubjectId,
  })), after.document.structure.goalSubjectIds), false)
})
