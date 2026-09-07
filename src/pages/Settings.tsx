import { productRequest } from '../learning-v2/client'
import { requestAuthStart } from '../runtime/request-auth-session'
import { useEffect, useState } from 'react'
import { clearChatHistory } from '../history'
import { requestAuthSession } from '../runtime/request-auth-session'

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
  const [account,setAccount]=useState<{name?:string;demo?:boolean;mode?:'real'|'mock'}|null>(null),[connected,setConnected]=useState(false),[demoMode,setDemoMode]=useState(false)
  useEffect(()=>{void productRequest<any>('/api/v2/session').then(s=>{setAccount(s.profile??null);setOauthSignedIn(s.provider==='zhihu')}).catch(()=>setNotice('账号信息暂未读取完成，请稍后重新进入设置。'));void fetch('/api/auth/config').then(r=>r.json()).then(c=>{setConnected(c.zhihuAvailable);setDemoMode(c.zhihuMode==='mock')}).catch(()=>setConnected(false))},[])
  const connect=async()=>{const result=await requestAuthStart();if(result.kind==='redirect')location.href=result.authorizeUrl;else setNotice(result.message)}

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirm(false) }
    addEventListener('keydown', escape)
    return () => removeEventListener('keydown', escape)
  }, [])
  useEffect(() => {
    void requestAuthSession().then((session) => {
      setOauthSignedIn(session.kind === 'authenticated'&&session.provider==='zhihu')
    })
  }, [])

  return <main className="settings-page">
    <header><h1>设置</h1></header>
    <section>
      <h2>个人信息</h2>
      <article className="setting-row"><div><b>{oauthSignedIn?account?.name??'已连接知乎':'本地工作区'}{account?.demo&&<span> · 演示账号</span>}</b><small>{account?.demo?'当前使用示例收藏与创作，演示作者不代表真实博主。':oauthSignedIn?'已连接你的知乎账号，公开收藏与创作需由你主动选择后读取。':'学习内容保存在当前工作区。'}</small></div>{!oauthSignedIn&&<button disabled={!connected} onClick={()=>void connect()}>{connected?demoMode?'体验演示账号':'连接知乎账号':'知乎连接暂未开放'}</button>}</article>
      <h2>资料范围</h2>
      <article className="setting-row"><div><b>文件、公开收藏夹与创作</b><small>在首页选择资料，生成路线后可在每个概念中继续阅读与引用。不会自动读取未选择的收藏夹。</small></div></article>
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
