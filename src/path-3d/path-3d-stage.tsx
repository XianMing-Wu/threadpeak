import { useEffect, useMemo, useState } from 'react'
import { getRoute, persistRepairedMineDocument, useWorkspaceTick } from '../workspace/store'
import type { NodeSemanticBadgeIcon } from 'liu-kanshan-learning-path-3d'
import { defaultResourceNavigation, LearningPath3DView } from '../components/Path3D'
import { EmptyStatus } from '../components/EmptyStatus'
import { Icon } from '../icons'
import { NAV_EVENT, openLearning, readActiveRouteId } from '../workspace/nav'

import { resolvePath3DView } from './resolved-path-document.ts'

import { routeBadgeEntries } from './route-badges'

type ContextualCardAction = Readonly<{
  actionId?: string
  nodeId?: string
}>

function conceptIdFromAction(detail: ContextualCardAction, document?: { structure: { entrySubjectId: string; goalSubjectIds: readonly string[] } }) {
  const blocked = new Set([
    'route-start',
    'goal-understanding',
    ...(document ? [document.structure.entrySubjectId, ...document.structure.goalSubjectIds] : []),
  ])
  if (detail.nodeId && !detail.nodeId.startsWith('carrier-') && !blocked.has(detail.nodeId)) return detail.nodeId
  const action = detail.actionId ?? ''
  if (action.startsWith('action-')) return action.slice('action-'.length)
  if (action.startsWith('learn:')) return action.slice('learn:'.length)
  return ''
}

export function Path3DStage() {
  const tick = useWorkspaceTick()
  const [routeId, setRouteId] = useState(readActiveRouteId)
  useEffect(() => {
    const sync = () => setRouteId(readActiveRouteId())
    addEventListener(NAV_EVENT, sync)
    addEventListener('storage', sync)
    return () => {
      removeEventListener(NAV_EVENT, sync)
      removeEventListener('storage', sync)
    }
  }, [])
  const view = useMemo(() => {
    const route = routeId ? getRoute(routeId) : undefined
    return resolvePath3DView({ routeId, route })
  }, [routeId, tick])
  // Stable key prevents unrelated library updates from remounting the WebGL scene.
  const badgeKey = JSON.stringify(view.kind === 'ready' ? routeBadgeEntries(view.document.structure) : [])
  const nodeBadges = useMemo(() => Object.fromEntries(JSON.parse(badgeKey)) as Record<string, NodeSemanticBadgeIcon>, [badgeKey])
  const goBack = () => { location.hash = view.kind==='ready'&&view.source==='example'?'paths?tab=example':'paths' }

  useEffect(() => {
    if (view.kind !== 'ready' || view.source !== 'mine') return
    const current = getRoute(view.routeId)
    if (current && current.document !== view.document) persistRepairedMineDocument(view.routeId, view.document)
  }, [view])

  if (view.kind === 'unavailable') {
    return <section className="path3d-stage" aria-label="3D 学习路线">
      <header>
        <div className="path3d-heading">
          <button type="button" className="path3d-back" aria-label="返回路线列表" onClick={goBack}><Icon name="back" size={18}/></button>
          <div><small>路线规划</small><h1 className="path3d-title">{view.title}</h1></div>
        </div>
      </header>
      <div className="path3d-error learning-path-3d-error ux-status-region" role="alert">
        <EmptyStatus
          kind="error"
          title="无法打开这条路线"
          body={view.message}
          action="返回路线列表"
          onAction={() => { location.hash = 'paths' }}
        />
      </div>
    </section>
  }

  const enterLearning = (detail: ContextualCardAction, event: Event) => {
    const conceptId = conceptIdFromAction(detail, view.document)
    if (conceptId) sessionStorage.setItem('threadpeak-active-concept', conceptId)
    const shouldLearn = detail.actionId?.startsWith('learn:') || detail.actionId?.startsWith('action-')
    if (!shouldLearn || !conceptId) return
    event.preventDefault()
    openLearning(view.routeId, conceptId, 'path-3d')
  }
  const onResourceNavigate = (href: string, target: 'self' | 'blank') => {
    if (href === '#session-learning' || href.startsWith('#session-learning')) {
      openLearning(view.routeId, sessionStorage.getItem('threadpeak-active-concept') || undefined, 'path-3d')
      return { status: 'accepted' as const, resolvedHref: href }
    }
    return defaultResourceNavigation(href, target)
  }

  return <section className="path3d-stage" aria-label="双层圆台 3D 学习路线">
    <header>
      <div className="path3d-heading">
        <button type="button" className="path3d-back" aria-label="返回路线列表" onClick={goBack}><Icon name="back" size={18}/></button>
        <div><small>路线规划</small><h1 className="path3d-title">{view.title}</h1></div>
      </div>
      <span>点击圆台查看 · 黄色光圈是当前位置 · 紫色圆台是上次学习</span>
    </header>
    <LearningPath3DView
      document={view.document}
      progressScopeId={view.routeId}
      ariaLabel={`${view.title}的 3D 路线`}
      instanceIdPrefix={view.source === 'example' ? 'threadpeak-example' : 'threadpeak-mine'}
      nodeBadgeIconById={nodeBadges}
      onContextualCardAction={enterLearning}
      onResourceNavigate={onResourceNavigate}
    />
  </section>
}
