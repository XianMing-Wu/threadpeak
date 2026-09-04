import './empty-status.css'

export type EmptyStatusKind = 'empty' | 'error'
export type EmptyStatusDensity = 'panel' | 'inline'
export type EmptyStatusAlign = 'start' | 'center'

export function EmptyStatus({
  kind = 'empty',
  density = 'panel',
  align = 'center',
  eyebrow,
  title,
  body,
  action,
  onAction,
  role,
}: {
  kind?: EmptyStatusKind
  density?: EmptyStatusDensity
  align?: EmptyStatusAlign
  eyebrow?: string
  title: string
  body?: string
  action?: string
  onAction?: () => void
  role?: 'alert' | 'status'
}) {
  const resolvedRole = role ?? (kind === 'error' ? 'alert' : 'status')

  return (
    <div className="ux-status" data-kind={kind} data-density={density} data-align={align} role={resolvedRole}>
      <img className="ux-status__mascot" src="/sleep.gif" alt="" width={128} height={128} />
      {eyebrow ? <small className="ux-status__eyebrow">{eyebrow}</small> : null}
      <h2 className="ux-status__title">{title}</h2>
      {body ? <p className="ux-status__body">{body}</p> : null}
      {action ? (
        <button type="button" className="ux-status__action" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  )
}
