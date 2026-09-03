import type { FetchPort } from '@threadpeak/api-client'
import { requestGraphSnapshot } from '../session/request-graph-bootstrap.ts'
import { dropMineConceptGraph, readWorkspace, settledMineConceptIdsOf } from './store.ts'

export async function reconcileMineKnowledge(fetch?: FetchPort) {
  const items = readWorkspace().knowledge.filter((item) => item.owner !== 'example')
  await Promise.all(items.flatMap((item) => (
    settledMineConceptIdsOf(item).map(async (conceptId) => {
      const graph = await requestGraphSnapshot({
        routeId: item.routeId,
        conceptId,
        ...(fetch ? { fetch } : {}),
      })
      if (graph.kind === 'missing') dropMineConceptGraph(item.routeId, conceptId)
    })
  )))
}
