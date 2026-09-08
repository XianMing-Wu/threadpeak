import { KanshanAvatar } from '../components/KanshanAvatar'
import { coverSrcSet } from './covers'

export type FlowithCardItem = {
  id: string
  cover: string
  title: string
  desc: string
  author: string
  badge: string
}

function isKanshan(name: string) {
  return name === '问山' || name === '刘看山'
}

function authorMark(name: string) {
  return name.slice(0, 1)
}

export function FlowithCard({
  cover,
  title,
  desc,
  author,
  badge,
  onOpen,
}: FlowithCardItem & { onOpen?: () => void }) {
  return (
    <button type="button" className="ux-flowith-card" onClick={onOpen}>
      <div className="cover">
        <img src={cover} srcSet={coverSrcSet(cover)} sizes="(max-width: 560px) calc(100vw - 116px), (max-width: 760px) calc((100vw - 128px) / 2), (max-width: 1080px) calc((100vw - 156px) / 3), 300px" alt="" loading="lazy" decoding="async" width="1536" height="1024" />
      </div>
      <div className="body">
        <h3>{title}</h3>
        <p className="desc">{desc}</p>
        <div className="foot">
          <div className="author">
            {isKanshan(author) ? <KanshanAvatar /> : <span className="ava" aria-hidden>{authorMark(author)}</span>}
            <span>{author}</span>
          </div>
          <span className="price free">{badge}</span>
        </div>
      </div>
    </button>
  )
}
