import { useEffect, useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { requestAuthorNetwork, type AuthorNetworkLiveResult } from '../session/request-author-network'
import { resolveAuthorNetwork } from '../session/resolve-author-network'
import { requestAuthorSearch, type AuthorSearchLiveResult } from '../session/request-author-search'
import { resolveAuthorSearch, type AuthorSearchResolution } from '../session/resolve-author-search'

type AuthorSection = 'search' | 'network'

const center = { x: 390, y: 236 }

function originLabel(origin: 'high-weight' | 'low-weight' | 'zhihu') {
  if (origin === 'high-weight') return '高权网络'
  if (origin === 'low-weight') return '低权网络'
  return '知乎检索'
}

function AuthorSearchUnavailable({ message }: { message?: string }) {
  const resolution = resolveAuthorSearch()
  return <section className="radar-search-status" role="alert">
    <small>博主搜索</small>
    <h2>{resolution.title}</h2>
    <p>{message || resolution.message}</p>
  </section>
}

function AuthorNetworkUnavailable({ message }: { message?: string }) {
  const resolution = resolveAuthorNetwork()
  return <section className="radar-search-status" role="alert">
    <small>博主网络</small>
    <h2>{resolution.title}</h2>
    <p>{message || resolution.message}</p>
  </section>
}

export function AuthorsPage() {
  const [section, setSection] = useState<AuthorSection>('search')

  return <ProductWorkspace active="authors" page="authors">
    <main className="consultation-page">
      <header className="consultation-header">
        <h1>博主网络</h1>
        <p>{section === 'network' ? '已入网的真实作者会列在这里。关系图画法还没有冻结，不能当成产品事实。' : '先查你的博主网络；没有相关作者时再检索知乎，最多 3 位，不凑数。'}</p>
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
        <small>最多 3 位，按高权、低权、知乎补位</small>
        <h2>找到 {live.authors.length} 位相关博主</h2>
        <div className="radar-found-list">
          {live.authors.map((author, index) => (
            <span key={author.authorId}><i>{index + 1}</i><span>{author.name} · {originLabel(author.origin)}</span></span>
          ))}
        </div>
      </section> : live?.kind === 'empty' ? <section className="radar-search-status" role="status">
        <h2>没有相关博主</h2>
        <p>网络和知乎都没有可展示的相关作者，不会凑数。</p>
      </section> : resolution ? <AuthorSearchUnavailable message={resolution.message}/> : <section className="radar-search-status" aria-live="polite">
        <span className="radar-status-icon"><Icon name="network" size={21}/></span>
        <small>从一个具体问题开始</small>
        <h2>你想咨询谁，先由问题来决定</h2>
        <p>问题越具体，找到的博主和原文证据就越准确。发送后会走 network-first 检索；网络投影不可用时会显式失败，不会用本地图谱或固定作者凑结果。</p>
      </section>}
    </aside>
  </section>
}

function AuthorNetworkPane() {
  const [live, setLive] = useState<AuthorNetworkLiveResult | null>(null)

  useEffect(() => {
    void requestAuthorNetwork().then(setLive)
  }, [])

  return <section className="consultation-body is-network">
    <div className="author-network-pane">
      {!live ? <section className="radar-search-status" aria-live="polite">
        <small>博主网络</small>
        <h2>正在读取已入网作者</h2>
        <p>只列出服务端已经写入的真实作者，不展示示例星图。</p>
      </section> : live.kind === 'unavailable' ? <AuthorNetworkUnavailable message={live.message}/> : live.authors.length === 0 ? <section className="radar-search-status" role="status">
        <small>博主网络</small>
        <h2>还没有入网博主</h2>
        <p>问博主选中的真实作者会写入高权；搜索补位的新作者会写入低权。关系图画法尚未冻结，这里只显示名单。</p>
      </section> : <section className="radar-search-status" role="status">
        <small>博主网络</small>
        <h2>已入网 {live.authors.length} 位博主</h2>
        <div className="radar-found-list">
          {live.authors.map((author, index) => (
            <span key={author.authorId}>
              <i>{index + 1}</i>
              <span>{author.name} · {author.weight === 'high' ? '高权' : '低权'}{author.question ? ` · ${author.question}` : ''}</span>
            </span>
          ))}
        </div>
      </section>}
    </div>
  </section>
}
