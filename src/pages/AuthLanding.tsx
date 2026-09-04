import { useEffect, useState } from 'react'
import { EmptyStatus } from '../components/EmptyStatus'
import { Icon, MountainMark } from '../icons'
import { resolveAuthSession, type AuthSessionResolution } from '../resolve-auth-session'
import { requestAuthStart } from '../runtime/request-auth-session'

export function AuthLanding({ theme, onThemeChange, onAuthorize }: {
  theme: 'light' | 'dark'
  onThemeChange: () => void
  onAuthorize: () => void
}) {
  const [oauthNotice,setOauthNotice]=useState<AuthSessionResolution|null>(null)

  useEffect(() => {
    const failed = new URLSearchParams(location.search).get('oauth') === 'failed'
    if (failed) setOauthNotice(resolveAuthSession())
  }, [])

  const startOauth = () => {
    void requestAuthStart().then((result) => {
      if (result.kind === 'redirect') {
        location.href = result.authorizeUrl
        return
      }
      setOauthNotice(result)
    })
  }

  return <main className="auth-landing">
    <button type="button" className="auth-theme" aria-label="切换夜间模式" aria-pressed={theme==='dark'} onClick={onThemeChange}>
      <Icon name="moon" size={19}/><span>夜间模式</span>
    </button>
    <section className="auth-intro" aria-labelledby="auth-title">
      <div className="auth-brand"><MountainMark size={42}/><strong>问山</strong></div>
      <p className="auth-kicker">THREADPEAK · 知识探索伙伴</p>
      <h1 id="auth-title">循着问题与答案的脉络，<br/>登上理解的高峰。</h1>
      <p className="auth-description">连接知乎的优质内容与创作者，让每一次提问都能沉淀为清晰的知识脉络和学习路线。</p>
      <div className="auth-features" aria-label="产品能力">
        <span><Icon name="book" size={18}/>梳理知识脉络</span>
        <span><Icon name="route" size={18}/>制定学习路线</span>
        <span><Icon name="network" size={18}/>发现相关博主</span>
      </div>
    </section>
    <section className="auth-card" aria-label="登录问山">
      <span className="auth-card-mark">知</span>
      <h2>使用知乎账号登录</h2>
      <p>登录后即可保存你的知识脉络和路线进度。</p>
      <button type="button" className="zhihu-authorize" onClick={startOauth}>
        知乎授权登录<Icon name="arrow-right" size={18}/>
      </button>
      {oauthNotice && (
        <EmptyStatus
          kind="error"
          density="inline"
          title={oauthNotice.title}
          body={oauthNotice.message}
          action="重试"
          onAction={startOauth}
        />
      )}
      <button type="button" className="auth-prototype-enter" onClick={onAuthorize}>先看看产品</button>
      <small>登录后即可保存你的路线和知识脉络。</small>
    </section>
    <footer>问山 · 让知识成为可以行走的路径</footer>
  </main>
}
