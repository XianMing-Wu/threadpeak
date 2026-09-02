import type { CSSProperties } from 'react'
import { Icon } from '../icons'
import { MarkdownMath } from '../lib/MarkdownMath'
import { isLiuKanshanDirect, isZhihuUrl, type AskAuthorsAnnotation } from '../session/ask-authors'
import { resolveAskAuthor } from '../session/resolve-ask-author'

export function AnnotationPanel({
  annotation,
  onClose,
  placement = 'page',
  style,
}: {
  annotation: AskAuthorsAnnotation
  onClose: () => void
  placement?: 'page' | 'node'
  style?: CSSProperties
}) {
  const reply = annotation.reply
  const direct = isLiuKanshanDirect(reply)
  const href = !direct && reply && isZhihuUrl(reply.url) ? reply.url : null

  return (
    <aside
      className={placement === 'node' ? 'annotation-panel annotation-panel--node' : 'annotation-panel'}
      aria-label="侧边批注"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="annotation-panel__header">
        <div>
          <h2>{direct ? '刘看山直达' : '博主批注'}</h2>
          <span>{direct ? '没有可信作者时由刘看山根据知乎公开内容作答' : '围绕所选原文的解答'}</span>
        </div>
        <button type="button" className="annotation-panel__icon-button" aria-label="隐藏侧边面板" onClick={onClose}>
          <Icon name="close" size={16}/>
        </button>
      </header>
      <div className="annotation-panel__body">
        <blockquote className="annotation-panel__quote">
          <span>所选原文</span>
          {annotation.quote}
        </blockquote>
        <p className="annotation-panel__question">{annotation.question}</p>
        {annotation.status === 'unavailable' ? (
          <div className="annotation-panel__pending" role="alert">
            <strong>无法完成本次问博主</strong>
            <span>{annotation.error || resolveAskAuthor().message}</span>
          </div>
        ) : annotation.status === 'answering' || !reply ? (
          <div className="annotation-panel__pending" aria-live="polite">
            <strong>正在解答</strong>
            <span className="annotation-waiting" aria-label="正在生成批注">
              <i className="annotation-waiting__dot"/><i className="annotation-waiting__dot"/><i className="annotation-waiting__dot"/>
            </span>
          </div>
        ) : direct ? (
          <article className="annotation-card annotation-card--direct">
            <p className="annotation-card__kicker">刘看山直达 · 不是博主身份</p>
            <div className="annotation-card__reply">
              <MarkdownMath source={reply.text}/>
            </div>
          </article>
        ) : (
          <article className="annotation-card">
            <div className="annotation-card__author">
              <span className="annotation-card__avatar" aria-hidden="true">{reply.name?.slice(0, 1) || '?'}</span>
              <div>
                <b>{reply.name || '未知作者'}</b>
                <small>{reply.bio || ''}</small>
              </div>
            </div>
            <p className="annotation-card__reply">{reply.text || ''}</p>
            <div className="annotation-card__source">
              <strong>{reply.title}</strong>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">{href}</a>
              ) : (
                <span>链接不可用</span>
              )}
            </div>
          </article>
        )}
      </div>
    </aside>
  )
}
