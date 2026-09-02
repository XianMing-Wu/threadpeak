import { Icon } from '../icons'
import type { RouteName } from '../components/Shell'

export function CanvasConversationAction({
  returnTo,
}: {
  returnTo: RouteName
  routeId: string
  conceptId: string
}) {
  if (returnTo !== 'session-learning') return null
  return (
    <div className="canvas-header-actions">
      <button type="button" className="canvas-back-chat" onClick={() => { location.hash = 'session-learning' }}>
        <Icon name="message" size={17}/>回到对话
      </button>
    </div>
  )
}
