import { useEffect, useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { KnowledgeCanvasPage } from '../pages/KnowledgeCanvas'
import { conceptTitle } from '../workspace/catalog'
import { readCanvasReturn, setActiveKnowledgeId } from '../workspace/nav'
import { blueprintOf, ensureMineKnowledgeFromCanonical, replayConceptGraph } from '../workspace/store'
import { requestCanonicalSnapshot } from '../session/request-canonical-answer'
import { requestGraphSnapshot } from '../session/request-graph-bootstrap'

function MineGraphUnavailable(props: { title: string; message: string }) {
  const returnTo = readCanvasReturn()
  return <ProductWorkspace active="knowledge" page="knowledge-detail">
    <main className="canvas-page">
      <header className="canvas-header">
        <div>
          <button type="button" aria-label="返回" onClick={() => {
            location.hash = returnTo === 'session-learning' ? 'session-learning' : 'knowledge'
          }}><Icon name="back" size={18}/></button>
          <span><small>知识脉络</small><strong>{props.title}</strong></span>
        </div>
      </header>
      <section className="thread-canvas" aria-label="知识脉络不可用" role="alert">
        <article className="square-empty">
          <strong>无法打开这次知识脉络</strong>
          <p>{props.message}</p>
        </article>
      </section>
    </main>
  </ProductWorkspace>
}

export function MineGraphCanvasPage({ routeId, conceptId }: { routeId: string; conceptId: string }) {
  const title = conceptTitle(blueprintOf(routeId), conceptId) || conceptId
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!routeId.trim() || !conceptId.trim()) return
    void Promise.all([
      requestGraphSnapshot({ routeId, conceptId }),
      requestCanonicalSnapshot({ routeId, conceptId }),
    ]).then(([graphResult, canonicalResult]) => {
      if (cancelled) return
      if (graphResult.kind !== 'completed') {
        setError({ title: graphResult.title, message: graphResult.message })
        return
      }
      if (canonicalResult.kind !== 'completed') {
        setError({ title: canonicalResult.title, message: canonicalResult.message })
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
        setError({ title, message: '已提交的知识脉络根节点必须绑定同一份首次回复，不能用结构占位或另一份正文代替。' })
        return
      }
      replayConceptGraph(routeId, conceptId)
      setActiveKnowledgeId(seeded.knowledgeId)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [conceptId, routeId, title])
  if (!routeId.trim() || !conceptId.trim()) {
    return <MineGraphUnavailable title="未选择学习概念" message="没有可进入的知识脉络。不能发明根节点。"/>
  }
  if (error) return <MineGraphUnavailable title={error.title} message={error.message}/>
  if (!ready) {
    return <ProductWorkspace active="knowledge" page="knowledge-detail">
      <main className="canvas-page">
        <section className="thread-canvas" role="status" aria-live="polite">
          <article className="square-empty">
            <strong>正在读取已提交的知识脉络</strong>
            <p>我的路线先读取已 settle 的首次回复和唯一根，再显示可缩放的知识脉络。</p>
          </article>
        </section>
      </main>
    </ProductWorkspace>
  }
  return <KnowledgeCanvasPage/>
}
