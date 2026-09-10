import { useState } from 'react'
import { useAccountRecovery } from '../learning-v2/account-storage'
import { exportLocalArchive, localRecoveryAvailable } from '../workspace/snapshot-cache'
import { useWorkspaceTick } from '../workspace/store'
import './local-recovery-notice.css'

/** Recovery is exceptional; the presence of old records is not a recovery failure. */
export function LocalRecoveryNotice() {
  const recovery = useAccountRecovery()
  useWorkspaceTick()
  const [exportError, setExportError] = useState(false)
  if (!recovery && !localRecoveryAvailable()) return null
  return <aside className="local-recovery-notice" aria-label="本地数据恢复">
    <p role="alert">部分本地内容尚未完整恢复。备份仍然保留，可以先导出或释放浏览器空间。</p>
    <button type="button" onClick={() => {
      setExportError(false)
      void exportLocalArchive().catch(() => setExportError(true))
    }}>导出本地备份</button>
    {exportError && <p role="alert">暂时无法导出，请重试。原有内容仍然保留。</p>}
  </aside>
}
