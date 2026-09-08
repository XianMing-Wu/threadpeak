import { useEffect, useRef } from 'react'
import authors from './author-hero-data.json'
import { mountAuthorLens } from './author-hero-lens'
import './author-discovery-hero.css'

/** Public editorial examples, separate from the user's discovered author network. */
export function AuthorDiscoveryHero() {
  const rootRef = useRef<HTMLElement>(null)
  const deckRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current, deck = deckRef.current, glass = glassRef.current, copy = copyRef.current
    if (!root || !deck || !glass || !copy) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    return mountAuthorLens({ root, deck, glass, copy, motion })
  }, [])

  return <section className="au-discovery-hero" ref={rootRef} aria-label="博主网络">
    <div className="au-discovery-stage" aria-hidden="true">
      <div className="au-hero-deck" ref={deckRef}>
        {authors.map(author => <div className="au-orbit-card" key={author.id} data-author-id={author.id}>
          <article className="au-hero-author-card">
            <img src={author.avatar} alt="" width="54" height="54" draggable="false" decoding="async"/>
            <strong>{author.name}</strong>
            <span>{author.topic}</span>
            <p>{author.articleTitle}</p>
          </article>
        </div>)}
      </div>
      <div className="au-magnifier" ref={glassRef}>
        <div className="au-magnifier-handle"/>
        <div className="au-magnifier-rim">
          <div className="au-magnifier-lens"><div className="au-lens-copy" ref={copyRef}/></div>
          <div className="au-magnifier-glint"/>
        </div>
      </div>
    </div>
  </section>
}
