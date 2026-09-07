import { useEffect, useMemo, useState } from 'react'
import { AuthorNetworkGraph } from '../components/AuthorNetworkGraph'
import { PeakHero } from '../components/PeakHero'
import { PeakTabs } from '../components/PeakTabs'
import { EmptyStatus } from '../components/EmptyStatus'
import { StatusOrbChip } from '../components/StatusOrb'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { projectAuthorNetworkGraph } from '../session/project-author-network'
import { readWorkspace } from '../workspace/store'
import { requestAuthorNetwork, type AuthorNetworkLiveResult } from '../session/request-author-network'
import { resolveAuthorNetwork } from '../session/resolve-author-network'
import { requestAuthorSearch, type AuthorSearchLiveResult } from '../session/request-author-search'
import { resolveAuthorSearch, type AuthorSearchResolution } from '../session/resolve-author-search'

type AuthorSection = 'search' | 'network'

const center = { x: 390, y: 236 }

function originLabel(origin: 'high-weight' | 'low-weight' | 'zhihu') {
  if (origin === 'high-weight') return '问过的'
  if (origin === 'low-weight') return '新发现'
  return '知乎'
}

function AuthorSearchUnavailable({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const resolution = resolveAuthorSearch()
  return <section className="radar-search-status" role="alert">
    <EmptyStatus
      kind="error"
      eyebrow="博主搜索"
      title={resolution.title}
      body={message || resolution.message}
      action="重试"
      onAction={onRetry}
    />
  </section>
}

function AuthorNetworkUnavailable({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const resolution = resolveAuthorNetwork()
  return <section className="radar-search-status" role="alert">
    <EmptyStatus
      kind="error"
      eyebrow="博主网络"
      title={resolution.title}
      body={message || resolution.message}
      action="重试"
      onAction={onRetry}
    />
  </section>
}

export function AuthorsPage() {
  const [section, setSection] = useState<AuthorSection>('search')

  return <ProductWorkspace active="authors" page="authors">
    <main className="consultation-page peak-market">
      <PeakHero
        title="博主网络"
        sub={section === 'network' ? '看看已经和你建立联系的博主。' : '从你的问题出发，找到值得请教的博主。'}
      />
      <PeakTabs
        items={[
          { id: 'search', label: '搜索博主', icon: 'search' },
          { id: 'network', label: '博主网络', icon: 'network' },
        ]}
        active={section}
        onChange={setSection}
      />
      {section === 'search' ? <AuthorSearchPane /> : <AuthorNetworkPane onFindAuthors={() => setSection('search')} />}
    </main>
  </ProductWorkspace>
}

function AuthorSearchPane() {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(true)
  const [resolution, setResolution] = useState<AuthorSearchResolution | null>(null)
  const [live, setLive] = useState<AuthorSearchLiveResult | null>(null)
  const [searching, setSearching] = useState(false)

  const openSearch = () => {
    setResolution(null)
    setLive(null)
    setSearching(false)
    setQuery('')
    setSearchOpen(true)
  }

  const submitSearch = () => {
    if (!query.trim()) return
    const asked = query.trim()
    setQuery('')
    setSearchOpen(false)
    setSearching(true)
    void requestAuthorSearch({ query: asked }).then((result) => {
      setSearching(false)
      setLive(result)
      setResolution(result.kind === 'unavailable' ? result : null)
    })
  }

  return <section className="consultation-body">
    <section className="consultation-map-panel">
      <div className="consultation-map-wrap">
        <svg className="consultation-map" viewBox="0 0 780 470" role="img" aria-label="博主搜索">
          <defs>
            <radialGradient id="consultation-bg" cx="50%" cy="50%"><stop offset="0" stopColor="#f3f4f6"/><stop offset="1" stopColor="#f3f4f6"/></radialGradient>
          </defs>
          <rect width="780" height="470" rx="14" fill="url(#consultation-bg)"/>
          <g className="consultation-radar" aria-hidden="true">
            {[72, 142, 212].map((radius) => <circle key={radius} cx={center.x} cy={center.y} r={radius}/>)}
          </g>
        </svg>
        {searchOpen ? <form className="radar-query input-motion-frame" onSubmit={(event) => { event.preventDefault(); submitSearch() }}>
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
      {searching ? <section className="radar-search-status" aria-live="polite">
        <StatusOrbChip label="正在搜索博主" flow="author-search"/>
      </section> : live?.kind === 'results' ? <section className="radar-search-status" role="status">
        <small>相关博主</small>
        <h2>找到 {live.authors.length} 位相关博主</h2>
        <div className="radar-found-list">
          {live.authors.map((author, index) => (
            <span key={author.authorId}><i>{index + 1}</i><span>{author.name} · {originLabel(author.origin)}</span></span>
          ))}
        </div>
      </section> : live?.kind === 'empty' ? <section className="radar-search-status" role="status">
        <EmptyStatus
          kind="empty"
          title="没有相关博主"
          body="换个问法再试试。"
          action="换个问法"
          onAction={openSearch}
        />
      </section> : resolution ? <AuthorSearchUnavailable message={resolution.message} onRetry={openSearch}/> : <section className="radar-search-status" aria-live="polite">
        <span className="radar-status-icon"><Icon name="network" size={21}/></span>
        <small>从一个具体问题开始</small>
        <h2>写下你想请教的问题</h2>
        <p>问题写得越具体，越容易找到合适的博主。</p>
      </section>}
    </aside>
  </section>
}

function AuthorNetworkPane({ onFindAuthors }: { onFindAuthors: () => void }) {
  const [live, setLive] = useState<AuthorNetworkLiveResult | null>(null)
  const graph = useMemo(
    () => live?.kind === 'list' ? projectAuthorNetworkGraph(live.authors, readWorkspace().routes) : { nodes: [], edges: [] },
    [live],
  )

  const loadNetwork = () => {
    setLive(null)
    void requestAuthorNetwork().then(setLive)
  }

  useEffect(() => {
    loadNetwork()
  }, [])

  return <section className="consultation-body is-network">
    <div className="author-network-pane">
      {!live ? <section className="radar-search-status" aria-live="polite">
        <small>博主网络</small>
        <StatusOrbChip label="正在读取博主" flow="author-network"/>
      </section> : live.kind === 'unavailable' ? <AuthorNetworkUnavailable message={live.message} onRetry={loadNetwork}/> : live.authors.length === 0 ? <section className="radar-search-status" role="status">
        <EmptyStatus
          kind="empty"
          eyebrow="博主网络"
          title="还没有关注的博主"
          body="在学习里问过博主后，会显示在这里。"
          action="去找博主"
          onAction={onFindAuthors}
        />
      </section> : <AuthorNetworkGraph nodes={graph.nodes} edges={graph.edges}/>}
    </div>
  </section>
}
