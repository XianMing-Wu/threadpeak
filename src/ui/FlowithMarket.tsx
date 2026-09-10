import { useId, useMemo, useState, type ReactNode } from 'react'
import { EmptyStatus } from '../components/EmptyStatus'
import { PeakHero } from '../components/PeakHero'
import { RouteHero } from '../components/RouteHero'
import { PeakTabs, type PeakTabIcon } from '../components/PeakTabs'
import { Icon } from '../icons'
import { FlowithCard, type FlowithCardItem } from './FlowithCard'

export type FlowithMarketKind = 'collections' | 'concepts' | 'routes'

const COPY = {
  collections: {
    title: '知识脉络',
    sub: '从每个概念出发，查看积累的文章与知识卡片。',
    mine: '我的知识脉络',
    example: '示例知识脉络',
    listTitle: '知识脉络',
    noun: '知识脉络',
    search: '搜索知识脉络...',
    mineIcon: 'users' as const,
    exampleIcon: 'book' as const,
  },
  concepts: {
    title: '知识脉络',
    sub: '每个概念都有自己的脉络。',
    mine: '我的知识脉络',
    example: '示例知识脉络',
    listTitle: '概念脉络',
    noun: '概念脉络',
    search: '搜索概念脉络...',
    mineIcon: 'users' as const,
    exampleIcon: 'book' as const,
  },
  routes: {
    title: '路线规划',
    sub: '从目标出发，把学习内容组织成可以进入的路线。',
    mine: '我的路线',
    example: '示例路线',
    listTitle: '学习路线',
    noun: '学习路线',
    search: '搜索学习路线...',
    mineIcon: 'users' as const,
    exampleIcon: 'book' as const,
  },
} as const

export function FlowithMarket({
  kind,
  tab,
  onTab,
  items,
  total,
  loading = false,
  empty,
  error,
  loadingStatus,
  heading,
  footer,
  title,
  sub,
  switchable = true,
}: {
  kind: FlowithMarketKind
  tab: 'mine' | 'example'
  onTab?: (tab: 'mine' | 'example') => void
  items: ReadonlyArray<FlowithCardItem & { onOpen?: () => void }>
  total: number
  loading?: boolean
  empty: ReactNode
  error?: ReactNode
  loadingStatus?: ReactNode
  heading?: ReactNode
  footer?: ReactNode
  title?: string
  sub?: string
  switchable?: boolean
}) {
  const copy = COPY[kind]
  const listHeadingId = useId()
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => `${item.title} ${item.desc} ${item.author} ${item.badge}`.toLowerCase().includes(q))
  }, [items, query])

  let results: ReactNode = null
  if (loading && !error) {
    results = <div className="market-loading">
      {loadingStatus ?? <p>正在读取{copy.noun}…</p>}
      <div className="market-skeletons" aria-hidden="true">
        {[0, 1, 2].map(index => <div key={index}><span /><i /><i /></div>)}
      </div>
    </div>
  } else if (shown.length > 0) {
    results = <ul className="grid" role="list" aria-label={copy.listTitle}>
      {shown.map(item => <li key={item.id}><FlowithCard {...item} /></li>)}
    </ul>
  } else if (!error) {
    let emptyContent = empty
    if (query.trim()) {
      emptyContent = <EmptyStatus kind="empty" headingLevel={3} title="没有找到匹配内容" body="试试更短的关键词，或清空搜索查看全部内容。" action="清空搜索" onAction={() => setQuery('')} />
    } else if (tab === 'example') {
      emptyContent = <EmptyStatus kind="empty" headingLevel={3} title={`暂无示例${copy.noun}`} body="示例内容暂时不可用，你仍可以从首页制定自己的学习路线。" action="回到首页" onAction={() => { location.hash = 'home' }} />
    }
    results = <div className="ux-flowith-empty square-empty">{emptyContent}</div>
  }

  return (
    <main className={`ux-flowith ${kind === 'routes' ? 'route-list' : 'knowledge-square'} peak-market`}>
      {heading}
      {kind === 'routes'
        ? <RouteHero title={title ?? copy.title} sub={sub ?? copy.sub}/>
        : <PeakHero title={title ?? copy.title} sub={sub ?? copy.sub}/>}
      {switchable
        ? (
            <div className="tabs-wrap">
              <PeakTabs
                items={[
                  { id: 'mine', label: copy.mine, icon: copy.mineIcon as PeakTabIcon },
                  { id: 'example', label: copy.example, icon: copy.exampleIcon as PeakTabIcon },
                ]}
                active={tab}
                onChange={onTab}
              />
            </div>
          )
        : null}
      <section className="panel" aria-labelledby={listHeadingId} aria-busy={loading && !error}>
        <div className="sec">
          <div className="market-toolbar">
            <div>
              <h2 id={listHeadingId}>{copy.listTitle}</h2>
              <p className="sec-sub" role="status">
                {error && items.length === 0 ? '暂时无法读取内容' : loading ? '正在读取…' : `显示 ${shown.length} / ${total} 条${copy.noun}`}
              </p>
            </div>
            <div className="search">
              <Icon name="search" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                aria-label={copy.search.replace('...', '')}
                type="search"
              />
            </div>
          </div>
          {error && <div className="market-error">{error}</div>}
          {results}
        </div>
      </section>
      {footer}
    </main>
  )
}
