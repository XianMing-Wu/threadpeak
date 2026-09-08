import type { ProductLibrary } from '@threadpeak/contracts/product-library'
import type { LearningPathDocument } from '@threadpeak/contracts/path-document'

export type KnowledgeBook = {
  id: string
  title: string
  description: string
  carrier: string
  conceptId: string
  target: { kind: 'resource'; resourceId: string } | { kind: 'example'; knowledgeId: string; conceptId: string }
}
export type KnowledgeShelf = { id: string; routeId: string; title: string; example: boolean; books: KnowledgeBook[] }
export type ExampleShelfSource = {
  id: string
  routeId: string
  title: string
  document?: LearningPathDocument
  concepts: readonly { id: string; title: string; description: string }[]
}

function conceptPositions(document?: LearningPathDocument) {
  const cards = new Map(document?.data.cards.map(card => [card.id, card]))
  const subjects = [...(document?.structure.subjects ?? [])].sort((a, b) => (a.orderHint ?? 0) - (b.orderHint ?? 0))
  return new Map(subjects.flatMap(subject => [...(document?.structure.concepts ?? [])]
    .filter(concept => concept.subjectId === subject.id)
    .sort((a, b) => (a.orderHint ?? 0) - (b.orderHint ?? 0))
    .map(concept => ({ id: concept.id, carrier: cards.get(subject.cardRef)?.title ?? '', description: cards.get(concept.cardRef)?.summary ?? '' })))
    .map((concept, order) => [concept.id, { ...concept, order }]))
}

/** Group existing resources by their real route IDs; never create knowledge from an unlearned route. */
export function buildKnowledgeShelves(library: ProductLibrary | undefined, examples: readonly ExampleShelfSource[]): KnowledgeShelf[] {
  const shelves: KnowledgeShelf[] = []
  const groups = new Map<string, NonNullable<ProductLibrary>['knowledge']>()
  for (const resource of library?.knowledge ?? []) {
    const aliases = library?.paths.filter(path => path.document.id === resource.routeId) ?? []
    const route = library?.paths.find(path => path.id === resource.routeId)
      ?? (aliases.length === 1 ? aliases[0] : undefined)
    const key = route?.id ?? resource.routeId
    const group = groups.get(key) ?? []
    group.push(resource)
    groups.set(key, group)
  }
  for (const [routeId, resources] of groups) {
    const route = library?.paths.find(path => path.id === routeId)
    const positions = conceptPositions(route?.document)
    const books = [...resources].sort((a, b) => (positions.get(a.conceptId)?.order ?? Infinity) - (positions.get(b.conceptId)?.order ?? Infinity))
      .map(resource => ({ id: `resource:${resource.id}`, title: resource.title, conceptId: resource.conceptId,
        carrier: positions.get(resource.conceptId)?.carrier ?? '', description: positions.get(resource.conceptId)?.description ?? '',
        target: { kind: 'resource' as const, resourceId: resource.id } }))
    shelves.push({ id: `mine:${routeId}`, routeId, title: route?.document.metadata.title || route?.goal || '已保存的路线', example: false, books })
  }
  for (const example of examples) {
    const positions = conceptPositions(example.document)
    const books = [...example.concepts].sort((a, b) => (positions.get(a.id)?.order ?? Infinity) - (positions.get(b.id)?.order ?? Infinity))
      .map(concept => ({ id: `example:${example.id}:${concept.id}`, title: concept.title, description: concept.description,
        carrier: positions.get(concept.id)?.carrier ?? '', conceptId: concept.id,
        target: { kind: 'example' as const, knowledgeId: example.id, conceptId: concept.id } }))
    if (books.length) shelves.push({ id: `example:${example.routeId}`, routeId: example.routeId, title: example.title, example: true, books })
  }
  return shelves
}

export function searchKnowledgeShelves(shelves: readonly KnowledgeShelf[], query: string): KnowledgeShelf[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return [...shelves]
  return shelves.map(shelf => {
    const books = shelf.title.toLocaleLowerCase().includes(term) ? shelf.books : shelf.books.filter(book =>
      `${book.title} ${book.carrier} ${book.description}`.toLocaleLowerCase().includes(term))
    return { ...shelf, books }
  })
}
