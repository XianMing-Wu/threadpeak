import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EmptyStatus } from './EmptyStatus'
import { StatusOrbChip } from './StatusOrb'
import {
  mountLearningPath,
  type LearningPathDocument,
  type LearningPathModule,
  type LearningResourceNavigationResult,
  type LearningResourceNavigatorPort,
  type NodeSemanticBadgeIcon,
} from 'liu-kanshan-learning-path-3d'
import { createPathProgressStorage, pathProgressKey, sessionPathProgressCache } from '../path-3d/path-progress-storage'

let serial = 0

const characterAssets = {
  idle: new URL('../vendor/learning-path-3d/assets/liu-kanshan-idle.glb', import.meta.url).href,
  run: new URL('../vendor/learning-path-3d/assets/liu-kanshan-run.glb', import.meta.url).href,
  runStop: new URL('../vendor/learning-path-3d/assets/liu-kanshan-run-stop.glb', import.meta.url).href,
  turn: new URL('../vendor/learning-path-3d/assets/liu-kanshan-turn.glb', import.meta.url).href,
} as const

const pathProgressStorage = createPathProgressStorage(sessionPathProgressCache())

type ContextualCardAction = Readonly<{
  actionId?: string
  nodeId?: string
}>

export type LearningPath3DViewProps = Readonly<{
  document: LearningPathDocument
  ariaLabel?: string
  className?: string
  instanceIdPrefix?: string
  nodeBadgeIconById?: Readonly<Record<string, NodeSemanticBadgeIcon>>
  onContextualCardAction?: (detail: ContextualCardAction, event: Event) => void
  onResourceNavigate?: (href: string, target: 'self' | 'blank') => LearningResourceNavigationResult
}>

export function defaultResourceNavigation(href: string, target: 'self' | 'blank'): LearningResourceNavigationResult {
  if (href.startsWith('#')) {
    location.hash = href.slice(1)
    return { status: 'accepted', resolvedHref: href }
  }

  let resolved: URL
  try {
    resolved = new URL(href, location.href)
  } catch {
    return { status: 'invalid-url', message: '资源地址无效' }
  }

  if (!['http:', 'https:'].includes(resolved.protocol)) {
    return { status: 'invalid-url', message: '只允许打开 HTTP(S) 资源' }
  }

  if (target === 'blank') {
    const opened = window.open(resolved.href, '_blank', 'noopener,noreferrer')
    return opened
      ? { status: 'accepted', resolvedHref: resolved.href }
      : { status: 'popup-blocked', resolvedHref: resolved.href, message: '浏览器阻止了新窗口' }
  }

  location.assign(resolved.href)
  return { status: 'accepted', resolvedHref: resolved.href }
}

function safeRuntimeMessage(_value: unknown, fallback: string): string {
  // Runtime errors can contain source URLs, paths, or upstream values. The host
  // exposes only fixed local copy and keeps the raw cause inside the runtime.
  return fallback
}

/**
 * Generic adapter for renderer-v1 learning-path documents.
 * Remount when the document id, host graph, instance prefix, or badge map changes.
 * Parent re-renders (sidebar collapse, new callback identities, rebuilt catalog
 * objects with the same id and flow) must not dispose an in-flight WebGL runtime.
 */
export function LearningPath3DView({
  document,
  ariaLabel = '3D 知识脉络',
  className = '',
  instanceIdPrefix = 'threadpeak-path',
  nodeBadgeIconById,
  onContextualCardAction,
  onResourceNavigate = defaultResourceNavigation,
}: LearningPath3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const moduleRef = useRef<LearningPathModule | null>(null)
  const onContextualCardActionRef = useRef(onContextualCardAction)
  const onResourceNavigateRef = useRef(onResourceNavigate)
  onContextualCardActionRef.current = onContextualCardAction
  onResourceNavigateRef.current = onResourceNavigate
  const [error, setError] = useState('')
  const documentId = document.id
  const hostGraphKey = [
    document.structure.entrySubjectId,
    document.structure.goalSubjectIds.join(','),
    document.structure.flow.map((edge) => `${edge.fromSubjectId}>${edge.toSubjectId}`).join(','),
  ].join('|')

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let loadingOrb: Root | undefined
    serial += 1
    const instanceSerial = serial
    const navigator: LearningResourceNavigatorPort = {
      navigate(request, { signal }) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        return onResourceNavigateRef.current(request.binding.href, request.binding.target)
      },
    }
    const handleContextualAction = (event: Event) => {
      onContextualCardActionRef.current?.((event as CustomEvent<ContextualCardAction>).detail ?? {}, event)
    }

    setError('')
    delete mount.dataset.snapshot
    mount.addEventListener('learning-path:contextual-card-action', handleContextualAction, true)

    void (async () => {
      const progressKey = pathProgressKey(documentId)
      const existing = await Promise.resolve(pathProgressStorage.read({
        key: progressKey,
      }, { signal: new AbortController().signal }))
      const instance = await mountLearningPath({
        mount,
        instanceId: `${instanceIdPrefix}-${instanceSerial}`,
        navigator,
        storage: pathProgressStorage,
        progressKey,
        document,
        characterAssets,
        launchMode: existing ? 'continue' : 'reset',
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        subjectCardTrigger:'activate',
        progressionMode:'open',
        nodeBadgeIconById,
        onReady: (snapshot) => {
          if (!disposed) mount.dataset.snapshot = JSON.stringify(snapshot)
        },
        onProgressChange: () => {
          if (!disposed && moduleRef.current) mount.dataset.snapshot = JSON.stringify(moduleRef.current.getSnapshot())
        },
        onError: ({ phase, message, error: cause }) => {
          if (disposed) return
          if (phase === 'runtime') return
          if (import.meta.env.DEV) console.warn('[path-3d]', phase, message, cause)
          setError(safeRuntimeMessage(message, '3D 路线运行失败'))
        },
      })

      if (disposed) {
        instance.dispose()
        return
      }

      moduleRef.current = instance
      mount.dataset.snapshot = JSON.stringify(instance.getSnapshot())
      const mark = mount.querySelector('.loading-mark')
      if (mark instanceof HTMLElement) {
        const host = globalThis.document.createElement('span')
        host.className = 'tp-status-orb-slot'
        mark.replaceWith(host)
        loadingOrb = createRoot(host)
        loadingOrb.render(<StatusOrbChip label="正在召唤刘看山…" />)
      }
    })().catch((cause: unknown) => {
      if (!disposed) setError(safeRuntimeMessage(cause, '3D 路线初始化失败'))
    })

    return () => {
      disposed = true
      loadingOrb?.unmount()
      mount.removeEventListener('learning-path:contextual-card-action', handleContextualAction, true)
      moduleRef.current?.dispose()
      moduleRef.current = null
      delete mount.dataset.snapshot
    }
  }, [documentId, hostGraphKey, instanceIdPrefix, nodeBadgeIconById])

  return <div className={`learning-path-3d-view ${className}`.trim()} aria-label={ariaLabel}>
    <div ref={mountRef} className="path3d-mount learning-path-3d-mount" />
    {error && <div className="path3d-error learning-path-3d-error ux-status-region" role="alert">
      <EmptyStatus kind="error" title="3D 路线暂时无法打开" body={error} />
    </div>}
  </div>
}
