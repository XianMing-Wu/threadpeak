import { useEffect, useState } from 'react'
import { clearChatHistory } from '../history'
import { resolveSettingsIdentity, resolveSettingsSources } from '../resolve-settings-identity'
import { requestAuthSession } from '../runtime/request-auth-session'

function SettingsIdentityUnavailable() {
  const resolution = resolveSettingsIdentity()
  return <article className="setting-row" role="alert">
    <div><b>{resolution.title}</b><small>{resolution.message}</small></div>
  </article>
}

function SettingsSourcesUnavailable() {
  const resolution = resolveSettingsSources()
  return <article className="setting-row" role="alert">
    <div><b>{resolution.title}</b><small>{resolution.message}</small></div>
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
        ? <article className="setting-row"><div><b>知乎已授权</b><small>当前会话来自服务端 OAuth。官方文档未给出用户信息接口字段时，不编造姓名或邮箱。</small></div></article>
        : <SettingsIdentityUnavailable/>}
      <h2>资料范围</h2>
      <SettingsSourcesUnavailable/>
      <h2>界面</h2>
      <div className="setting-row">
        <div><b>夜间模式</b><small>只改变本机外观，不改变学习内容</small></div>
        <button className={`switch ${theme === 'dark' ? 'is-on' : ''}`} aria-label="夜间模式" role="switch" aria-checked={theme === 'dark'} onClick={onThemeChange}><i/></button>
      </div>
      <h2>历史记录</h2>
      <div className="setting-row danger"><div><b>清空本地历史</b><small>只清空本机上的会话草稿索引，不删除我的路线、知识图和已固定首轮</small></div><button onClick={() => setConfirm(true)}>清空</button></div>
      <h2>账号</h2>
      <div className="setting-row danger"><div><b>退出登录</b><small>回到知乎授权页</small></div><button onClick={onLogout}>退出</button></div>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm && <div className="dialog-mask" onMouseDown={() => setConfirm(false)}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="确认清空本地历史" onMouseDown={(event) => event.stopPropagation()}>
        <h2>清空本地历史？</h2><p>只清空本机上的会话草稿索引，不会把它当成已提交的知乎来源或已上传 PDF，也不会删除我的路线、知识图和已固定首轮。</p>
        <div><button onClick={() => setConfirm(false)}>取消</button><button onClick={() => { clearChatHistory(); setConfirm(false); setNotice('本地历史已清空') }}>确认清空</button></div>
      </section>
    </div>}
  </main>
}
