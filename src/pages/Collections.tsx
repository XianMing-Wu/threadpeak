import { useEffect, useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { RealPath3D } from '../components/Path3D'
import { KnowledgeCanvasPage } from './KnowledgeCanvas'
import { NAV_EVENT, openConceptKnowledge, openKnowledge, openRoute, readActiveKnowledgeId, readKnowledgeConceptId, readKnowledgeListReturn } from '../workspace/nav'
import { useLibrarySelector } from '../runtime/use-runtime-selector'
import { selectKnowledgeCards, selectRouteCards } from '../runtime/library-read-model'
import { getKnowledge, listConceptCards, useWorkspaceTick } from '../workspace/store'

export function KnowledgePage() {
  const [section, setSection] = useState<'mine' | 'example'>('mine')
  const items = useLibrarySelector(selectKnowledgeCards(section))
  return <ProductWorkspace active="knowledge" page="knowledge">
    <main className="knowledge-square">
      <header className="square-hero"><h1>知识脉络</h1><p>先按与路线一致的名称收纳，再进入每个最终概念自己的知识脉络</p></header>
      <div className="square-tabs">
        <button className={section === 'mine' ? 'is-active' : ''} onClick={() => setSection('mine')}>我的知识脉络</button>
        <button className={section === 'example' ? 'is-active' : ''} onClick={() => setSection('example')}>示例知识脉络</button>
      </div>
      <section className="knowledge-grid">
        {items.length === 0
          ? <div className="square-empty"><strong>还没有自己的知识脉络</strong><p>新建路线后，第一次点击进入学习并生成首段讲解时，才会同步出现在这里</p><button type="button" onClick={() => { location.hash = 'paths' }}>去看我的路线</button></div>
          : items.map((item) => <button className="knowledge-card" key={item.id} onClick={() => { openKnowledge(item.id); location.hash='knowledge-detail' }}>
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
    <main className="route-list">
      <header className="square-hero"><h1>路线规划</h1><p>从目标出发，把必要载体和最终概念组织成可以进入的学习路线</p></header>
      <div className="route-tabs">
        <button className={tab === 'mine' ? 'is-active' : ''} onClick={() => setTab('mine')}>我的路线</button>
        <button className={tab === 'example' ? 'is-active' : ''} onClick={() => setTab('example')}>示例路线</button>
      </div>
      <section className="route-grid">
        {shown.length === 0
          ? <div className="square-empty"><strong>还没有自己的路线</strong><p>在问山里用路线制定生成后，会出现在这里；知识脉络要等第一次进入学习才会同步生成</p><button type="button" onClick={() => { location.hash = 'home' }}>去问山制定路线</button></div>
          : shown.map((route) => <button key={route.id} className="route-card" onClick={() => { openRoute(route.id, 'paths'); location.hash='path-3d' }}>
            <span className="route-cover"><Icon name={route.icon} size={26}/></span>
            <span><strong>{route.title}</strong><p>{route.summary}</p><small>{route.owner === 'mine' ? '我的路线' : '示例路线'} · {route.carriers} 个载体 · {route.concepts} 个最终概念 · {route.duration}</small></span>
          </button>)}
      </section>
    </main>
  </ProductWorkspace>
}

export function Path3DPage() {
  return <ProductWorkspace active="paths" page="path-3d"><RealPath3D/></ProductWorkspace>
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
        <p>每个最终概念都有自己的知识脉络，不同概念的对话不会写进同一张画布</p>
      </header>
      <section className="knowledge-grid">
        {cards.length === 0
          ? <div className="square-empty"><strong>还没有概念脉络</strong><p>回到路线里第一次进入学习后，对应概念才会出现在这里</p><button type="button" onClick={() => { location.hash = 'paths' }}>去看我的路线</button></div>
          : cards.map((item) => <button className="knowledge-card" key={item.id} onClick={() => { openConceptKnowledge(knowledgeId, item.id); location.hash='knowledge-detail' }}>
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
  return conceptId ? <KnowledgeCanvasPage key={`${readActiveKnowledgeId()}:${conceptId}`}/> : <KnowledgeConceptsPage/>
}
