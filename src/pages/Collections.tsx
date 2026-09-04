import { useEffect, useState } from 'react'
import { EmptyStatus } from '../components/EmptyStatus'
import { PeakHero } from '../components/PeakHero'
import { PeakTabs } from '../components/PeakTabs'
import { ProductWorkspace } from '../components/Shell'
import { StatusOrbChip } from '../components/StatusOrb'
import { Icon } from '../icons'
import { Path3DStage } from '../path-3d/path-3d-stage'
import { KnowledgeCanvasPage } from './KnowledgeCanvas'
import { closeConceptKnowledge, NAV_EVENT, openConceptKnowledge, openKnowledge, openRoute, readActiveKnowledgeId, readActiveRouteId, readKnowledgeConceptId, readKnowledgeListReturn } from '../workspace/nav'
import { useLibrarySelector } from '../runtime/use-library-selector'
import { selectKnowledgeCards, selectRouteCards } from '../runtime/library-read-model'
import { getConceptGraph, getKnowledge, getKnowledgeByRoute, getRoute, hasSettledMineConceptGraph, listConceptCards, useWorkspaceTick } from '../workspace/store'
import { reconcileMineKnowledge } from '../workspace/reconcile-mine-knowledge'
import { MineGraphCanvasPage } from '../knowledge-canvas/mine-graph-canvas'

export function KnowledgePage() {
  const [section, setSection] = useState<'mine' | 'example'>('mine')
  const [mineReady, setMineReady] = useState(false)
  const items = useLibrarySelector(selectKnowledgeCards(section))
  useEffect(() => {
    let cancelled = false
    void reconcileMineKnowledge().finally(() => {
      if (!cancelled) setMineReady(true)
    })
    return () => { cancelled = true }
  }, [])
  const shown = section === 'mine' && !mineReady ? [] : items
  return <ProductWorkspace active="knowledge" page="knowledge">
    <main className="knowledge-square peak-market">
      <PeakHero title="知识脉络" sub="按路线收纳，再进入每个概念自己的脉络。" />
      <PeakTabs
        items={[
          { id: 'mine', label: '我的知识脉络', icon: 'users' },
          { id: 'example', label: '示例知识脉络', icon: 'book' },
        ]}
        active={section}
        onChange={setSection}
      />
      <section className="knowledge-grid">
        {section === 'mine' && !mineReady
          ? <div className="square-empty" role="status" aria-live="polite"><StatusOrbChip label="正在读取知识脉络"/></div>
          : shown.length === 0
          ? <div className="square-empty"><EmptyStatus kind="empty" title="还没有自己的知识脉络" body="制定路线并开始学习后，会出现在这里。" action="去看我的路线" onAction={() => { location.hash = 'paths' }} /></div>
          : shown.map((item) => <button className="knowledge-card" key={item.id} onClick={() => { openKnowledge(item.id) }}>
            <span className="knowledge-cover"><Icon name={item.icon} size={26}/></span>
            <span><strong>{item.title}</strong><p>{item.description}</p><small>{item.type} · {item.sources} 个来源</small></span>
          </button>)}
      </section>
    </main>
  </ProductWorkspace>
}

export function PathsPage() {
  const [tab, setTab] = useState<'mine' | 'example'>('mine')
  const shown = useLibrarySelector(selectRouteCards(tab))
  return <ProductWorkspace active="paths" page="paths">
    <main className="route-list peak-market">
      <PeakHero title="路线规划" sub="从目标出发，把学习内容组织成可以进入的路线。" />
      <PeakTabs
        items={[
          { id: 'mine', label: '我的路线', icon: 'users' },
          { id: 'example', label: '示例路线', icon: 'book' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <section className="route-grid">
        {shown.length === 0
          ? <div className="square-empty"><EmptyStatus kind="empty" title="还没有自己的路线" body="在首页制定路线后，会出现在这里。" action="去问山制定路线" onAction={() => { sessionStorage.setItem('threadpeak-home-select-route', '1'); location.hash = 'home' }} /></div>
          : shown.map((route) => <button key={route.id} className="route-card" onClick={() => { openRoute(route.id, 'paths'); location.hash='path-3d' }}>
            <span className="route-cover"><Icon name={route.icon} size={26}/></span>
            <span><strong>{route.title}</strong><p>{route.summary}</p><small>{route.owner === 'mine' ? '我的路线' : '示例路线'} · {route.carriers} 个载体 · {route.concepts} 个最终概念 · {route.duration}</small></span>
          </button>)}
      </section>
    </main>
  </ProductWorkspace>
}

export function Path3DPage() {
  return <ProductWorkspace active="paths" page="path-3d"><Path3DStage/></ProductWorkspace>
}

export function KnowledgeConceptsPage() {
  useWorkspaceTick()
  const knowledgeId = readActiveKnowledgeId()
  const knowledge = knowledgeId ? getKnowledge(knowledgeId) : undefined
  const cards = knowledgeId ? listConceptCards(knowledgeId) : []
  return <ProductWorkspace active="knowledge" page="knowledge-detail">
    <main className="knowledge-square">
      <header className="square-hero">
        <div className="square-heading">
          <button type="button" className="lesson-back" aria-label="返回上一级" onClick={() => { location.hash = readKnowledgeListReturn() }}><Icon name="back" size={18}/></button>
          <div><small>知识脉络</small><h1>{knowledge?.title ?? '知识脉络'}</h1></div>
        </div>
        <p>每个概念都有自己的脉络，对话不会混在一起。</p>
      </header>
      <section className="knowledge-grid">
        {cards.length === 0
          ? <div className="square-empty"><EmptyStatus kind="empty" title="还没有概念脉络" body="进入学习后，相关概念会出现在这里。" action="去看我的路线" onAction={() => { location.hash = 'paths' }} /></div>
          : cards.map((item) => <button className="knowledge-card" key={item.id} onClick={() => { openConceptKnowledge(knowledgeId, item.id) }}>
            <span className="knowledge-cover"><Icon name={item.icon} size={26}/></span>
            <span><strong>{item.title}</strong><p>{item.description}</p><small>最终概念 · {item.type} · {item.sources} 个来源</small></span>
          </button>)}
      </section>
    </main>
  </ProductWorkspace>
}

export function KnowledgeDetailPage() {
  const [conceptId, setConceptId] = useState(readKnowledgeConceptId)
  useEffect(() => {
    const sync = () => setConceptId(readKnowledgeConceptId())
    addEventListener(NAV_EVENT, sync)
    addEventListener('storage', sync)
    return () => {
      removeEventListener(NAV_EVENT, sync)
      removeEventListener('storage', sync)
    }
  }, [])
  useEffect(() => {
    if (!conceptId) return
    const knowledgeId = readActiveKnowledgeId()
    const knowledge = knowledgeId ? getKnowledge(knowledgeId) : undefined
    const route = getRoute(readActiveRouteId())
    const owner = route?.owner || knowledge?.owner
    if (owner === 'example') return
    if (owner === 'mine' && knowledgeId && hasSettledMineConceptGraph(getConceptGraph(knowledgeId, conceptId))) return
    closeConceptKnowledge()
    const remaining = knowledge ?? getKnowledgeByRoute(readActiveRouteId())
    if (owner !== 'mine' || !remaining || listConceptCards(remaining.id).length === 0) location.hash = 'knowledge'
  }, [conceptId])
  if (!conceptId) return <KnowledgeConceptsPage/>
  const routeId = readActiveRouteId()
  const knowledge = getKnowledge(readActiveKnowledgeId())
  const route = getRoute(routeId)
  const owner = route?.owner || knowledge?.owner
  if (owner === 'mine') {
    const knowledgeId = readActiveKnowledgeId()
    if (!knowledgeId || !hasSettledMineConceptGraph(getConceptGraph(knowledgeId, conceptId))) {
      return <KnowledgeConceptsPage/>
    }
    return <MineGraphCanvasPage key={`${routeId}:${conceptId}`} routeId={routeId} conceptId={conceptId}/>
  }
  if (owner === 'example') {
    return <KnowledgeCanvasPage key={`${readActiveKnowledgeId()}:${conceptId}`}/>
  }
  return <KnowledgeConceptsPage/>
}
