import { lazy,Suspense,startTransition,useEffect,useState } from 'react'
import { WideShell,type RouteName } from './components/Shell'
import { IconSprite } from './icons'
import { ensureSession } from './learning-v2/client'
import { switchWorkspace } from './learning-v2/account-storage'
import { clearProductLibrary } from './learning-v2/library'
import { oauthNotice,requestAuthLogout,requestGuestSession } from './runtime/request-auth-session'
import {PageBoundary} from './components/PageBoundary'
import {ProductIntroduction} from './pages/ProductIntroduction'


const HomePage=lazy(()=>import('./pages/Home').then(m=>({default:m.HomePage})))
const ChatPage=lazy(()=>import('./pages/Chat').then(m=>({default:m.ChatPage})))
const KnowledgePage=lazy(()=>import('./pages/Collections').then(m=>({default:m.KnowledgePage})))
const KnowledgeDetailPage=lazy(()=>import('./pages/Collections').then(m=>({default:m.KnowledgeDetailPage})))
const PathsPage=lazy(()=>import('./pages/Collections').then(m=>({default:m.PathsPage})))
const Path3DPage=lazy(()=>import('./pages/Collections').then(m=>({default:m.Path3DPage})))
const SessionPage=lazy(()=>import('./pages/Session').then(m=>({default:m.SessionPage})))
const AuthorsPage=lazy(()=>import('./learning-v2/Authors').then(m=>({default:m.DurableAuthorsPage})))
const SettingsPage=lazy(()=>import('./pages/Settings').then(m=>({default:m.SettingsPage})))
const AuthLanding=lazy(()=>import('./pages/AuthLanding').then(m=>({default:m.AuthLanding})))
const NotFoundPage=lazy(()=>import('./pages/NotFound').then(m=>({default:m.NotFoundPage})))

const routes = new Set<RouteName>(['home','chat','paths','path-3d','knowledge','knowledge-detail','session-learning','authors','settings'])
function readRoute(hash:string):RouteName {
  const key=hash.slice(1).split('?')[0] as RouteName
  if (!key) return 'home'
  return routes.has(key)?key:'not-found'
}
const THEME_KEY='threadpeak-theme'
type Theme = 'light' | 'dark'
function readThemePreference(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch { return null }
}
function systemTheme(): Theme { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' }
export function App(){
  const[notice,setNotice]=useState('')
  const[sessionReady,setSessionReady]=useState(false)
  const[hash,setHash]=useState(()=>location.hash)
  const introduction=(!hash||hash==='#intro')&&!new URLSearchParams(location.search).has('oauth')
  const login=hash==='#login'
  const route=readRoute(hash)
  const[authenticated,setAuthenticated]=useState(false)
  const[themePreference,setThemePreference]=useState<Theme|null>(readThemePreference)
  const[systemAppearance,setSystemAppearance]=useState<Theme>(systemTheme)
  const theme=themePreference??systemAppearance
  useEffect(()=>{const onHash=()=>startTransition(()=>setHash(location.hash));addEventListener('hashchange',onHash);return()=>removeEventListener('hashchange',onHash)},[])
  useEffect(()=>{
    document.documentElement.dataset.theme=theme
    document.documentElement.style.colorScheme=theme
    document.documentElement.style.backgroundColor=`var(--surface-rail, ${theme==='dark'?'#111317':'#f4f6f9'})`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111317':'#f4f6f9')
  },[theme])
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const update=()=>setSystemAppearance(media.matches?'dark':'light')
    const sync=(event:StorageEvent)=>{if(event.key===THEME_KEY||event.key===null)setThemePreference(readThemePreference())}
    media.addEventListener('change',update)
    addEventListener('storage',sync)
    return()=>{media.removeEventListener('change',update);removeEventListener('storage',sync)}
  },[])
  useEffect(()=>{
    if(introduction)return
    let active=true
    void ensureSession().then(()=>{if(!active)return;setAuthenticated(true);const url=new URL(location.href);if(url.searchParams.has('oauth')){setNotice(oauthNotice(url.search));url.searchParams.delete('oauth');if(!routes.has(url.hash.slice(1).split('?')[0] as RouteName))url.hash='home';history.replaceState(null,'',url);setHash(url.hash)}setSessionReady(true)}).catch(()=>{if(active){setAuthenticated(false);setSessionReady(true)}})
    return()=>{active=false}
  },[introduction])
  const toggleTheme=()=>{
    const next=theme==='dark'?'light':'dark'
    setThemePreference(next)
    try {localStorage.setItem(THEME_KEY,next)} catch { /* Keep the explicit choice for this session. */ }
  }
  const logout=()=>{
    void requestAuthLogout().then(async()=>{clearProductLibrary();setAuthenticated(false);location.hash='login';await switchWorkspace('anonymous')}).catch(e=>setNotice(e instanceof Error?e.message:'退出登录暂未完成。'))
  }
  const authorize=async()=>{await requestGuestSession();setAuthenticated(true);setSessionReady(true);history.replaceState(null,'',`${location.pathname}#home`);setHash('#home')}
  const pages={home:<HomePage/>,chat:<ChatPage/>,knowledge:<KnowledgePage/>,'knowledge-detail':<KnowledgeDetailPage/>,paths:<PathsPage/>,'path-3d':<Path3DPage/>,'session-learning':<SessionPage/>,authors:<AuthorsPage/>,'not-found':<NotFoundPage/>,settings:<SettingsPage theme={theme} onThemeChange={toggleTheme} onLogout={logout}/>}
  useEffect(()=>{const titles:Record<string,string>={home:'首页',chat:'对话',paths:'学习路线','path-3d':'3D 路线',knowledge:'知识脉络','knowledge-detail':'概念学习','session-learning':'概念学习',authors:'找人请教',settings:'设置','not-found':'页面不存在'};document.title=`${introduction?'想做什么，就学什么':login?'登录':titles[route]} · 问山 ThreadPeak`},[route,introduction,login])
  const params=new URLSearchParams(hash.split('?')[1]??'')
  const pageKey=route==='knowledge-detail'?`${route}:${params.get('resource')??params.get('id')??''}`:route==='session-learning'?route:hash
  const page=pages[route]
  return <><IconSprite/>{notice&&<div role="alert">{notice}<button onClick={()=>setNotice('')}>关闭</button></div>}<Suspense fallback={<main className="auth-landing" aria-busy="true"/>}>{introduction?<ProductIntroduction/>:login?<AuthLanding theme={theme} onThemeChange={toggleTheme} onAuthorize={authorize}/>:!sessionReady?<main className="auth-landing"><p role="status">正在连接你的工作区…</p></main>:authenticated?<WideShell route={route} theme={theme} onThemeChange={toggleTheme} onLogout={logout}><Suspense fallback={<div className="workspace-loading" role="status" aria-label="正在打开工作区"><span/><span/><span/></div>}><PageBoundary key={pageKey}>{page}</PageBoundary></Suspense></WideShell>:<AuthLanding theme={theme} onThemeChange={toggleTheme} onAuthorize={authorize}/>}</Suspense></>
}
