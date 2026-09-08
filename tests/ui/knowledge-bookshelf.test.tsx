import { expect, test } from 'vitest'
import { buildPathDocument } from '../../src/pathDocument'
import { buildKnowledgeShelves, searchKnowledgeShelves } from '../../src/ui/knowledge-shelves'
import type { ProductLibrary } from '@threadpeak/contracts/product-library'

const document = buildPathDocument({ id: 'shelf-document', title: '完成一个作品', description: '按目标学习', goalTitle: '完成作品', goalSummary: '可以展示', startSummary: '开始', carriers: [
  { id: 'first', title: '阅读论文', summary: '阅读载体', concepts: [['shape', '矩阵形状', '标注尺寸'], ['scale', '缩放因子', '理解分母']] },
  { id: 'second', title: '检验作品', summary: '作品载体', concepts: [['result', '输出结果', '检查结果']] },
] })
const concepts = document.structure.concepts
const library = (): ProductLibrary => ({ paths: [{ id: 'route-resource', goal: '完成一个作品', document, updatedAt: 1 }], knowledge: [
  { id: 'second-book', routeId: 'route-resource', conceptId: concepts[1].id, title: '缩放因子' },
  { id: 'first-book', routeId: 'route-resource', conceptId: concepts[0].id, title: '矩阵形状' },
], conversations: [] })
const examples = [{ id: 'example-knowledge', routeId: 'route-resource', title: document.metadata.title, document,
  concepts: [{ id: concepts[0].id, title: '矩阵形状', description: '编选讲解' }] }]

test('the unified shelf preserves real route and carrier order without inventing unlearned knowledge', () => {
  const shelves = buildKnowledgeShelves(library(), [])
  expect(shelves).toHaveLength(1)
  expect(shelves[0].books.map(book => book.title)).toEqual(['矩阵形状', '缩放因子'])
  expect(shelves[0].books.map(book => book.carrier)).toEqual(['阅读论文', '阅读论文'])
  expect(shelves[0].books[0].target).toEqual({ kind: 'resource', resourceId: 'first-book' })
  expect(shelves[0].books.some(book => book.conceptId === concepts[2].id)).toBe(false)
})
test('identically named personal and example routes keep distinct identities and navigation targets', () => {
  const shelves = buildKnowledgeShelves(library(), examples)
  expect(shelves).toHaveLength(2)
  expect(new Set(shelves.map(shelf => shelf.id)).size).toBe(2)
  expect(shelves[0].example).toBe(false)
  expect(shelves[1].example).toBe(true)
  expect(shelves[1].books[0].target).toEqual({ kind: 'example', knowledgeId: 'example-knowledge', conceptId: concepts[0].id })
})
test('an unambiguous document alias joins its resource route; orphaned resources remain readable', () => {
  const data = library()
  data.knowledge[0].routeId = document.id
  data.knowledge.push({ id: 'orphan', routeId: 'missing-route', conceptId: 'unknown', title: '仍然保存的笔记' })
  const shelves = buildKnowledgeShelves(data, [])
  expect(shelves).toHaveLength(2)
  expect(shelves[0].books).toHaveLength(2)
  expect(shelves[1].title).toBe('已保存的路线')
  expect(shelves[1].books[0].carrier).toBe('')
  expect(shelves[1].books[0].target).toEqual({ kind: 'resource', resourceId: 'orphan' })
})
test('ambiguous aliases do not assign a resource to an arbitrary route', () => {
  const data = library()
  data.paths.push({ ...data.paths[0], id: 'different-route' })
  data.knowledge = [{ ...data.knowledge[0], routeId: document.id }]
  const [shelf] = buildKnowledgeShelves(data, [])
  expect(shelf.routeId).toBe(document.id)
  expect(shelf.title).toBe('已保存的路线')
})
test('route and carrier search preserve grouping, concept search filters books, unavailable personal data stays separate', () => {
  const shelves = buildKnowledgeShelves(library(), examples)
  expect(searchKnowledgeShelves(shelves, '完成一个作品')).toHaveLength(2)
  expect(searchKnowledgeShelves(shelves, '阅读论文')[0].books).toHaveLength(2)
  expect(searchKnowledgeShelves(shelves, '缩放因子')[0].books).toHaveLength(1)
  const noMatches = searchKnowledgeShelves(shelves, '找不到的内容')
  expect(noMatches.map(shelf => shelf.id)).toEqual(shelves.map(shelf => shelf.id))
  expect(noMatches.every(shelf => shelf.books.length === 0)).toBe(true)
  expect(buildKnowledgeShelves(undefined, examples).every(shelf => shelf.example)).toBe(true)
  expect(library().knowledge).toHaveLength(2)
})
