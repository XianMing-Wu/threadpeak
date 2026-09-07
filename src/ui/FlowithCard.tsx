import { KanshanAvatar } from '../components/KanshanAvatar'

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
        <img src={cover} alt="" loading="lazy" decoding="async" width="1536" height="1024" />
        <div className="cover-fade" />
      </div>
      <div className="body">
        <h4>{title}</h4>
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
