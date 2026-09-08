import { useEffect,useLayoutEffect,useRef,useState,type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ACTIVE_HISTORY_KEY,CHAT_LAUNCH_KEY,HISTORY_CHANGE_EVENT,HISTORY_OPEN_EVENT,readChatHistory } from '../history'
import { Icon,MountainMark } from '../icons'
import { productRequest } from '../learning-v2/client'
import { useProductLibrary } from '../learning-v2/library'
import { resolveAccountIdentity } from '../resolve-account-identity'
import { type HistoryReopenResolution } from '../resolve-history-reopen'
import { FlowithGlyph } from '../ui/FlowithGlyph'
import { setActiveConversation } from '../workspace/nav'
import { getConversation } from '../workspace/store'

function profileMenuBox(button: HTMLElement, collapsed: boolean) {
  const rect = button.getBoundingClientRect()
  return collapsed
    ? { left: Math.round(rect.right + 8), bottom: Math.round(window.innerHeight - rect.bottom) }
    : { left: Math.round(rect.left), bottom: Math.round(window.innerHeight - rect.top + 8) }
}

export type RouteName = 'home' | 'chat' | 'paths' | 'path-3d' | 'knowledge' | 'knowledge-detail' | 'session-learning' | 'authors' | 'settings' | 'not-found'

const compactRoutes = new Set<RouteName>(['knowledge','knowledge-detail','paths','path-3d','session-learning','authors'])
const prototypeAccount = resolveAccountIdentity()

function go(route: RouteName) { location.hash = route }

export function WideShell({ route, children, theme, onThemeChange, onLogout }: { route: RouteName; children: ReactNode; theme: 'light' | 'dark'; onThemeChange: () => void; onLogout: () => void }) {
  const {data:serverLibrary}=useProductLibrary()
  const [narrow,setNarrow]=useState(()=>window.matchMedia('(max-width: 760px)').matches)
  const [collapsed,setCollapsed]=useState(()=>compactRoutes.has(route)||window.matchMedia('(max-width: 760px)').matches)
  const [historyOpen,setHistoryOpen]=useState(true)
  const [history,setHistory]=useState(readChatHistory)
  const [activeHistoryId,setActiveHistoryId]=useState(()=>sessionStorage.getItem(ACTIVE_HISTORY_KEY)??'')
  const [reopen,setReopen]=useState<HistoryReopenResolution|null>(null)
  const [profileOpen,setProfileOpen]=useState(false)
  const [accountIdentity,setAccountIdentity]=useState(prototypeAccount)
  const [menuBox,setMenuBox]=useState<{left:number;bottom:number}|null>(null)
  const previousRoute=useRef(route)
  const profileRef=useRef<HTMLDivElement>(null)
  const menuRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(previousRoute.current!==route){if(compactRoutes.has(route))setCollapsed(true);if(narrow)setCollapsed(true);previousRoute.current=route}},[route,narrow])
  useEffect(()=>{const media=window.matchMedia('(max-width: 760px)');const resize=()=>{setNarrow(media.matches);if(media.matches)setCollapsed(true)};media.addEventListener('change',resize);return()=>media.removeEventListener('change',resize)},[])
  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();location.hash='home';window.setTimeout(()=>document.querySelector<HTMLTextAreaElement>('.home .composer textarea')?.focus(),60)}};addEventListener('keydown',shortcut);return()=>removeEventListener('keydown',shortcut)},[])
  useLayoutEffect(()=>{
    if(!profileOpen){setMenuBox(null);return}
    const place=()=>{
      const button=profileRef.current?.querySelector<HTMLElement>('.tp-profile')
      if(button)setMenuBox(profileMenuBox(button,collapsed))
    }
    place()
    addEventListener('resize',place)
    return()=>removeEventListener('resize',place)
  },[profileOpen,collapsed])
  useEffect(()=>{
    const close=(event:PointerEvent)=>{
      const target=event.target as Node
      if(profileRef.current?.contains(target)||menuRef.current?.contains(target))return
      setProfileOpen(false)
    }
    const escape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return
      if(menuRef.current){setProfileOpen(false);profileRef.current?.querySelector<HTMLButtonElement>('.tp-profile')?.focus()}
      else if(window.matchMedia('(max-width: 760px)').matches)setCollapsed(true)
    }
    addEventListener('pointerdown',close)
    addEventListener('keydown',escape)
    return()=>{removeEventListener('pointerdown',close);removeEventListener('keydown',escape)}
  },[])
  useEffect(()=>{
    let current=true
    void productRequest<{kind:string;provider:string|null;demo?:boolean;profile?:{demo?:boolean}}>('/api/v2/session').then((session) => {
      if(!current)return
      if (session.kind !== 'authenticated') {setAccountIdentity(prototypeAccount);return}
      const demo=session.demo===true||session.profile?.demo===true
      setAccountIdentity({
        kind: 'unavailable',
        reason: 'missing-identity-provider',
        title: demo?'演示账号':session.provider==='zhihu'?'已登录知乎':'已登录账号',
        message: demo?'演示账号 · 示例收藏与创作':'打开账号菜单',
      })
    }).catch(()=>{if(current)setAccountIdentity(prototypeAccount)})
    return()=>{current=false}
  },[])
  useEffect(()=>{const refresh=()=>{setHistory(readChatHistory());setActiveHistoryId(sessionStorage.getItem(ACTIVE_HISTORY_KEY)??'')};addEventListener(HISTORY_CHANGE_EVENT,refresh);addEventListener('storage',refresh);return()=>{removeEventListener(HISTORY_CHANGE_EVENT,refresh);removeEventListener('storage',refresh)}},[])
  const navigate=(target:RouteName)=>{if(compactRoutes.has(target))setCollapsed(true);if(narrow)setCollapsed(true);go(target)}
  const active = route === 'chat' ? 'home' : route === 'path-3d' || route === 'session-learning' ? 'paths' : route === 'knowledge-detail' ? 'knowledge' : route
  const nav = [
    ['home','search','搜索'], ['knowledge','book','知识脉络'], ['paths','route','路线规划'], ['authors','network','博主网络'],
  ] as const
  const serverHistory=serverLibrary?.conversations??[]
  const visibleHistory=serverHistory.map(e=>({...e,experience:e.kind==='path'?'route' as const:e.kind==='learning'?'learning' as const:'answer' as const}))
  const today=visibleHistory.filter((entry)=>Date.now()-entry.updatedAt<24*60*60*1000)
  const recent=visibleHistory.filter((entry)=>{const age=Date.now()-entry.updatedAt;return age>=24*60*60*1000&&age<7*24*60*60*1000})
  const earlier=visibleHistory.filter((entry)=>Date.now()-entry.updatedAt>=7*24*60*60*1000)
  const historyCurrent=route==='chat'||route==='session-learning'
  const historyButton=(entry:(typeof history)[number])=><button type="button" key={entry.id} className={`hist${historyCurrent&&activeHistoryId===entry.id?' is-current':''}`} aria-current={historyCurrent&&activeHistoryId===entry.id?'page':undefined} title={entry.title} onClick={()=>{
    if(narrow)setCollapsed(true)
    const remote=serverHistory?.find(h=>h.id===entry.id)
    if(remote){
      sessionStorage.setItem(ACTIVE_HISTORY_KEY,remote.id)
      if(remote.kind==='learning'){void productRequest(`/api/v2/learning/${remote.resourceId}/commands`,{method:'POST',body:{kind:'activate-conversation',conversationId:remote.id}}).then(()=>{location.hash=`knowledge-detail?resource=${encodeURIComponent(remote.resourceId)}`}).catch(e=>setReopen({kind:'unavailable',title:'暂时未打开',message:e.message} as HistoryReopenResolution));return}
      const stored=remote.kind==='path'?getConversation(remote.id):undefined
      const id=stored?.id??remote.id
      sessionStorage.setItem(CHAT_LAUNCH_KEY,JSON.stringify({query:remote.query,mode:remote.kind==='path'?'route':'answer',conversationId:id,routeId:remote.routeId,generate:false}));setActiveConversation(id);location.hash='chat';window.dispatchEvent(new Event(HISTORY_OPEN_EVENT));return
    }
  }}><span className="t">{entry.title}</span></button>
  return <div className={`tp-shell ux-flowith-shell ${collapsed?'is-collapsed':''}`} data-page={route}>
    <div className="shell">
        {narrow&&!collapsed&&<button className="tp-sidebar-backdrop" aria-label="关闭导航" onClick={()=>setCollapsed(true)} />}
    <aside className="sidebar tp-sidebar" aria-label="问山主导航">
      <div className="side-body">
        <div className="side-top">
          <div className="logo-wrap">
            <button type="button" className="logo-btn tp-wordmark" aria-label="问山首页" onClick={() => navigate('home')}>
              <MountainMark size={20}/>
              <strong>问山</strong>
            </button>
          </div>
          <button type="button" className="icon-btn tp-collapse" aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={()=>setCollapsed((value)=>!value)}>
            <FlowithGlyph name="collapse" size={14} />
          </button>
        </div>
        <nav className="nav">
          {nav.map(([id, glyph, label]) => <button type="button" key={id} className={`nav-item tp-nav ${active === id ? 'is-active' : ''}`} aria-label={label} onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined}>
            <FlowithGlyph name={glyph} size={16}/><span>{label}</span>
          </button>)}
          <div className="nav-item nav-slot" aria-hidden="true" />
        </nav>
        <div className="sec-row proj" aria-hidden="true" />
        <section className={`tp-history ${historyOpen?'is-open':''}`} aria-label="历史记录">
          <div className="sec-row hist-head">
            <button type="button" className="sec-lab tp-history-toggle" aria-label={historyOpen?'收起聊天历史':'展开聊天历史'} aria-expanded={historyOpen} onClick={()=>setHistoryOpen((value)=>!value)}>
              <span>历史记录</span>
              <span className="caret"><FlowithGlyph name="caret" size={12} /></span>
            </button>
          </div>
          {historyOpen&&<div className="hist-list">{reopen?.kind==='unavailable'&&<p className="tp-history-empty" role="alert">{reopen.title}。{reopen.message}</p>}{visibleHistory.length===0?<p className="tp-history-empty">暂无聊天历史</p>:<>{today.length>0&&<>{today.map(historyButton)}</>}{recent.length>0&&<>{recent.map(historyButton)}</>}{earlier.length>0&&<>{earlier.map(historyButton)}</>}</>}</div>}
        </section>
      </div>
      <div className="tp-profile-wrap user" ref={profileRef}>
        {profileOpen&&menuBox&&createPortal(<div ref={menuRef} className="tp-profile-menu" role="menu" aria-label="账号菜单" style={menuBox}>
          <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); go('settings') }}><Icon name="panel" size={20}/><span>设置</span></button>
          <button type="button" role="menuitem" onClick={onThemeChange}><Icon name="moon" size={20}/><span>夜间模式</span><i className={`theme-switch ${theme==='dark'?'is-on':''}`} aria-hidden="true"><b/></i></button>
          <button type="button" role="menuitem" className="is-danger" onClick={onLogout}><Icon name="logout" size={20}/><span>退出登录</span></button>
        </div>,document.body)}
        <button type="button" className="tp-profile user" aria-label="打开账号菜单" aria-expanded={profileOpen} title={accountIdentity.message} onClick={()=>setProfileOpen((value)=>!value)}>
          <div className="user-ava"><span><Icon name="user" size={18} /></span></div>
          <div className="name"><b>{accountIdentity.title}</b></div>
          <div className="free-chip">{accountIdentity.title==='演示账号'?'演示':accountIdentity.title === '已登录知乎' ? '知乎' : accountIdentity.title==='已登录账号'?'账号':'本地'}</div>
        </button>
      </div>
    </aside>
    <section className={`stage tp-panel${route==='home'?' stage-home':''}`}>{children}</section>
    </div>
  </div>
}

export function ProductWorkspace({ children, page }: { active: 'knowledge' | 'paths' | 'authors'; children: ReactNode; page: RouteName }) {
  return <div className="product-workspace without-library" data-page={page}>{children}</div>
}
