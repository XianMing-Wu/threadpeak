import { useEffect,useState } from 'react'
import { ProductWorkspace } from '../components/Shell'
import { HISTORY_OPEN_EVENT } from '../history'
import { ExampleWorkspace } from '../learning-v2/ExampleWorkspace'
import { LearningWorkspace } from '../learning-v2/Workspace'
import { readActiveConceptId,readActiveRouteId } from '../workspace/nav'
import { getRoute,useWorkspaceTick } from '../workspace/store'
import { NotFoundPage } from './NotFound'

const readNav = () => ({routeId:readActiveRouteId(),conceptId:readActiveConceptId()})
export function SessionPage() {
  useWorkspaceTick()
  const [nav,setNav] = useState(readNav)
  useEffect(() => {const restore=()=>setNav(readNav());addEventListener(HISTORY_OPEN_EVENT,restore);return()=>removeEventListener(HISTORY_OPEN_EVENT,restore)},[])
  const route=getRoute(nav.routeId)
  if(!route || !route.document.structure.concepts.some(c=>c.id===nav.conceptId))return <NotFoundPage/>
  if(route.owner==='example')return route.knowledgeId?<ProductWorkspace active="knowledge" page="session-learning"><ExampleWorkspace knowledgeId={route.knowledgeId} conceptId={nav.conceptId} initialView="research" onBack={()=>{location.hash='path-3d'}}/></ProductWorkspace>:<NotFoundPage/>
  return <LearningWorkspace key={`${route.id}:${nav.conceptId}`} routeId={route.id} conceptId={nav.conceptId}/>
}
