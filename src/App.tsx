import { useEffect, useState } from 'react'
import { WideShell, type RouteName } from './components/Shell'
import { HomePage } from './pages/Home'
import { KnowledgeDetailPage, KnowledgePage, Path3DPage, PathsPage } from './pages/Collections'
import { SessionPage } from './pages/Session'
import { AuthorsPage } from './pages/Authors'
import { SettingsPage } from './pages/Settings'
import { ChatPage } from './pages/Chat'
import { AuthLanding } from './pages/AuthLanding'
import { NotFoundPage } from './pages/NotFound'
import { IconSprite } from './icons'
import { ensurePrototypeRuntimeListeners } from './runtime/prototype-runtime'
import { requestAuthLogout, requestAuthSession } from './runtime/request-auth-session'

const routes = new Set<RouteName>(['home','chat','paths','path-3d','knowledge','knowledge-detail','session-learning','authors','settings'])
function readRoute():RouteName {
  const key=location.hash.slice(1).split('?')[0] as RouteName
  if (!key) return 'home'
  return routes.has(key)?key:'not-found'
}
const AUTH_KEY='threadpeak-authenticated'
const THEME_KEY='threadpeak-theme'
export function App(){
  const[route,setRoute]=useState<RouteName>(readRoute)
  const[authenticated,setAuthenticated]=useState(()=>localStorage.getItem(AUTH_KEY)!=='false')
  const[theme,setTheme]=useState<'light'|'dark'>(()=>localStorage.getItem(THEME_KEY)==='dark'?'dark':'light')
  useEffect(()=>{const onHash=()=>setRoute(readRoute());addEventListener('hashchange',onHash);ensurePrototypeRuntimeListeners();return()=>removeEventListener('hashchange',onHash)},[])
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme)},[theme])
  useEffect(()=>{
    void requestAuthSession().then((session) => {
      if (session.kind === 'authenticated') setAuthenticated(true)
    })
  },[])
  const toggleTheme=()=>setTheme((value)=>value==='dark'?'light':'dark')
  const logout=()=>{
    void requestAuthLogout()
    localStorage.setItem(AUTH_KEY,'false')
    setAuthenticated(false)
  }
  const authorize=()=>{localStorage.setItem(AUTH_KEY,'true');setAuthenticated(true);location.hash='home'}
  const page=route==='home'?<HomePage/>:route==='chat'?<ChatPage/>:route==='knowledge'?<KnowledgePage/>:route==='knowledge-detail'?<KnowledgeDetailPage/>:route==='paths'?<PathsPage/>:route==='path-3d'?<Path3DPage/>:route==='session-learning'?<SessionPage/>:route==='authors'?<AuthorsPage/>:route==='not-found'?<NotFoundPage/>:<SettingsPage/>
  return <><IconSprite/>{authenticated?<WideShell route={route} theme={theme} onThemeChange={toggleTheme} onLogout={logout}>{page}</WideShell>:<AuthLanding theme={theme} onThemeChange={toggleTheme} onAuthorize={authorize}/>}</>
}
