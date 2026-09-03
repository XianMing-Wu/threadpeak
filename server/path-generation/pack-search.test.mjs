import assert from 'node:assert/strict'
import test from 'node:test'
import { joinSearchTexts, packPathSearchQueries } from './pack-search.ts'

test('joinSearchTexts concatenates with spaces and stops before 200 characters', () => {
  assert.equal(joinSearchTexts(['入门', '基础']), '入门 基础')
  const first = '机器学习数学怎么入门'.repeat(20)
  const packed = joinSearchTexts([first, '机器学习需要哪些数学基础'])
  assert.ok(packed.length <= 200)
  assert.equal(packed, first.slice(0, 200))
})

test('packPathSearchQueries keeps two angle packs and does not collapse to one', () => {
  const queries = [
    { id: 'q1', text: '怎么入门', angle: 'normal_learning' },
    { id: 'q2', text: '需要哪些基础', angle: 'normal_learning' },
    { id: 'q3', text: '常见坑', angle: 'pitfall_or_dispute' },
    { id: 'q4', text: '容易误导的学法', angle: 'pitfall_or_dispute' },
  ]
  const packs = packPathSearchQueries(queries, 2)
  assert.equal(packs.length, 2)
  assert.equal(packs[0].query, '怎么入门 需要哪些基础')
  assert.deepEqual(packs[0].sourceIds, ['q1', 'q2'])
  assert.equal(packs[1].query, '常见坑 容易误导的学法')
  assert.deepEqual(packs[1].sourceIds, ['q3', 'q4'])
})

test('packPathSearchQueries only expands into one search when asked', () => {
  const queries = [
    { id: 'q1', text: '怎么入门', angle: 'normal_learning' },
    { id: 'q2', text: '常见坑', angle: 'pitfall_or_dispute' },
  ]
  const packs = packPathSearchQueries(queries, 1)
  assert.equal(packs.length, 1)
  assert.equal(packs[0].query, '怎么入门 常见坑')
})

test('three queries without angles pack into two space-joined searches', () => {
  const packs = packPathSearchQueries([
    { id: 'q1', text: '线性映射为什么要保持加法' },
    { id: 'q2', text: '线性映射可加性是什么意思' },
    { id: 'q3', text: '线性映射同时保持加法与数乘' },
  ], 2)
  assert.equal(packs.length, 2)
  assert.equal(packs[0].query, '线性映射为什么要保持加法 线性映射可加性是什么意思')
  assert.equal(packs[1].query, '线性映射同时保持加法与数乘')
})
