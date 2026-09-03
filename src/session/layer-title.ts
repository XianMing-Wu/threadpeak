export function isInternalLayerId(value: string) {
  const text = value.trim()
  if (!text) return true
  if (/[\u4e00-\u9fff]/.test(text)) return false
  if (/\s/.test(text)) return false
  if (/uuid/i.test(text)) return true
  if (/^(s-)?(carrier|concept|subject|node|card)([-_]|$)/i.test(text)) return true
  return /^[a-z]{1,8}-[a-z0-9-]{6,}$/i.test(text)
}

export function readableLayerTitle(title: string | undefined, fallbackId = '') {
  const text = title?.trim() ?? ''
  if (text && !isInternalLayerId(text)) return text
  const fallback = fallbackId.trim()
  if (fallback && !isInternalLayerId(fallback)) return fallback
  return ''
}

type LayerCard = { id?: string; title?: string; summary?: string }
type LayerRef = { id?: string; cardRef?: string; subjectId?: string }

export type PathLayerDocument = {
  structure?: {
    subjects?: readonly LayerRef[]
    concepts?: readonly LayerRef[]
  }
  data?: {
    cards?: readonly LayerCard[]
  }
}

function cardTitle(cards: readonly LayerCard[], cardRef: string | undefined) {
  if (!cardRef) return ''
  const card = cards.find((item) => item.id === cardRef)
  return readableLayerTitle(card?.title) || readableLayerTitle(card?.summary)
}

export function titleFromPathLayer(document: PathLayerDocument | undefined, layerId: string) {
  const id = layerId.trim()
  if (!document || !id) return ''
  const cards = document.data?.cards ?? []
  const subject = document.structure?.subjects?.find((item) => item.id === id)
  const fromSubject = cardTitle(cards, subject?.cardRef)
  if (fromSubject) return fromSubject
  const concept = document.structure?.concepts?.find((item) => item.id === id)
  const fromConcept = cardTitle(cards, concept?.cardRef)
  if (fromConcept) return fromConcept
  return cardTitle(cards, id)
}

export function carrierTitleFromConcept(
  document: PathLayerDocument | undefined,
  conceptId?: string,
  conceptTitle?: string,
) {
  if (!document) return ''
  const concepts = document.structure?.concepts ?? []
  const cards = document.data?.cards ?? []
  const wantedId = conceptId?.trim() ?? ''
  const wantedTitle = readableLayerTitle(conceptTitle)
  const hit = concepts.find((item) => wantedId && item.id === wantedId)
    ?? concepts.find((item) => wantedTitle && cardTitle(cards, item.cardRef) === wantedTitle)
  return hit?.subjectId ? titleFromPathLayer(document, hit.subjectId) : ''
}
