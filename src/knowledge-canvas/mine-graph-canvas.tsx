import { useEffect, useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { conceptAccent, conceptTitle } from '../workspace/catalog'
import { readCanvasReturn } from '../workspace/nav'
import { blueprintOf } from '../workspace/store'
import { projectBootstrappedGraph } from './project-bootstrapped-graph'
import { requestGraphSnapshot, type GraphSnapshot } from '../session/request-graph-bootstrap'

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
  const returnTo = readCanvasReturn()
  const [graph, setGraph] = useState<GraphSnapshot | null>(null)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!routeId.trim() || !conceptId.trim()) return
    void requestGraphSnapshot({ routeId, conceptId }).then((result) => {
      if (cancelled) return
      if (result.kind !== 'completed') {
        setError({ title: result.title, message: result.message })
        return
      }
      setGraph(result.graph)
    })
    return () => { cancelled = true }
  }, [conceptId, routeId])
  if (!routeId.trim() || !conceptId.trim()) {
    return <MineGraphUnavailable title="未选择学习概念" message="没有可进入的知识脉络。不能发明根节点。"/>
  }
  if (error) return <MineGraphUnavailable title={error.title} message={error.message}/>
  if (!graph) {
    return <ProductWorkspace active="knowledge" page="knowledge-detail">
      <main className="canvas-page">
        <section className="thread-canvas" role="status" aria-live="polite">
          <article className="square-empty">
            <strong>正在读取已提交的知识脉络</strong>
            <p>我的路线只渲染 GraphSurgeon 提交的 graph/root，不会用 growGraph 发明节点。</p>
          </article>
        </section>
      </main>
    </ProductWorkspace>
  }
  const view = projectBootstrappedGraph(graph, conceptAccent(blueprintOf(routeId), conceptId))
  const root = view.nodes[0]
  if (!root) return <MineGraphUnavailable title={title} message="已提交的知识脉络缺少唯一根节点。"/>
  return <ProductWorkspace active="knowledge" page="knowledge-detail">
    <main className="canvas-page">
      <header className="canvas-header">
        <div>
          <button type="button" aria-label="返回" onClick={() => {
            location.hash = returnTo === 'session-learning' ? 'session-learning' : 'knowledge'
          }}><Icon name="back" size={18}/></button>
          <span><small>知识脉络</small><strong>{root.title}</strong></span>
        </div>
        {returnTo === 'session-learning' && <div className="canvas-header-actions">
          <button type="button" className="canvas-back-chat" onClick={() => { location.hash = 'session-learning' }}>
            <Icon name="message" size={17}/>回到对话
          </button>
        </div>}
      </header>
      <section className="thread-canvas" aria-label="只读画布，可拖拽浏览的知识脉络">
        <article className="thread-node is-selected" data-id={root.id} style={{ position: 'relative', left: 48, top: 36, '--accent': root.accent } as React.CSSProperties}>
          <header className="node-heading"><strong>{root.title}</strong></header>
          {root.turns.map((turn) => (
            <section key={turn.question} className={`node-turn is-${turn.replyKind}`}>
              <p className="node-question">{turn.question}</p>
              <div className="node-reply">
                {turn.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </article>
      </section>
    </main>
  </ProductWorkspace>
}
