import assert from 'node:assert/strict'
import test from 'node:test'
import { inferGrowKind } from './generate.ts'

test('asking for an example of a quoted span is parallel, not successor', () => {
  assert.equal(inferGrowKind('能给我举个例子吗', '基决定坐标，也决定线性变换的描述'), 'par')
  assert.equal(inferGrowKind('举个例子', '基不是坐标轴装饰'), 'par')
  assert.equal(inferGrowKind('', '向量空间不是一张画了箭头的图'), 'par')
})

test('explicit 1/2/3 still win over natural language', () => {
  assert.equal(inferGrowKind('2 举个例子', '引用'), 'succ')
  assert.equal(inferGrowKind('3 然后呢'), 'par')
  assert.equal(inferGrowKind('1 为什么先有基'), 'pred')
})

test('unquoted follow-ups stay on the trunk by default', () => {
  assert.equal(inferGrowKind('下一步怎么用矩阵表示'), 'succ')
  assert.equal(inferGrowKind('为什么先抓住基'), 'pred')
})
