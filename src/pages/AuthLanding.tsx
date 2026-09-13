import { oauthNotice, requestAuthStart } from '../runtime/request-auth-session'
import { useAccountRecovery } from '../learning-v2/account-storage'
import { exportLocalArchive } from '../workspace/snapshot-cache'
import { useEffect, useState } from 'react'
import { Icon, MountainMark } from '../icons'
import { LoginJourney } from './LoginJourney'
import ideaLettering from './auth-assets/idea.svg'
import beginLettering from './auth-assets/begin.svg'
import welcomeLettering from './auth-assets/welcome.svg'
import brandLettering from './auth-assets/brand.svg'
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
  const [notice, setNotice] = useState(() => oauthNotice(location.search))
  const [motionPaused, setMotionPaused] = useState(false)
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
      if (!current.zhihuAvailable) return
      const result = await requestAuthStart()
      if (result.kind !== 'redirect') throw new Error(result.message)
      location.href = result.authorizeUrl
    } catch (error) { setNotice(error instanceof Error ? error.message : '暂时无法进入，请稍后重试。') }
    finally { setPending(null) }
  }
  return <main className="auth-landing auth-journey-page" data-auth-theme={theme}>
    <header className="auth-header">
      <a className="auth-brand" href="#intro" aria-label="问山 ThreadPeak，返回产品介绍"><MountainMark size={29}/><img src={brandLettering} alt="问山"/><span>ThreadPeak</span></a>
      <nav className="auth-nav" aria-label="登录页导航"><a className="auth-back" href="#intro"><span aria-hidden="true">←</span> 返回介绍</a><button type="button" className="auth-motion" aria-label={motionPaused ? '播放插画动画' : '暂停插画动画'} title={motionPaused ? '播放插画动画' : '暂停插画动画'} onClick={() => setMotionPaused(!motionPaused)}><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">{motionPaused ? <path d="m5 3 7 5-7 5Z"/> : <path d="M5 3v10M11 3v10"/>}</svg></button><button type="button" className="auth-theme" aria-label="切换夜间模式" aria-pressed={theme === 'dark'} onClick={onThemeChange}><Icon name="moon" size={17}/><span>{theme === 'dark' ? '日间模式' : '夜间模式'}</span></button></nav>
    </header>
    <div className="auth-content">
      <section className="auth-intro" aria-labelledby="auth-title">
        <div className="auth-intro-copy">
          <p className="auth-eyebrow"><span/> 每个目标，都有自己的路</p>
          <h1 id="auth-title"><img src={ideaLettering} alt="想做的事，"/><img src={beginLettering} alt="从这里开始。"/></h1>
          <p className="auth-description">从你的目标出发，只学实现它所需的部分。<br/><span>让每一次好奇，都落在自己的路上。</span></p>
        </div>
        <LoginJourney paused={motionPaused}/>
      </section>
      <section className="auth-entry" aria-labelledby="auth-entry-title" aria-busy={!!pending}>
        <div className="auth-entry-content">
          <div className="auth-entry-bookmark" aria-hidden="true"><svg width="23" height="37" viewBox="0 0 23 37" fill="none"><path d="M1 1h21v34l-10.5-7L1 35V1Z"/><path d="m7 12 3 3 6-7"/></svg></div>
          <p className="auth-entry-kicker">YOUR NEXT CHAPTER</p>
          <h2 id="auth-entry-title"><img src={welcomeLettering} alt="欢迎来到问山"/></h2>
          <p className="auth-entry-description">带上一个想法，就能开始。</p>
          <div className="auth-actions">
            <button type="button" className="auth-login auth-login-zhihu" disabled={!!pending||config?.zhihuAvailable===false} onClick={() => void login('zhihu')}>
              <span className="auth-zhihu-mark" aria-hidden="true">知</span><span>{pending === 'zhihu' ? '正在连接知乎…' : '知乎账号登录'}</span>{config?.zhihuMode === 'mock' && <span className="auth-demo-tag">演示</span>}<span className={`auth-button-arrow ${pending === 'zhihu' ? 'is-pending' : ''}`} aria-hidden="true"><EntryArrow/></span>
            </button>
            <p className="auth-login-caption">{config?.zhihuAvailable===false?'知乎账号登录暂未开放，可先以游客身份开始学习。':'把知乎收藏，接进自己的学习路径。'}</p>
            <div className="auth-choice-divider" aria-hidden="true"><span>也可以直接出发</span></div>
            <button type="button" className="auth-login auth-login-guest" disabled={!!pending} onClick={() => void login('guest')}>
              <Icon name="user" size={19}/><span>{pending === 'guest' ? '正在进入…' : '游客登录'}</span><span className={`auth-button-arrow ${pending === 'guest' ? 'is-pending' : ''}`} aria-hidden="true"><EntryArrow/></span>
            </button>
            <p className={`auth-login-caption auth-login-status${notice ? ' auth-notice' : ''}`} role={notice ? 'alert' : undefined}>{notice || '给出目标或上传文件，照样学习、保存进度。'}</p>
          </div>
          <details className="auth-help">
            <summary>游客记录如何保存？<Icon name="prod-home-chevron-down" size={13}/></summary>
            <p>游客记录保留在当前浏览器身份下。使用同一浏览器重新进入，即可继续学习；清除浏览器 Cookie 后无法自动找回。</p>
          </details>
          {recovery && <aside className="auth-recovery"><p role="alert">本机有一份草稿备份尚未完整恢复。</p><button type="button" onClick={exportLocalArchive}>导出本地备份</button></aside>}
        </div>
      </section>
    </div>
  </main>
}

function EntryArrow() {
  return <svg viewBox="0 0 30 20" width="27" height="18" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"><path d="M2 11c8-1 17-1 25-1m-7-7 7 7-7 7"/></svg>
}
