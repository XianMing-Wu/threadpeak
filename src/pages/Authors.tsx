import { useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { resolveAuthorNetwork } from '../session/resolve-author-network'
import { requestAuthorSearch, type AuthorSearchLiveResult } from '../session/request-author-search'
import { resolveAuthorSearch, type AuthorSearchResolution } from '../session/resolve-author-search'

type AuthorSection = 'search' | 'network'

const center = { x: 390, y: 236 }

function AuthorSearchUnavailable({ message }: { message?: string }) {
  const resolution = resolveAuthorSearch()
  return <section className="radar-search-status" role="alert">
    <small>博主搜索</small>
    <h2>{resolution.title}</h2>
    <p>{message || resolution.message}</p>
  </section>
}

function AuthorNetworkUnavailable() {
  const resolution = resolveAuthorNetwork()
  return <section className="radar-search-status" role="alert">
    <small>博主网络</small>
    <h2>{resolution.title}</h2>
    <p>{resolution.message}</p>
  </section>
}

export function AuthorsPage() {
  const [section, setSection] = useState<AuthorSection>('search')

  return <ProductWorkspace active="authors" page="authors">
    <main className="consultation-page">
      <header className="consultation-header">
        <h1>博主网络</h1>
        <p>{section === 'network' ? '已提交的博主关系会显示在这里。载体→概念→问题的分层还没有冻结，不能当成产品事实。' : '先查你的博主网络；没有相关作者时再检索知乎，最多 3 位，不凑数。'}</p>
      </header>
      <div className="square-tabs author-tabs">
        <button type="button" className={section === 'search' ? 'is-active' : ''} onClick={() => setSection('search')}>搜索博主</button>
        <button type="button" className={section === 'network' ? 'is-active' : ''} onClick={() => setSection('network')}>博主网络</button>
      </div>
      {section === 'search' ? <AuthorSearchPane /> : <AuthorNetworkPane />}
    </main>
  </ProductWorkspace>
}

function AuthorSearchPane() {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(true)
  const [resolution, setResolution] = useState<AuthorSearchResolution | null>(null)
  const [live, setLive] = useState<AuthorSearchLiveResult | null>(null)

  const openSearch = () => {
    setResolution(null)
    setLive(null)
    setQuery('')
    setSearchOpen(true)
  }

  const submitSearch = () => {
    if (!query.trim()) return
    const asked = query.trim()
    setQuery('')
    setSearchOpen(false)
    void requestAuthorSearch({ query: asked }).then((result) => {
      setLive(result)
      setResolution(result.kind === 'unavailable' ? result : null)
    })
  }

  return <section className="consultation-body">
    <section className="consultation-map-panel">
      <div className="consultation-map-wrap">
        <svg className="consultation-map" viewBox="0 0 780 470" role="img" aria-label="博主搜索">
          <defs>
            <radialGradient id="consultation-bg" cx="50%" cy="50%"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#f7f9fc"/></radialGradient>
          </defs>
          <rect width="780" height="470" rx="14" fill="url(#consultation-bg)"/>
          <g className="consultation-radar" aria-hidden="true">
            {[72, 142, 212].map((radius) => <circle key={radius} cx={center.x} cy={center.y} r={radius}/>)}
          </g>
        </svg>
        {searchOpen ? <form className="radar-query input-motion-frame" onSubmit={(event) => { event.preventDefault(); submitSearch() }}>
          <span className="input-motion-glow" aria-hidden="true"><span className="ambient-glow" /></span>
          <Icon name="search" size={20}/>
          <input autoFocus aria-label="输入想咨询博主的问题" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="你想找博主咨询什么？"/>
          <button type="button" aria-label="开始找博主" disabled={!query.trim()} onClick={submitSearch}><Icon name="send" size={19}/></button>
        </form> : <button
          className="radar-search-trigger"
          aria-label="输入问题找博主"
          onClick={openSearch}
        ><Icon name="search" size={24}/></button>}
      </div>
    </section>
    <aside className="consultation-sidebar">
      {live?.kind === 'results' ? <section className="radar-search-status" role="status">
        <small>{live.origin === 'network' ? '来自博主网络' : '来自知乎检索'}</small>
        <h2>找到 {live.names.length} 位相关博主</h2>
        <p>{live.names.join('、')}</p>
      </section> : live?.kind === 'empty' ? <section className="radar-search-status" role="status">
        <h2>没有相关博主</h2>
        <p>网络和知乎都没有可展示的相关作者，不会凑数。</p>
      </section> : resolution ? <AuthorSearchUnavailable message={resolution.message}/> : <section className="radar-search-status" aria-live="polite">
        <span className="radar-status-icon"><Icon name="network" size={21}/></span>
        <small>从一个具体问题开始</small>
        <h2>你想咨询谁，先由问题来决定</h2>
        <p>问题越具体，找到的博主和原文证据就越准确。发送后会走 network-first 检索；当前没有真实检索时会显式失败，不会用本地图谱或固定作者凑结果。</p>
      </section>}
    </aside>
  </section>
}

function AuthorNetworkPane() {
  return <section className="consultation-body is-network">
    <div className="author-network-pane">
      <AuthorNetworkUnavailable/>
    </div>
  </section>
}
