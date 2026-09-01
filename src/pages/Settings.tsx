import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { clearChatHistory } from '../history'

export function SettingsPage() {
  const [compact,setCompact]=useState(false)
  const [reduce,setReduce]=useState(false)
  const [confirm,setConfirm]=useState(false)
  const [thinking,setThinking]=useState<'快速回答'|'智能思考'|'深度思考'>('快速回答')
  const [scope,setScope]=useState<'知乎 · PDF'|'仅知乎'|'仅 PDF'>('知乎 · PDF')
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
  const cycleScope=()=>setScope((value)=>value==='知乎 · PDF'?'仅知乎':value==='仅知乎'?'仅 PDF':'知乎 · PDF')

  return <main className="settings-page">
    <header><h1>设置</h1></header>
    <section>
      <h2>个人信息</h2>
      <div className="setting-row">
        <span className="settings-avatar"><Icon name="user" size={24}/></span>
        <div><b>吴贤明</b><small>当前登录用户 · 咨询推荐以你的学习记录为准</small></div>
      </div>
      <h2>回答偏好</h2>
      <div className="setting-row"><div><b>默认思考深度</b><small>{thinking}</small></div><button aria-label="切换默认思考深度" onClick={cycleThinking}>{thinking}</button></div>
      <div className="setting-row"><div><b>资料范围</b><small>{scope==='知乎 · PDF'?'知乎内容与已上传 PDF':scope}</small></div><button aria-label="切换资料范围" onClick={cycleScope}>{scope}</button></div>
      <h2>界面</h2>
      <div className="setting-row"><div><b>紧凑密度</b><small>缩短列表与控件间距</small></div><button className={`switch ${compact?'is-on':''}`} aria-label="紧凑密度" role="switch" aria-checked={compact} onClick={()=>setCompact(!compact)}><i/></button></div>
      <div className="setting-row"><div><b>减少动态效果</b><small>减少非必要的浮动与过渡</small></div><button className={`switch ${reduce?'is-on':''}`} aria-label="减少动态效果" role="switch" aria-checked={reduce} onClick={()=>setReduce(!reduce)}><i/></button></div>
      <h2>历史记录</h2>
      <div className="setting-row danger"><div><b>清空本地历史</b><small>只清空 ThreadPeak 本地会话，不影响知乎内容与 PDF</small></div><button onClick={()=>setConfirm(true)}>清空</button></div>
      {notice&&<p className="settings-notice" role="status">{notice}</p>}
    </section>
    {confirm&&<div className="dialog-mask" onMouseDown={()=>setConfirm(false)}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="确认清空本地历史" onMouseDown={(event)=>event.stopPropagation()}>
        <h2>清空本地历史？</h2><p>该操作不会删除知乎来源或你上传的 PDF，只清空本机上的会话索引。</p>
        <div><button onClick={()=>setConfirm(false)}>取消</button><button onClick={()=>{clearChatHistory();setConfirm(false);setNotice('本地历史已清空')}}>确认清空</button></div>
      </section>
    </div>}
  </main>
}
