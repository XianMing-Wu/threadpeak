import { useMemo, useState, type ReactNode } from 'react'
import { PeakHero } from '../components/PeakHero'
import { PeakTabs, type PeakTabIcon } from '../components/PeakTabs'
import { FlowithCard, type FlowithCardItem } from './FlowithCard'

export type FlowithMarketKind = 'collections' | 'concepts' | 'routes'

const COPY = {
  collections: {
    title: '知识脉络',
    sub: '按路线收纳，再进入每个概念自己的脉络。',
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
    listTitle: '知识脉络',
    noun: '知识脉络',
    search: '搜索知识脉络...',
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
  loadingStatus,
  heading,
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
  loadingStatus?: ReactNode
  heading?: ReactNode
  title?: string
  sub?: string
  switchable?: boolean
}) {
  const copy = COPY[kind]
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => `${item.title} ${item.desc} ${item.author} ${item.badge}`.toLowerCase().includes(q))
  }, [items, query])

  return (
    <main className={`ux-flowith ${kind === 'routes' ? 'route-list' : 'knowledge-square'} peak-market`}>
      {heading}
      <PeakHero title={title ?? copy.title} sub={sub ?? copy.sub} />
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
      <section className="panel">
        <section className="sec">
          <h3>{copy.listTitle}</h3>
          <p className="sec-sub">
            显示 {loading ? 0 : shown.length} / {loading ? 0 : total} 条{copy.noun}
          </p>
          <div className="search-row">
            <div className="search">
              <svg fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                type="search"
              />
            </div>
          </div>
          <div className="grid">
            {loading
              ? <div className="ux-flowith-empty square-empty">{loadingStatus}</div>
              : shown.length === 0
                ? <div className="ux-flowith-empty square-empty">{empty}</div>
                : shown.map((item) => <FlowithCard key={item.id} {...item} />)}
          </div>
        </section>
      </section>
    </main>
  )
}
