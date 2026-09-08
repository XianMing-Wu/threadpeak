import { lazy,Suspense,useEffect,useState } from 'react'
import { WideShell,type RouteName } from './components/Shell'
import { IconSprite } from './icons'
import { ensureSession } from './learning-v2/client'
import { clearProductLibrary } from './learning-v2/library'
import { requestAuthLogout,requestAuthSession } from './runtime/request-auth-session'


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
function readRoute():RouteName {
  const key=location.hash.slice(1).split('?')[0] as RouteName
  if (!key) return 'home'
  return routes.has(key)?key:'not-found'
}
const AUTH_KEY='threadpeak-authenticated'
const THEME_KEY='threadpeak-theme'
export function App(){
  const[notice,setNotice]=useState('')
  const[sessionReady,setSessionReady]=useState(false)
  const[route,setRoute]=useState<RouteName>(readRoute)
  const[authenticated,setAuthenticated]=useState(()=>localStorage.getItem(AUTH_KEY)!=='false')
  const[theme,setTheme]=useState<'light'|'dark'>(()=>localStorage.getItem(THEME_KEY)==='dark'?'dark':'light')
  useEffect(()=>{const onHash=()=>setRoute(readRoute());addEventListener('hashchange',onHash);return()=>removeEventListener('hashchange',onHash)},[])
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme)},[theme])
  useEffect(()=>{
    void ensureSession().then(async()=>{const session=await requestAuthSession();if(session.kind==='authenticated'){localStorage.setItem(AUTH_KEY,'true');setAuthenticated(true)}setSessionReady(true)}).catch(()=>{setAuthenticated(false);setSessionReady(true)})
  },[])
  const toggleTheme=()=>setTheme((value)=>value==='dark'?'light':'dark')
  const logout=()=>{
    void requestAuthLogout().then(()=>{clearProductLibrary();localStorage.setItem(AUTH_KEY,'false');setAuthenticated(false)}).catch(e=>setNotice(e instanceof Error?e.message:'退出登录暂未完成。'))
  }
  const authorize=()=>{void ensureSession().then(()=>{localStorage.setItem(AUTH_KEY,'true');setAuthenticated(true);location.hash='home'}).catch(()=>{})}
  const pages={home:<HomePage/>,chat:<ChatPage/>,knowledge:<KnowledgePage/>,'knowledge-detail':<KnowledgeDetailPage/>,paths:<PathsPage/>,'path-3d':<Path3DPage/>,'session-learning':<SessionPage/>,authors:<AuthorsPage/>,'not-found':<NotFoundPage/>,settings:<SettingsPage theme={theme} onThemeChange={toggleTheme} onLogout={logout}/>}
  const page=pages[route]
  return <><IconSprite/>{notice&&<div role="alert">{notice}<button onClick={()=>setNotice('')}>关闭</button></div>}<Suspense fallback={<p role="status">正在打开页面…</p>}>{!sessionReady?<main className="auth-landing"><p role="status">正在连接你的工作区…</p></main>:authenticated?<WideShell route={route} theme={theme} onThemeChange={toggleTheme} onLogout={logout}>{page}</WideShell>:<AuthLanding theme={theme} onThemeChange={toggleTheme} onAuthorize={authorize}/>}</Suspense></>
}
