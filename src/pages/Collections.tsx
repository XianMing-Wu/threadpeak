import { lazy,Suspense,useEffect,useState } from 'react'
import { EmptyStatus } from '../components/EmptyStatus'
import { LocalRecoveryNotice } from '../components/LocalRecoveryNotice'
import { ProductWorkspace } from '../components/Shell'
import { Icon } from '../icons'
import { MineGraphCanvasPage } from '../knowledge-canvas/mine-graph-canvas'
import { ExampleWorkspace } from '../learning-v2/ExampleWorkspace'
import { useProductLibrary } from '../learning-v2/library'
import { LearningWorkspace } from '../learning-v2/Workspace'
const Path3DStage=lazy(()=>import('../path-3d/path-3d-stage').then(m=>({default:m.Path3DStage})))
import { selectExampleKnowledge,selectRouteCards } from '../runtime/library-read-model'
import { useLibrarySelector } from '../runtime/use-library-selector'
import { coverForId } from '../ui/covers'
import { FlowithMarket } from '../ui/FlowithMarket'
import { KnowledgeLibrary } from '../ui/KnowledgeLibrary'
import { buildKnowledgeShelves } from '../ui/knowledge-shelves'
import { closeConceptKnowledge,NAV_EVENT,openConceptKnowledge,openRoute,readActiveKnowledgeId,readActiveRouteId,readKnowledgeConceptId,readKnowledgeListReturn } from '../workspace/nav'
import { getReadOnlyConceptGraph,getReadOnlyKnowledge,getReadOnlyKnowledgeByRoute,getRoute,hasSettledMineConceptGraph,listReadOnlyConceptCards,readWorkspace,useWorkspaceTick } from '../workspace/store'

export function KnowledgePage() {
  const {data,error,reload}=useProductLibrary()
  const items = useLibrarySelector(selectExampleKnowledge)
  const shelves = buildKnowledgeShelves(data, items.map(knowledge => {
    const route = getRoute(knowledge.routeId)
    return { id: knowledge.id, routeId: knowledge.routeId, title: route?.title ?? knowledge.title,
      document: route?.document, concepts: listReadOnlyConceptCards(knowledge.id) }
  }))
  return <ProductWorkspace active="knowledge" page="knowledge">
    <KnowledgeLibrary
      shelves={shelves}
      onOpen={book => {
        if (book.target.kind === 'resource') location.hash = `knowledge-detail?resource=${encodeURIComponent(book.target.resourceId)}`
        else openConceptKnowledge(book.target.knowledgeId, book.target.conceptId)
      }}
      loading={!data && !error}
      error={error ? <EmptyStatus headingLevel={2} kind="error" density="inline" title={data?'暂时无法更新你的知识脉络':'暂时无法读取你的知识脉络'} body={data?'已读取的内容仍然保留，可继续浏览。':'下方示例仍可浏览，你的内容读取失败，请重新连接。'} action="重新连接" onAction={()=>void reload()}/> : undefined}
      footer={<LocalRecoveryNotice/>}
    />
  </ProductWorkspace>
}

export function PathsPage() {
  const {data,error,reload}=useProductLibrary()
  const [tab, setTab] = useState<'mine' | 'example'>(()=>new URLSearchParams(location.hash.split('?')[1]??'').get('tab')==='example'?'example':'mine')
  const shown = useLibrarySelector(selectRouteCards(tab))
  return <ProductWorkspace active="paths" page="paths">
    <FlowithMarket
      kind="routes"
      title="路线规划"
      loading={tab==='mine'&&!data&&!error}
      tab={tab}
      onTab={setTab}
      items={shown.map((route) => ({
        id: route.id,
        cover: coverForId(route.id),
        title: route.title,
        author: route.owner === 'mine' ? '我' : '问山',
        desc: `${route.summary} · ${route.concepts} 个必要概念`,
        badge: route.owner === 'mine' ? '我的' : '示例',
        onOpen: () => { openRoute(route.id, 'paths'); location.hash='path-3d' },
      }))}
      total={shown.length}
      error={tab==='mine'&&error ? <EmptyStatus headingLevel={3} kind="error" density={data?'inline':'panel'} title={data?'暂时无法更新路线':'暂时无法读取路线'} body={data?'正在显示已读取的路线。':'已有路线仍然保留，请重新连接后再试。'} action="重新连接" onAction={()=>void reload()}/> : undefined}
      empty={<EmptyStatus headingLevel={3} title={tab==='mine'?'还没有自己的路线':'暂时没有示例路线'} body="在首页制定路线后，会出现在这里。" action="去问山制定路线" onAction={() => { sessionStorage.setItem('threadpeak-home-select-route', '1'); location.hash = 'home' }} />}
      footer={tab==='mine'?<LocalRecoveryNotice/>:undefined}
    />
  </ProductWorkspace>
}

export function Path3DPage() {
  return <ProductWorkspace active="paths" page="path-3d"><Suspense fallback={<p role="status">正在打开路线…</p>}><Path3DStage/></Suspense></ProductWorkspace>
}

export function KnowledgeConceptsPage() {
  useWorkspaceTick()
  const knowledgeId = readActiveKnowledgeId()
  const knowledge = knowledgeId ? getReadOnlyKnowledge(knowledgeId) : undefined
  const cards = knowledgeId ? listReadOnlyConceptCards(knowledgeId) : []
  return <ProductWorkspace active="knowledge" page="knowledge-detail">
    <FlowithMarket
      kind="concepts"
      tab={knowledge?.owner === 'example' ? 'example' : 'mine'}
      switchable={false}
      title={knowledge?.title ?? '知识脉络'}
      sub={knowledge?.owner==='example'?'从目标到来源，再到解释与追问。选择一个概念，查看完整的学习过程。':'每个概念都有自己的脉络，对话不会混在一起。'}
      heading={<><div className="concept-back square-heading"><button type="button" className="lesson-back" aria-label="返回上一级" onClick={() => { location.hash = knowledge?.owner==='example'?'knowledge?tab=example':readKnowledgeListReturn() }}><Icon name="back" size={18}/></button></div></>}
      items={cards.map((item) => ({
        id: item.id,
        cover: coverForId(item.id),
        title: item.title,
        desc: item.description,
        author: '问山',
        badge: knowledge?.owner==='example'?'学习示例 · 知乎来源':`最终概念 · ${item.type} · ${item.sources} 个来源`,
        onOpen: () => { openConceptKnowledge(knowledgeId, item.id) },
      }))}
      total={cards.length}
      empty={<EmptyStatus headingLevel={3} kind="empty" title="还没有概念脉络" body="进入学习后，相关概念会出现在这里。" action="去看我的路线" onAction={() => { location.hash = 'paths' }} />}
    />
  </ProductWorkspace>
}

export function KnowledgeDetailPage(){
  const resource=new URLSearchParams(location.hash.split('?')[1]??'').get('resource')
  if(resource)return <ProductWorkspace active="knowledge" page="knowledge-detail"><LearningWorkspace key={resource} resourceId={resource} routeId="" conceptId="" initialView="graph"/></ProductWorkspace>
  return <LegacyKnowledgeDetailPage/>
}
function LegacyKnowledgeDetailPage() {
  const [conceptId, setConceptId] = useState(readKnowledgeConceptId)
  useEffect(() => {
    const sync = () => setConceptId(readKnowledgeConceptId())
    addEventListener(NAV_EVENT, sync)
    addEventListener('storage', sync)
    return () => {
      removeEventListener(NAV_EVENT, sync)
      removeEventListener('storage', sync)
    }
  }, [])
  useEffect(() => {
    if (!conceptId) return
    const knowledgeId = readActiveKnowledgeId()
    const knowledge = knowledgeId ? getReadOnlyKnowledge(knowledgeId) : undefined
    const route = getRoute(readActiveRouteId())
    const owner = route?.owner || knowledge?.owner
    if (owner === 'example') return
    if (owner === 'mine' && knowledgeId) return
    closeConceptKnowledge()
    const remaining = knowledge ?? getReadOnlyKnowledgeByRoute(readActiveRouteId())
    if (owner !== 'mine' || !remaining || listReadOnlyConceptCards(remaining.id).length === 0) location.hash = 'knowledge'
  }, [conceptId])
  if (!conceptId) return <KnowledgeConceptsPage/>
  const routeId = readActiveRouteId()
  const knowledge = getReadOnlyKnowledge(readActiveKnowledgeId())
  const route = getRoute(routeId)
  const owner = route?.owner || knowledge?.owner
  if (owner === 'mine') {
    const knowledgeId = readActiveKnowledgeId()
    if (!knowledgeId) {
      return <KnowledgeConceptsPage/>
    }
    return <MineGraphCanvasPage key={`${routeId}:${conceptId}`} routeId={routeId} conceptId={conceptId}/>
  }
  if (owner === 'example') {
    return <ProductWorkspace active="knowledge" page="knowledge-detail"><ExampleWorkspace knowledgeId={readActiveKnowledgeId()} conceptId={conceptId} onBack={()=>{closeConceptKnowledge();location.hash='knowledge?tab=example'}}/></ProductWorkspace>
  }
  return <KnowledgeConceptsPage/>
}
