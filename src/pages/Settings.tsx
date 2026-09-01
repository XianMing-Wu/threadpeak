import { useEffect, useState } from 'react'
import { clearChatHistory } from '../history'
import { resolveSettingsIdentity, resolveSettingsSources } from '../resolve-settings-identity'

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

export function SettingsPage() {
  const [compact,setCompact]=useState(false)
  const [reduce,setReduce]=useState(false)
  const [confirm,setConfirm]=useState(false)
  const [thinking,setThinking]=useState<'快速回答'|'智能思考'|'深度思考'>('快速回答')
  const [notice,setNotice]=useState('')

  useEffect(()=>{
    document.documentElement.dataset.density=compact?'compact':'comfortable'
    document.documentElement.dataset.reduceMotion=String(reduce)
    return()=>{
      delete document.documentElement.dataset.density
      delete document.documentElement.dataset.reduceMotion
    }
  },[compact,reduce])

  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setConfirm(false)}
    addEventListener('keydown',escape)
    return()=>removeEventListener('keydown',escape)
  },[])

  const cycleThinking=()=>setThinking((value)=>value==='快速回答'?'智能思考':value==='智能思考'?'深度思考':'快速回答')

  return <main className="settings-page">
    <header><h1>设置</h1></header>
    <section>
      <h2>个人信息</h2>
      <SettingsIdentityUnavailable/>
      <h2>回答偏好</h2>
      <div className="setting-row"><div><b>默认思考深度</b><small>{thinking}</small></div><button aria-label="切换默认思考深度" onClick={cycleThinking}>{thinking}</button></div>
      <h2>资料范围</h2>
      <SettingsSourcesUnavailable/>
      <h2>界面</h2>
      <div className="setting-row"><div><b>紧凑密度</b><small>缩短列表与控件间距</small></div><button className={`switch ${compact?'is-on':''}`} aria-label="紧凑密度" role="switch" aria-checked={compact} onClick={()=>setCompact(!compact)}><i/></button></div>
      <div className="setting-row"><div><b>减少动态效果</b><small>减少非必要的浮动与过渡</small></div><button className={`switch ${reduce?'is-on':''}`} aria-label="减少动态效果" role="switch" aria-checked={reduce} onClick={()=>setReduce(!reduce)}><i/></button></div>
      <h2>历史记录</h2>
      <div className="setting-row danger"><div><b>清空本地历史</b><small>只清空本机上的会话草稿索引</small></div><button onClick={()=>setConfirm(true)}>清空</button></div>
      {notice&&<p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm&&<div className="dialog-mask" onMouseDown={()=>setConfirm(false)}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="确认清空本地历史" onMouseDown={(event)=>event.stopPropagation()}>
        <h2>清空本地历史？</h2><p>只清空本机上的会话草稿索引，不会把它当成已提交的知乎来源或已上传 PDF。</p>
        <div><button onClick={()=>setConfirm(false)}>取消</button><button onClick={()=>{clearChatHistory();setConfirm(false);setNotice('本地历史已清空')}}>确认清空</button></div>
      </section>
    </div>}
  </main>
}
