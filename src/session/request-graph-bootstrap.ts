import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_GRAPH_URL } from '../runtime/live-client.ts'

export type GraphRootView = {
  nodeId: string
  title: string
  role: 'root'
  canonicalContentHash: string
}

export type GraphSnapshot = {
  graphId: string
  routeId: string
  conceptId: string
  canonicalContentHash: string
  revision: number
  root: GraphRootView
  draftCount: 0
  reused: boolean
}

export type GraphBootstrapResult =
  | { kind: 'completed'; graph: GraphSnapshot }
  | { kind: 'missing' }
  | { kind: 'unavailable'; title: string; message: string }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function asRoot(value: unknown): GraphRootView | undefined {
  const root = asRecord(value)
  if (
    !root
    || typeof root.nodeId !== 'string'
    || !root.nodeId.trim()
    || typeof root.title !== 'string'
    || !root.title.trim()
    || root.role !== 'root'
    || typeof root.canonicalContentHash !== 'string'
    || !root.canonicalContentHash.trim()
  ) return undefined
  return {
    nodeId: root.nodeId,
    title: root.title,
    role: 'root',
    canonicalContentHash: root.canonicalContentHash,
  }
}

function snapshotFrom(body: Record<string, unknown>, reused: boolean): GraphSnapshot | undefined {
  const root = asRoot(body.root)
  if (
    !root
    || typeof body.graphId !== 'string'
    || !body.graphId.trim()
    || typeof body.routeId !== 'string'
    || typeof body.conceptId !== 'string'
    || typeof body.canonicalContentHash !== 'string'
    || typeof body.revision !== 'number'
    || body.canonicalContentHash !== root.canonicalContentHash
  ) return undefined
  return {
    graphId: body.graphId,
    routeId: body.routeId,
    conceptId: body.conceptId,
    canonicalContentHash: body.canonicalContentHash,
    revision: body.revision,
    root,
    draftCount: 0,
    reused,
  }
}

export async function requestGraphSnapshot(input: {
  routeId: string
  conceptId: string
  fetch?: FetchPort
}): Promise<GraphBootstrapResult> {
  const client = createLiveApiClient(input.fetch)
  const query = new URLSearchParams({
    routeId: input.routeId,
    conceptId: input.conceptId,
  })
  const got = await client.requestJson({
    url: `${LIVE_GRAPH_URL}?${query.toString()}`,
    method: 'GET',
    traceId: 'graph-snapshot',
  })
  const body = asRecord(got.value)
  if (got.ok && body?.kind === 'completed') {
    const graph = snapshotFrom(body, true)
    if (graph) return { kind: 'completed', graph }
  }
  if (!got.ok && (got.status === 404 || body?.kind === 'missing')) {
    return { kind: 'missing' }
  }
  return {
    kind: 'unavailable',
    title: '无法读取这次知识脉络',
    message: liveMessageOf(got.value, '知识脉络暂时读不到。请稍后再试。'),
  }
}
