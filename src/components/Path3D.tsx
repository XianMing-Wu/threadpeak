import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { createRuntimeLease } from '../path-3d/runtime-lease'
import { serverProgressStorage } from '../path-3d/server-progress-storage'

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
  progressScopeId?: string
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
  progressScopeId = document.id,
  ariaLabel = '3D 知识脉络',
  className = '',
  instanceIdPrefix = 'threadpeak-path',
  nodeBadgeIconById,
  onContextualCardAction,
  onResourceNavigate = defaultResourceNavigation,
}: LearningPath3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onContextualCardActionRef = useRef(onContextualCardAction)
  const onResourceNavigateRef = useRef(onResourceNavigate)
  onContextualCardActionRef.current = onContextualCardAction
  onResourceNavigateRef.current = onResourceNavigate
  const [error, setError] = useState('')
  const [orbHost, setOrbHost] = useState<HTMLSpanElement | null>(null)
  const [readingProgress, setReadingProgress] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const recoveryCount = useRef(0)
  const documentId = document.id
  const hostGraphKey = [
    document.structure.entrySubjectId,
    document.structure.goalSubjectIds.join(','),
    document.structure.flow.map((edge) => `${edge.fromSubjectId}>${edge.toSubjectId}`).join(','),
  ].join('|')

  useEffect(() => {
    recoveryCount.current = 0
  }, [documentId, progressScopeId])

  useEffect(() => {
    const host = mountRef.current
    if (!host) return
    // StrictMode, navigation and delayed storage each get an owned subtree.
    const mount = globalThis.document.createElement('div')
    mount.className = 'path3d-runtime'
    host.append(mount)
    const lease = createRuntimeLease<LearningPathModule>()
    const contextLost = (event: Event) => {
      event.preventDefault()
      if (lease.signal.aborted) return
      setRecovering(true)
      // Rebuild the whole scene: restored GL contexts invalidate cached GPU objects.
      if (recoveryCount.current++ < 1) setAttempt(value => value + 1)
      else { setRecovering(false); setError('画面恢复暂未完成，请重新打开这条路线。') }
    }
    mount.addEventListener('webglcontextlost', contextLost, true)
    serial += 1
    const instanceSerial = serial
    const navigator: LearningResourceNavigatorPort = {
      navigate(request, { signal }) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        return onResourceNavigateRef.current(request.binding.href, request.binding.target)
      },
    }
    const handleContextualAction = (event: Event) => {
      const detail = (event as CustomEvent<ContextualCardAction>).detail ?? {}
      const callback = onContextualCardActionRef.current
      if (callback && detail.nodeId && (detail.actionId?.startsWith('learn:') || detail.actionId?.startsWith('action-'))) {
        // Intercept synchronously; the renderer owns validation and persistence.
        event.preventDefault()
        void lease.current?.rememberLearningNode(detail.nodeId).then(saved => {
          if (saved && !lease.signal.aborted) callback(detail, event)
        }).catch(() => {
          if (!lease.signal.aborted) setError('学习位置暂未保存，请重新打开这条路线。')
        })
        return
      }
      callback?.(detail, event)
    }

    setError('')
    setOrbHost(null)
    setReadingProgress(true)
    setRecovering(false)
    delete host.dataset.snapshot
    mount.addEventListener('learning-path:contextual-card-action', handleContextualAction, true)

    void (async () => {
      const storage=instanceIdPrefix==='threadpeak-mine'?serverProgressStorage(progressScopeId):pathProgressStorage
      const progressKey = pathProgressKey(progressScopeId)
      const existing = await Promise.resolve(storage.read({
        key: progressKey,
      }, { signal: lease.signal }))
      lease.signal.throwIfAborted()
      const instance = await mountLearningPath({
        mount,
        instanceId: `${instanceIdPrefix}-${instanceSerial}`,
        navigator,
        storage,
        progressKey,
        document,
        characterAssets,
        launchMode: existing ? 'continue' : 'reset',
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        subjectCardTrigger:'activate',
        progressionMode:'open',
        nodeBadgeIconById,
        onReady: (snapshot) => {
          if (!lease.signal.aborted) {
            if(import.meta.env.DEV)host.dataset.snapshot = JSON.stringify(snapshot)
            setReadingProgress(false)
          }
        },
        onProgressChange: () => {
          if (!lease.signal.aborted && lease.current) if(import.meta.env.DEV)host.dataset.snapshot = JSON.stringify(lease.current.getSnapshot())
        },
        onError: ({ phase, message, error: cause }) => {
          if (lease.signal.aborted) return
          if (import.meta.env.DEV) console.warn('[path-3d]', phase, message, cause)
          setError(safeRuntimeMessage(message, '3D 路线运行失败'))
        },
      })

      if (!lease.attach(instance)) return
      if(import.meta.env.DEV)host.dataset.snapshot = JSON.stringify(instance.getSnapshot())
      const instructions = mount.querySelector('.pointer-copy')
      if (instructions) instructions.textContent = '点击圆台查看 · 选择“走到这”移动 · 拖动或滚轮浏览'
      const mark = mount.querySelector('.loading-mark')
      if (mark instanceof HTMLElement) {
        const host = globalThis.document.createElement('span')
        host.className = 'tp-status-orb-slot'
        mark.replaceWith(host)
        setOrbHost(host)
      }
    })().catch((cause: unknown) => {
      if (!lease.signal.aborted) setError(safeRuntimeMessage(cause, '3D 路线初始化失败'))
    })

    return () => {
      mount.removeEventListener('webglcontextlost', contextLost, true)
      mount.removeEventListener('learning-path:contextual-card-action', handleContextualAction, true)
      lease.dispose()
      mount.remove()
      delete host.dataset.snapshot
    }
  }, [documentId, hostGraphKey, instanceIdPrefix, nodeBadgeIconById, progressScopeId, attempt])

  return <div className={`learning-path-3d-view ${className}`.trim()} aria-label={ariaLabel}>
    {orbHost && createPortal(<StatusOrbChip label="正在召唤刘看山…" flow="path3d" />, orbHost)}
    <div ref={mountRef} className="path3d-mount learning-path-3d-mount" />
    {(recovering || readingProgress) && !error && <div className="path3d-recovering" role="status"><StatusOrbChip label={recovering ? "正在恢复 3D 画面…" : "正在打开这条路线…"} /></div>}
    {error && <div className="path3d-error learning-path-3d-error ux-status-region" role="alert">
      <EmptyStatus kind="error" title="3D 路线暂时无法打开" body={error} action="重新打开路线" onAction={() => { recoveryCount.current = 0; setAttempt(value => value + 1) }} />
    </div>}
  </div>
}
