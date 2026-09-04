import { useEffect, useState } from 'react'
import { EmptyStatus } from '../components/EmptyStatus'
import { clearChatHistory } from '../history'
import { resolveSettingsIdentity, resolveSettingsSources } from '../resolve-settings-identity'
import { requestAuthSession } from '../runtime/request-auth-session'

function SettingsIdentityUnavailable({ onRetry }: { onRetry: () => void }) {
  const resolution = resolveSettingsIdentity()
  return <article className="setting-row" role="alert">
    <EmptyStatus
      kind="error"
      density="inline"
      title={resolution.title}
      body={resolution.message}
      action="重试"
      onAction={onRetry}
    />
  </article>
}

function SettingsSourcesUnavailable({ onRetry }: { onRetry: () => void }) {
  const resolution = resolveSettingsSources()
  return <article className="setting-row" role="alert">
    <EmptyStatus
      kind="error"
      density="inline"
      title={resolution.title}
      body={resolution.message}
      action="重试"
      onAction={onRetry}
    />
  </article>
}

export function SettingsPage({
  theme,
  onThemeChange,
  onLogout,
}: {
  theme: 'light' | 'dark'
  onThemeChange: () => void
  onLogout: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [oauthSignedIn, setOauthSignedIn] = useState(false)

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirm(false) }
    addEventListener('keydown', escape)
    return () => removeEventListener('keydown', escape)
  }, [])
  useEffect(() => {
    void requestAuthSession().then((session) => {
      setOauthSignedIn(session.kind === 'authenticated')
    })
  }, [])

  return <main className="settings-page">
    <header><h1>设置</h1></header>
    <section>
      <h2>个人信息</h2>
      {oauthSignedIn
        ? <article className="setting-row"><div><b>已登录知乎</b><small>可以同步你的公开资料。</small></div></article>
        : <SettingsIdentityUnavailable onRetry={() => { void requestAuthSession().then((session) => { setOauthSignedIn(session.kind === 'authenticated') }) }}/>}
      <h2>资料范围</h2>
      <SettingsSourcesUnavailable onRetry={() => { void requestAuthSession() }}/>
      <h2>界面</h2>
      <div className="setting-row">
        <div><b>夜间模式</b><small>只改变本机外观，不改变学习内容</small></div>
        <button className={`switch ${theme === 'dark' ? 'is-on' : ''}`} aria-label="夜间模式" role="switch" aria-checked={theme === 'dark'} onClick={onThemeChange}><i/></button>
      </div>
      <h2>历史记录</h2>
      <div className="setting-row danger"><div><b>清空本地历史</b><small>只清空这台设备上的对话记录，不会删除你的路线和知识脉络</small></div><button onClick={() => setConfirm(true)}>清空</button></div>
      <h2>账号</h2>
      <div className="setting-row danger"><div><b>退出登录</b><small>退出后需要重新登录</small></div><button onClick={onLogout}>退出</button></div>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm && <div className="dialog-mask" onMouseDown={() => setConfirm(false)}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="确认清空本地历史" onMouseDown={(event) => event.stopPropagation()}>
        <h2>清空本地历史？</h2><p>只清空这台设备上的对话记录，不会删除你的路线和知识脉络。</p>
        <div><button onClick={() => setConfirm(false)}>取消</button><button onClick={() => { clearChatHistory(); setConfirm(false); setNotice('本地历史已清空') }}>确认清空</button></div>
      </section>
    </div>}
  </main>
}
