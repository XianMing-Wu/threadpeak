import {
  type PublicError,
  type StreamCursor,
} from '@threadpeak/contracts'

export const INFLIGHT_STATUSES = [
  'idle',
  'loading',
  'streaming',
  'ready',
  'empty',
  'recoverable-error',
  'terminal-error',
  'cancelled',
  'reconnecting',
] as const

export type InflightStatus = (typeof INFLIGHT_STATUSES)[number]

export type ApplyDecision = 'apply' | 'duplicate' | 'late' | 'gap'

export type StreamEventInput = {
  eventId: string
  resourceId: string
  sequence: number
  traceId: string
}

export type RuntimeSnapshot<TView> = {
  view: TView
  inflight: Readonly<Record<string, InflightStatus>>
  cursors: Readonly<Record<string, StreamCursor>>
  streamHealth: 'live' | 'gap' | 'incompatible'
  lastError: PublicError | null
}

export type RuntimeStore<TView> = {
  getSnapshot: () => RuntimeSnapshot<TView>
  subscribe: (listener: () => void) => () => void
  hydrateFromGet: (view: TView) => void
  applyCommittedEvent: <TEvent extends StreamEventInput>(
    event: TEvent,
    project: (view: TView, event: TEvent) => TView,
  ) => ApplyDecision
  setInflight: (resourceId: string, status: InflightStatus) => void
  teardown: () => void
}

export function decideCommittedApply(
  current: StreamCursor | undefined,
  next: StreamEventInput,
): ApplyDecision {
  if (current && current.lastEventId === next.eventId) return 'duplicate'
  if (!current) return next.sequence === 0 ? 'apply' : 'gap'
  if (next.sequence <= current.sequence) return 'late'
  if (next.sequence === current.sequence + 1) return 'apply'
  return 'gap'
}

function freezeInflight(value: Record<string, InflightStatus>) {
  return Object.freeze({ ...value })
}

function freezeCursors(value: Record<string, StreamCursor>) {
  return Object.freeze({ ...value })
}

export function createRuntimeStore<TView>(initialView: TView): RuntimeStore<TView> {
  let tornDown = false
  let snapshot: RuntimeSnapshot<TView> = {
    view: initialView,
    inflight: freezeInflight({}),
    cursors: freezeCursors({}),
    streamHealth: 'live',
    lastError: null,
  }
  const listeners = new Set<() => void>()

  function emit(next: RuntimeSnapshot<TView>) {
    if (tornDown) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot() {
      return snapshot
    },

    subscribe(listener) {
      if (tornDown) return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    hydrateFromGet(view) {
      if (tornDown) return
      emit({
        ...snapshot,
        view,
        streamHealth: 'live',
        lastError: null,
      })
    },

    applyCommittedEvent(event, project) {
      if (tornDown) return 'late'
      const current = snapshot.cursors[event.resourceId]
      const decision = decideCommittedApply(current, event)
      if (decision === 'duplicate' || decision === 'late') return decision
      if (decision === 'gap') {
        emit({
          ...snapshot,
          streamHealth: 'gap',
          lastError: {
            code: 'STREAM_GAP',
            message: 'Stream sequence gap; replay the resource before applying later events.',
            traceId: event.traceId,
          },
        })
        return 'gap'
      }
      emit({
        view: project(snapshot.view, event),
        inflight: snapshot.inflight,
        cursors: freezeCursors({
          ...snapshot.cursors,
          [event.resourceId]: {
            resourceId: event.resourceId,
            lastEventId: event.eventId,
            sequence: event.sequence,
          },
        }),
        streamHealth: 'live',
        lastError: null,
      })
      return 'apply'
    },

    setInflight(resourceId, status) {
      if (tornDown) return
      emit({
        ...snapshot,
        inflight: freezeInflight({
          ...snapshot.inflight,
          [resourceId]: status,
        }),
      })
    },

    teardown() {
      tornDown = true
      listeners.clear()
    },
  }
}
