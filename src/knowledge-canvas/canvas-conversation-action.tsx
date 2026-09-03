import { Icon } from '../icons'
import { returnToLatestLearning } from '../learningSession'

export function CanvasConversationAction({
  routeId,
  conceptId,
}: {
  routeId: string
  conceptId: string
}) {
  if (!routeId.trim() || !conceptId.trim()) return null
  return (
    <div className="canvas-header-actions">
      <button type="button" className="canvas-back-chat" onClick={() => returnToLatestLearning(routeId, conceptId)}>
        <Icon name="message" size={17}/>回到对话
      </button>
    </div>
  )
}
