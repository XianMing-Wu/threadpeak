import { useWorkspaceSession } from '../runtime/workspace-session'
import { useEffect, useRef, useState } from 'react'
import { productRequest } from '../learning-v2/client'
import { clearCurrentAccountData } from '../learning-v2/account-storage'
import { clearProductLibrary } from '../learning-v2/library'
import { requestAuthStart } from '../runtime/request-auth-session'
import { AccountAvatar } from '../components/AccountAvatar'

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
  const [clearing,setClearing]=useState(false)
  const clearIdentity=useRef<{workspace:string;generation:string}|null>(null)
  const clearKey=useRef<string|undefined>(undefined)
  const clearData=async()=>{
    if(clearing)return
    setClearing(true);setNotice('')
    try{
      const owner=clearIdentity.current?.workspace
      if(!owner)throw new Error('请先连接当前账号。')
      clearKey.current??=crypto.randomUUID()
      const result=await productRequest<{cleared:boolean}>('/api/v2/workspace/clear',{method:'POST',key:clearKey.current,workspace:owner,generation:clearIdentity.current?.generation,body:{confirm:'clear-all-learning-data'}})
      if(result.cleared!==true)throw new Error('清空尚未确认完成，原记录仍保留。')
      await clearCurrentAccountData(owner)
      localStorage.setItem('threadpeak-workspace-reset',owner+':'+crypto.randomUUID())
      clearProductLibrary();setConfirm(false);setNotice('全部学习数据已清空')
      window.dispatchEvent(new Event('threadpeak:workspace-cleared'))
    }catch(error){setNotice(error instanceof Error?error.message:'清空未完成，请稍后重试。')}
    finally{setClearing(false)}
  }
  const [connecting, setConnecting] = useState(false)
  const confirmRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const session=useWorkspaceSession(),account=session?.profile
  const oauthSignedIn=session?.capabilities?.zhihuMaterials===true
  const expired=session?.authorization?.status==='expired'
  const reconnect=async()=>{
    if(connecting)return
    setConnecting(true);setNotice('')
    try{const result=await requestAuthStart();if(result.kind==='redirect')location.href=result.authorizeUrl;else setNotice(result.message)}
    catch{setNotice('暂时无法连接知乎，请稍后重试。')}
    finally{setConnecting(false)}
  }


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
      <article className="setting-row setting-profile"><AccountAvatar key={session?.workspaceId} session={session}/><div><b>{oauthSignedIn?account?.name??'已连接知乎':session?.kind==='authenticated'?'已登录账号':'游客'}{account?.demo&&<span> · 演示账号</span>}</b><small>{account?.demo?'当前使用示例收藏与创作，演示作者不代表真实博主。':oauthSignedIn?'已连接你的知乎账号，公开收藏与创作需由你主动选择后读取。':'路线、知识脉络与学习进度会自动保存；在此浏览器继续使用。'}</small></div></article>
      <h2>资料范围</h2>
      <article className="setting-row"><div><b>{oauthSignedIn?'文件、公开收藏夹与创作':'学习文件'}</b><small>在首页添加资料，生成路线后可在每个概念中继续阅读与引用。{oauthSignedIn?'不会自动读取未选择的收藏夹。':''}</small></div></article>
      <h2>界面</h2>
      <div className="setting-row">
        <div><b>夜间模式</b><small>只改变本机外观，不改变学习内容</small></div>
        <button className={`switch ${theme === 'dark' ? 'is-on' : ''}`} aria-label="夜间模式" role="switch" aria-checked={theme === 'dark'} onClick={onThemeChange}><i/></button>
      </div>
      <h2>历史记录</h2>
      <div className="setting-row danger"><div><b>清空全部学习数据</b><small>清空当前账号的所有对话、路线、知识脉络、博主网络、上传资料和本机草稿</small></div><button onClick={(event) => { openerRef.current = event.currentTarget; clearIdentity.current={workspace:localStorage.getItem('tp-server-workspace')??'',generation:localStorage.getItem('tp-data-generation')??'0'}; setConfirm(true) }}>清空</button></div>
      <h2>账号</h2>
      {oauthSignedIn&&<div className="setting-row"><div><b>{expired?'知乎授权已到期':'知乎授权'}</b><small>{expired?'重新连接后可继续读取收藏夹与公开创作，已有学习记录保留。':'需要更新授权时，可重新连接知乎账号。'}</small></div><button disabled={connecting} onClick={()=>void reconnect()}>{connecting?'正在连接…':'重新连接'}</button></div>}
      <div className="setting-row danger"><div><b>退出登录</b><small>退出后需要重新登录</small></div><button onClick={onLogout}>退出</button></div>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm && <dialog ref={confirmRef} className="confirm-dialog" aria-labelledby="clear-history-title" aria-describedby="clear-history-description"
      onCancel={(event) => { event.preventDefault(); if(!clearing)setConfirm(false) }} onClose={(event) => { if (!event.currentTarget.open) setConfirm(false) }}
      onClick={(event) => { if (!clearing && event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setConfirm(false) } }}>
      <h2 id="clear-history-title">清空全部学习数据？</h2><p id="clear-history-description">清空当前账号的所有对话、路线、知识脉络、博主网络、上传资料和本机草稿。正在生成的任务也会停止，此操作无法撤销。账号登录保持不变。</p>
      {notice&&<p role="alert">{notice}</p>}
      <div><button ref={cancelRef} disabled={clearing} type="button" onClick={() => setConfirm(false)}>取消</button><button type="button" disabled={clearing} onClick={()=>void clearData()}>{clearing?'正在清空…':'确认清空'}</button></div>
    </dialog>}
  </main>
}
