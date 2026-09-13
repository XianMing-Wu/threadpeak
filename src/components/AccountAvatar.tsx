import { useState } from 'react'
import { Icon } from '../icons'
import type { WorkspaceSession } from '../runtime/workspace-session'
import './account-avatar.css'

export function AccountAvatar({ session }: { session: WorkspaceSession | null }) {
  const guest = session?.kind === 'guest'
  const src = guest ? '/kanshan-avatar.png' : session?.profile?.avatar
  const [failedSrc, setFailedSrc] = useState<string>()
  const name = session?.profile?.name || '用户'
  return <span className={`account-avatar${guest ? ' is-guest' : ''}`}>
    {src && src !== failedSrc
      ? <img src={src} alt={guest ? '游客头像：刘看山' : `${name}的头像`} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />
      : <Icon name="user" size={18} />}
  </span>
}
