import { requestAuthStart } from '../runtime/request-auth-session'
import { useAccountRecovery } from '../learning-v2/account-storage'
import { exportLocalArchive } from '../workspace/snapshot-cache'
import { useEffect, useState } from 'react'
import { Icon, MountainMark } from '../icons'
import { OrbitField } from '../components/OrbitField'
import './auth-landing.css'

type LoginConfig = { zhihuAvailable: boolean; zhihuMode?: 'real' | 'mock'; loginUrl?: string | null }
export function AuthLanding({ theme, onThemeChange, onAuthorize }: {
  theme: 'light' | 'dark'
  onThemeChange: () => void
  onAuthorize: () => Promise<void>
}) {
  const recovery = useAccountRecovery()
  const [config, setConfig] = useState<LoginConfig | null>(null)
  const [pending, setPending] = useState<'zhihu' | 'guest' | null>(null)
  const [notice, setNotice] = useState(() => new URLSearchParams(location.search).get('oauth') === 'failed' ? '知乎登录未完成，请重新尝试。' : '')
  const loadConfig = async () => {
    const response = await fetch('/api/auth/config', { credentials: 'same-origin', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('暂时无法连接登录服务，请重试。')
    const value: LoginConfig = await response.json()
    setConfig(value)
    return value
  }
  useEffect(() => { let live = true; void loadConfig().catch(() => { if (live) setNotice('暂时无法连接登录服务，请重试。') }); return () => { live = false } }, [])
  const login = async (mode: 'zhihu' | 'guest') => {
    if (pending) return
    setPending(mode); setNotice('')
    try {
      if (mode === 'guest') { await onAuthorize(); return }
      const current = config ?? await loadConfig()
      if (!current.zhihuAvailable) throw new Error('知乎账号登录暂未开放，可先以游客身份开始学习。')
      const result = await requestAuthStart()
      if (result.kind !== 'redirect') throw new Error(result.message)
      location.href = result.authorizeUrl
    } catch (error) { setNotice(error instanceof Error ? error.message : '暂时无法进入，请稍后重试。') }
    finally { setPending(null) }
  }
  return <main className="auth-landing auth-orbit-page">
    <header className="auth-header">
      <div className="auth-brand"><MountainMark size={30}/><strong>问山</strong><span>ThreadPeak</span></div>
      <button type="button" className="auth-theme" aria-label="切换夜间模式" aria-pressed={theme === 'dark'} onClick={onThemeChange}><Icon name="moon" size={18}/><span>{theme === 'dark' ? '日间模式' : '夜间模式'}</span></button>
    </header>
    <div className="auth-content">
      <section className="auth-intro" aria-labelledby="auth-title">
        <div className="auth-intro-copy">
          <h1 id="auth-title">循着脉络，<br/><span>登上高峰。</span></h1>
          <p className="auth-description">从一个目标，走向真正的理解。</p>
          <ul className="auth-capabilities" aria-label="在问山可以做什么">
            <li><span>学习路线</span><small>从目标安排顺序</small></li>
            <li><span>概念讲解</span><small>把关键知识讲清楚</small></li>
            <li><span>相关博主</span><small>找到值得请教的人</small></li>
          </ul>
        </div>
        <OrbitField dark={theme === 'dark'}/>
      </section>
      <section className="auth-entry" aria-labelledby="auth-entry-title" aria-busy={!!pending}>
        <div className="auth-entry-content">
          <h2 id="auth-entry-title">欢迎来到问山</h2>
          <p className="auth-entry-description">选择一种方式，开始你的学习。</p>
          <div className="auth-actions">
            <button type="button" className="auth-login auth-login-zhihu" disabled={!!pending} onClick={() => void login('zhihu')}>
              <span className="auth-zhihu-mark" aria-hidden="true">知</span><span>{pending === 'zhihu' ? '正在连接知乎…' : '知乎账号登录'}</span>{config?.zhihuMode === 'mock' && <span className="auth-demo-tag">演示</span>}
            </button>
            <p className="auth-login-caption">连接你在知乎收藏的好内容</p>
            <div className="auth-choice-divider" aria-hidden="true"><span>或</span></div>
            <button type="button" className="auth-login auth-login-guest" disabled={!!pending} onClick={() => void login('guest')}>
              <Icon name="user" size={18}/><span>{pending === 'guest' ? '正在进入…' : '游客登录'}</span>
            </button>
            <p className="auth-login-caption">同样可以规划、学习和保存进度</p>
          </div>
          {notice && <p className="auth-notice" role="alert">{notice}</p>}
          <details className="auth-help">
            <summary>游客记录如何保存？<Icon name="prod-home-chevron-down" size={13}/></summary>
            <p>游客记录保留在当前浏览器身份下。使用同一浏览器重新进入，即可继续学习；清除浏览器 Cookie 后无法自动找回。</p>
          </details>
          {recovery && <aside className="auth-recovery"><p role="alert">本机有一份草稿备份尚未完整恢复。</p><button type="button" onClick={exportLocalArchive}>导出本地备份</button></aside>}
        </div>
      </section>
    </div>
    <footer><span>问山 · 知识探索伙伴</span>{config?.zhihuMode === 'mock' && <span>知乎入口使用本地演示授权</span>}</footer>
  </main>
}
