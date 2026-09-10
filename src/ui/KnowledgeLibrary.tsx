import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { EmptyStatus } from '../components/EmptyStatus'
import { Icon } from '../icons'
import { coverForId, coverSrcSet } from './covers'
import { searchKnowledgeShelves, type KnowledgeBook, type KnowledgeShelf } from './knowledge-shelves'
import { useShelfScroll } from './use-shelf-scroll'
import { useThreeBookshelf } from './use-three-bookshelf'
import { useShelfLayout } from './use-shelf-layout'
import './knowledge-library.css'

function ConceptBook({ book, shelf, priority, onOpen }: {
  book: KnowledgeBook; shelf: KnowledgeShelf; priority: boolean; onOpen: (book: KnowledgeBook) => void
}) {
  const cover = coverForId(book.conceptId)
  return <div className="knowledge-book-slot" role="listitem">
    <button className="knowledge-book" type="button" data-book-id={book.id}
      aria-label={`打开知识脉络：${book.title}，${book.carrier || '概念笔记'}，${shelf.title}${shelf.example ? '，示例' : ''}`} onClick={() => onOpen(book)} title={`${shelf.title}\n${book.carrier}\n${book.title}${book.description ? `\n${book.description}` : ''}`}>
      <span className="knowledge-book-pages" aria-hidden="true"/>
      <span className="knowledge-book-cover">
        <img src={cover} srcSet={coverSrcSet(cover)} sizes="(max-width: 560px) 132px, 168px" width="168" height="224" alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" draggable={false}/>
        <span className="knowledge-book-copy">
          <span className="knowledge-book-carrier">{book.carrier || '概念笔记'}</span>
          <span className="knowledge-book-title">{book.title}</span>
        </span>
        <span className="knowledge-book-series"><span className="knowledge-book-route">{shelf.title}</span></span>
        {shelf.example && <span className="knowledge-book-origin">示例</span>}
      </span>
    </button>
  </div>
}

function RouteShelf({ shelf, index, onOpen }: { shelf: KnowledgeShelf; index: number; onOpen: (book: KnowledgeBook) => void }) {
  const titleId = useId(), hintId = useId()
  const { viewport, move, edges, handlers } = useShelfScroll(shelf.books.length)
  return <section className="knowledge-shelf" aria-labelledby={titleId} data-shelf-id={shelf.id}>
    <div className="knowledge-shelf-stage">
      <h2 id={titleId} className="knowledge-library-sr-only">{shelf.title}</h2>
      <p id={hintId} className="knowledge-library-sr-only">左右滑动浏览，滑到第一本或最后一本即停止。也可使用左右方向键，按 Tab 选择概念，按 Enter 打开。</p>
      <div className="knowledge-shelf-viewport" ref={viewport} role="group" aria-label={`${shelf.title}的概念书架`} aria-describedby={hintId} tabIndex={edges.left || edges.right ? 0 : -1}
        {...handlers} onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          move(event.key === 'ArrowRight' ? 1 : -1)
        }}>
        <div className="knowledge-shelf-track" role="list" aria-label={`${shelf.title}的概念`}>
          {shelf.books.map((book, bookIndex) => <ConceptBook key={book.id} book={book} shelf={shelf} priority={index === 0 && bookIndex < 2} onOpen={onOpen}/>)}
        </div>
      </div>
      <div className="knowledge-shelf-plank" aria-hidden="true"/>
    </div>
  </section>
}

export function KnowledgeLibrary({ shelves, onOpen, loading, error, footer }: {
  shelves: readonly KnowledgeShelf[]
  onOpen: (book: KnowledgeBook) => void
  loading: boolean
  error?: ReactNode
  footer?: ReactNode
}) {
  const searchId = useId()
  const cabinet = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useShelfLayout(cabinet)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => searchKnowledgeShelves(shelves, query), [shelves, query])
  const sceneStatus = useThreeBookshelf(cabinet, canvas)
  return <main className="knowledge-library knowledge-square">
    <div className="knowledge-library-inner">
      <header className="knowledge-library-header">
        <div><h1>知识脉络</h1><p>一条路线，一层书架。把学过的概念慢慢收藏。</p></div>
        <div className="knowledge-library-search">
          <label className="knowledge-library-sr-only" htmlFor={searchId}>搜索知识脉络</label><Icon name="search" size={17}/>
          <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索路线、载体或概念…"/>
        </div>
        {loading && <span className="knowledge-library-loading" role="status" aria-busy="true">正在读取你的知识脉络…</span>}
        <p className="knowledge-library-results" role="status">{query.trim() ? `找到 ${shown.filter(shelf => shelf.books.length).length} 条路线中的 ${shown.reduce((sum, shelf) => sum + shelf.books.length, 0)} 个概念` : ''}</p>
      </header>
      {loading && !shelves.length && <div className="knowledge-shelf-loading-books" aria-hidden="true"><i/><i/><i/></div>}
      {error && <div className="knowledge-library-notice">{error}</div>}
      {sceneStatus === 'unavailable' && <p className="knowledge-library-render-note" role="status">3D 暂时不可用，已切换为普通书架，仍可浏览和打开概念。</p>}
      <div ref={cabinet} className="knowledge-library-shelves" hidden={!shown.length} data-renderer={sceneStatus}>
        <div className="knowledge-shelf-renderer" aria-hidden="true"><canvas ref={canvas}/></div>
        {shown.map((shelf, index) => <RouteShelf key={`${shelf.id}:${shelf.books.map(book => book.id).join('|')}`} shelf={shelf} index={index} onOpen={onOpen}/>)}
      </div>
      {!shown.length && !loading && <div className="knowledge-library-empty">
        {query.trim() ? <EmptyStatus headingLevel={2} title="没有找到匹配内容" body="试试路线名称、载体或概念关键词。" action="清空搜索" onAction={() => setQuery('')}/>
          : !error && <EmptyStatus headingLevel={2} title="书架还没有内容" body="制定路线并开始学习后，相关概念会放在同一层。" action="去看我的路线" onAction={() => { location.hash = 'paths' }}/>}</div>}
      {footer}
    </div>
  </main>
}
