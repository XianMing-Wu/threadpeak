import { useWorkspaceSession } from '../runtime/workspace-session'
import { useEffect, useRef, useState } from 'react'
import { clearChatHistory } from '../history'

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
  const confirmRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const session=useWorkspaceSession(),account=session?.profile
  const oauthSignedIn=session?.provider==='zhihu'


  useEffect(() => {
    if (!confirm) return
    const dialog = confirmRef.current
    if (!dialog) return
    dialog.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog.close()
      openerRef.current?.focus()
    }
  }, [confirm])


  return <main className="settings-page">
    <header><h1>设置</h1></header>
    <section>
      <h2>个人信息</h2>
      <article className="setting-row"><div><b>{oauthSignedIn?account?.name??'已连接知乎':'游客'}{account?.demo&&<span> · 演示账号</span>}</b><small>{account?.demo?'当前使用示例收藏与创作，演示作者不代表真实博主。':oauthSignedIn?'已连接你的知乎账号，公开收藏与创作需由你主动选择后读取。':'路线、知识脉络与学习进度会自动保存；在此浏览器继续使用。'}</small></div></article>
      <h2>资料范围</h2>
      <article className="setting-row"><div><b>{oauthSignedIn?'文件、公开收藏夹与创作':'学习文件'}</b><small>在首页添加资料，生成路线后可在每个概念中继续阅读与引用。{oauthSignedIn?'不会自动读取未选择的收藏夹。':''}</small></div></article>
      <h2>界面</h2>
      <div className="setting-row">
        <div><b>夜间模式</b><small>只改变本机外观，不改变学习内容</small></div>
        <button className={`switch ${theme === 'dark' ? 'is-on' : ''}`} aria-label="夜间模式" role="switch" aria-checked={theme === 'dark'} onClick={onThemeChange}><i/></button>
      </div>
      <h2>历史记录</h2>
      <div className="setting-row danger"><div><b>清空本地历史</b><small>只清空这台设备上的对话记录，不会删除你的路线和知识脉络</small></div><button onClick={(event) => { openerRef.current = event.currentTarget; setConfirm(true) }}>清空</button></div>
      <h2>账号</h2>
      <div className="setting-row danger"><div><b>退出登录</b><small>退出后需要重新登录</small></div><button onClick={onLogout}>退出</button></div>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm && <dialog ref={confirmRef} className="confirm-dialog" aria-labelledby="clear-history-title" aria-describedby="clear-history-description"
      onCancel={(event) => { event.preventDefault(); setConfirm(false) }} onClose={(event) => { if (!event.currentTarget.open) setConfirm(false) }}
      onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setConfirm(false) } }}>
      <h2 id="clear-history-title">清空本地历史？</h2><p id="clear-history-description">只清空这台设备上的对话记录，不会删除你的路线和知识脉络。</p>
      <div><button ref={cancelRef} type="button" onClick={() => setConfirm(false)}>取消</button><button type="button" onClick={() => { clearChatHistory(); setConfirm(false); setNotice('本地历史已清空') }}>确认清空</button></div>
    </dialog>}
  </main>
}
