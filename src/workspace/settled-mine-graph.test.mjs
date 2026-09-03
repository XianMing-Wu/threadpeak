import assert from 'node:assert/strict'
import test from 'node:test'
import { hasSettledMineConceptGraph } from './settled-mine-graph.ts'

test('empty or placeholder roots are not settled mine graphs', () => {
  assert.equal(hasSettledMineConceptGraph(undefined), false)
  assert.equal(hasSettledMineConceptGraph({ nodes: [] }), false)
  assert.equal(hasSettledMineConceptGraph({
    nodes: [{
      id: 'root',
      turns: [{ paragraphs: [''] }],
    }],
  }), false)
  assert.equal(hasSettledMineConceptGraph({
    nodes: [{
      id: 'root',
      turns: [{ paragraphs: ['这是你第一次进入这条路线，而不是套用别的路线的讲稿。'] }],
    }],
  }), false)
})

test('a root with real first-answer paragraphs is settled', () => {
  assert.equal(hasSettledMineConceptGraph({
    nodes: [{
      id: 'root',
      turns: [{ paragraphs: ['这是一份已经整理好的首次回复。'] }],
    }],
  }), true)
})
