import { useEffect, useState } from 'react'
import { StatusOrbChip } from '../components/StatusOrb'
import { ProductWorkspace } from '../components/Shell'
import { KnowledgeCanvasPage } from '../pages/KnowledgeCanvas'
import { conceptTitle } from '../workspace/catalog'
import { closeConceptKnowledge, setActiveKnowledgeId } from '../workspace/nav'
import { blueprintOf, dropMineConceptGraph, ensureMineKnowledgeFromCanonical, getKnowledgeByRoute, listConceptCards, replayConceptGraph } from '../workspace/store'
import { requestCanonicalSnapshot } from '../session/request-canonical-answer'
import { requestGraphSnapshot } from '../session/request-graph-bootstrap'

function leaveMineGraph(routeId: string, conceptId: string, drop: boolean) {
  if (drop) dropMineConceptGraph(routeId, conceptId)
  closeConceptKnowledge()
  const knowledge = getKnowledgeByRoute(routeId)
  location.hash = knowledge && listConceptCards(knowledge.id).length > 0
    ? 'knowledge-detail'
    : 'knowledge'
}

export function MineGraphCanvasPage({ routeId, conceptId }: { routeId: string; conceptId: string }) {
  const title = conceptTitle(blueprintOf(routeId), conceptId) || conceptId
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (!routeId.trim() || !conceptId.trim()) {
      closeConceptKnowledge()
      location.hash = 'knowledge'
      return
    }
    void Promise.all([
      requestGraphSnapshot({ routeId, conceptId }),
      requestCanonicalSnapshot({ routeId, conceptId }),
    ]).then(([graphResult, canonicalResult]) => {
      if (cancelled) return
      if (graphResult.kind === 'missing' || canonicalResult.kind === 'missing') {
        leaveMineGraph(routeId, conceptId, true)
        return
      }
      if (graphResult.kind !== 'completed' || canonicalResult.kind !== 'completed') {
        leaveMineGraph(routeId, conceptId, false)
        return
      }
      const seeded = ensureMineKnowledgeFromCanonical({
        routeId,
        conceptId,
        title,
        text: canonicalResult.text,
        contentHash: canonicalResult.contentHash,
        graph: graphResult.graph,
      })
      if (!seeded) {
        leaveMineGraph(routeId, conceptId, true)
        return
      }
      replayConceptGraph(routeId, conceptId)
      setActiveKnowledgeId(seeded.knowledgeId)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [conceptId, routeId, title])
  if (!routeId.trim() || !conceptId.trim() || !ready) {
    return <ProductWorkspace active="knowledge" page="knowledge-detail">
      <main className="canvas-page">
        <section className="thread-canvas" role="status" aria-live="polite">
          <article className="square-empty">
            <StatusOrbChip label="正在读取知识脉络"/>
          </article>
        </section>
      </main>
    </ProductWorkspace>
  }
  return <KnowledgeCanvasPage/>
}
