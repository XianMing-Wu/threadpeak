import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, MountainMark } from '../icons'
import { ACTIVE_HISTORY_KEY, HISTORY_CHANGE_EVENT, HISTORY_OPEN_EVENT, openChatHistory, readChatHistory } from '../history'
import { hydrateLearningHistory } from '../workspace/store'

export type RouteName = 'home' | 'chat' | 'paths' | 'path-3d' | 'knowledge' | 'knowledge-detail' | 'session-learning' | 'authors' | 'settings'

const compactRoutes = new Set<RouteName>(['chat','knowledge','knowledge-detail','paths','path-3d','session-learning','authors'])

function go(route: RouteName) { location.hash = route }

export function WideShell({ route, children, theme, onThemeChange, onLogout }: { route: RouteName; children: ReactNode; theme: 'light' | 'dark'; onThemeChange: () => void; onLogout: () => void }) {
  const [collapsed,setCollapsed]=useState(()=>compactRoutes.has(route))
  const [historyOpen,setHistoryOpen]=useState(true)
  const [history,setHistory]=useState(readChatHistory)
  const [activeHistoryId,setActiveHistoryId]=useState(()=>sessionStorage.getItem(ACTIVE_HISTORY_KEY)??'')
  const [profileOpen,setProfileOpen]=useState(false)
  const previousRoute=useRef(route)
  const profileRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(previousRoute.current!==route){if(compactRoutes.has(route))setCollapsed(true);previousRoute.current=route}},[route])
  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();location.hash='home';window.setTimeout(()=>document.querySelector<HTMLTextAreaElement>('.home .composer textarea')?.focus(),60)}};addEventListener('keydown',shortcut);return()=>removeEventListener('keydown',shortcut)},[])
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!profileRef.current?.contains(event.target as Node))setProfileOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setProfileOpen(false)};addEventListener('pointerdown',close);addEventListener('keydown',escape);return()=>{removeEventListener('pointerdown',close);removeEventListener('keydown',escape)}},[])
  useEffect(()=>{hydrateLearningHistory();setHistory(readChatHistory());setActiveHistoryId(sessionStorage.getItem(ACTIVE_HISTORY_KEY)??'')},[])
  useEffect(()=>{const refresh=()=>{setHistory(readChatHistory());setActiveHistoryId(sessionStorage.getItem(ACTIVE_HISTORY_KEY)??'')};addEventListener(HISTORY_CHANGE_EVENT,refresh);addEventListener(HISTORY_OPEN_EVENT,refresh);addEventListener('storage',refresh);return()=>{removeEventListener(HISTORY_CHANGE_EVENT,refresh);removeEventListener(HISTORY_OPEN_EVENT,refresh);removeEventListener('storage',refresh)}},[])
  const navigate=(target:RouteName)=>{if(compactRoutes.has(target))setCollapsed(true);go(target)}
  const active = route === 'chat' ? 'home' : route === 'path-3d' || route === 'session-learning' ? 'paths' : route === 'knowledge-detail' ? 'knowledge' : route
  const nav = [
    ['home','search','搜索'], ['knowledge','book','知识脉络'], ['paths','route','路线规划'], ['authors','network','博主网络'],
  ] as const
  const today=history.filter((entry)=>Date.now()-entry.updatedAt<24*60*60*1000)
  const recent=history.filter((entry)=>{const age=Date.now()-entry.updatedAt;return age>=24*60*60*1000&&age<7*24*60*60*1000})
  const earlier=history.filter((entry)=>Date.now()-entry.updatedAt>=7*24*60*60*1000)
  const historyCurrent=route==='chat'||route==='session-learning'
  const historyButton=(entry:(typeof history)[number])=><button key={entry.id} className={historyCurrent&&activeHistoryId===entry.id?'is-current':''} aria-current={historyCurrent&&activeHistoryId===entry.id?'page':undefined} title={entry.title} onClick={()=>openChatHistory(entry)}>{entry.title}</button>
  return <div className={`tp-shell ${collapsed?'is-collapsed':''}`} data-page={route}>
    <aside className="tp-sidebar" aria-label="问山主导航">
      <button type="button" className="tp-collapse" aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={()=>setCollapsed((value)=>!value)}><Icon name="collapse" size={18}/></button>
      <button type="button" className="tp-wordmark" aria-label="问山首页" onClick={() => navigate('home')}><MountainMark size={28}/><strong>问山</strong></button>
      <nav>
        {nav.map(([id, glyph, label]) => <button type="button" key={id} className={`tp-nav ${active === id ? 'is-active' : ''}`} aria-label={label} onClick={() => navigate(id)} aria-current={active === id ? 'page' : undefined}>
          <Icon name={glyph} size={id === 'home' ? 18 : 20}/><span>{label}</span>{id === 'home' && <span className="tp-shortcut"><kbd>⌘</kbd><kbd>K</kbd></span>}
        </button>)}
      </nav>
      <section className={`tp-history ${historyOpen?'is-open':''}`} aria-label="历史记录">
        <button type="button" className="tp-history-toggle" aria-label={historyOpen?'收起聊天历史':'展开聊天历史'} aria-expanded={historyOpen} onClick={()=>setHistoryOpen((value)=>!value)}><Icon name="history" size={20}/><span>历史</span><Icon name="chevron" size={15}/></button>
        {historyOpen&&<div>{history.length===0?<p className="tp-history-empty">暂无聊天历史</p>:<>{today.length>0&&<><small>今天</small>{today.map(historyButton)}</>}{recent.length>0&&<><small>近 7 天</small>{recent.map(historyButton)}</>}{earlier.length>0&&<><small>更早</small>{earlier.map(historyButton)}</>}</>}</div>}
      </section>
      <div className="tp-profile-wrap" ref={profileRef}>
        {profileOpen&&<div className="tp-profile-menu" role="menu" aria-label="账号菜单">
          <button type="button" role="menuitem" onClick={onThemeChange}><Icon name="moon" size={20}/><span>夜间模式</span><i className={`theme-switch ${theme==='dark'?'is-on':''}`} aria-hidden="true"><b/></i></button>
          <button type="button" role="menuitem" className="is-danger" onClick={onLogout}><Icon name="logout" size={20}/><span>退出登录</span></button>
        </div>}
        <button type="button" className="tp-profile" aria-label="打开账号菜单" aria-expanded={profileOpen} onClick={()=>setProfileOpen((value)=>!value)}><span><Icon name="user" size={21}/></span><b>吴贤明</b></button>
      </div>
    </aside>
    <section className="tp-panel">{children}</section>
  </div>
}

export function ProductWorkspace({ children, page }: { active: 'knowledge' | 'paths' | 'authors'; children: ReactNode; page: RouteName }) {
  return <div className="product-workspace without-library" data-page={page}>{children}</div>
}
