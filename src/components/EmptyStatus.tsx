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
  headingLevel = 2,
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
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const Heading = `h${headingLevel}` as const
  const resolvedRole = role ?? (kind === 'error' ? 'alert' : 'status')

  return (
    <div className="ux-status" data-kind={kind} data-density={density} data-align={align} role={resolvedRole}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/kanshan-avatar.png" />
        <img className="ux-status__mascot" src="/sleep.gif" alt="" width={128} height={128} />
      </picture>
      {eyebrow ? <small className="ux-status__eyebrow">{eyebrow}</small> : null}
      <Heading className="ux-status__title">{title}</Heading>
      {body ? <p className="ux-status__body">{body}</p> : null}
      {action ? (
        <button type="button" className="ux-status__action" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  )
}
