import { useEffect, useRef, useState } from 'react'
import {
  mountLearningPath,
  type LearningPathDocument,
  type LearningPathModule,
  type LearningProgressStoragePort,
  type LearningResourceNavigationResult,
  type LearningResourceNavigatorPort,
  type NodeSemanticBadgeIcon,
} from 'liu-kanshan-learning-path-3d'

let serial = 0

const characterAssets = {
  idle: new URL('../vendor/learning-path-3d/assets/liu-kanshan-idle.glb', import.meta.url).href,
  run: new URL('../vendor/learning-path-3d/assets/liu-kanshan-run.glb', import.meta.url).href,
  runStop: new URL('../vendor/learning-path-3d/assets/liu-kanshan-run-stop.glb', import.meta.url).href,
  turn: new URL('../vendor/learning-path-3d/assets/liu-kanshan-turn.glb', import.meta.url).href,
} as const

const memoryStorage = (): LearningProgressStoragePort & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    read({ key }, { signal }) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return values.get(key) ?? null
    },
    write({ key, value }, { signal }) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      values.set(key, value)
    },
  }
}

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
 * A document change intentionally disposes and remounts the imperative runtime.
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
  const [error, setError] = useState('')

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    serial += 1
    const instanceSerial = serial
    const storage = memoryStorage()
    const navigator: LearningResourceNavigatorPort = {
      navigate(request, { signal }) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        return onResourceNavigate(request.binding.href, request.binding.target)
      },
    }
    const handleContextualAction = (event: Event) => {
      onContextualCardAction?.((event as CustomEvent<ContextualCardAction>).detail ?? {}, event)
    }

    setError('')
    delete mount.dataset.snapshot
    mount.addEventListener('learning-path:contextual-card-action', handleContextualAction, true)

    void (async () => {
      const instance = await mountLearningPath({
        mount,
        instanceId: `${instanceIdPrefix}-${instanceSerial}`,
        navigator,
        storage,
        progressKey: `threadpeak:path-progress:document:${document.id}:instance:${instanceSerial}`,
        document,
        characterAssets,
        launchMode: 'reset',
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        subjectCardTrigger:'activate',
        progressionMode:'open',
        nodeBadgeIconById,
        onError: ({ message }) => {
          if (!disposed) setError(safeRuntimeMessage(message, '3D 路线运行失败'))
        },
      })

      if (disposed) {
        instance.dispose()
        return
      }

      moduleRef.current = instance
      mount.dataset.snapshot = JSON.stringify(instance.getSnapshot())
    })().catch((cause: unknown) => {
      if (!disposed) setError(safeRuntimeMessage(cause, '3D 路线初始化失败'))
    })

    return () => {
      disposed = true
      mount.removeEventListener('learning-path:contextual-card-action', handleContextualAction, true)
      moduleRef.current?.dispose()
      moduleRef.current = null
      delete mount.dataset.snapshot
    }
  }, [document, instanceIdPrefix, nodeBadgeIconById, onContextualCardAction, onResourceNavigate])

  return <div className={`learning-path-3d-view ${className}`.trim()} aria-label={ariaLabel}>
    <div ref={mountRef} className="path3d-mount learning-path-3d-mount" />
    {error && <div className="path3d-error learning-path-3d-error" role="alert">
      <span className="learning-path-3d-error-mark" aria-hidden="true">×</span>
      <strong>3D 路线暂时无法打开</strong>
      <span>{error}</span>
    </div>}
  </div>
}
