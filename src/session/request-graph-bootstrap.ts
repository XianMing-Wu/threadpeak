import type { FetchPort } from '@threadpeak/api-client'
import { createLiveApiClient, liveMessageOf, LIVE_GRAPH_URL, LIVE_READY_URL } from '../runtime/live-client.ts'

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

function missingGraph(): Extract<GraphBootstrapResult, { kind: 'unavailable' }> {
  return {
    kind: 'unavailable',
    title: '还没有这次概念的知识脉络',
    message: '这条用户路线还没有 GraphSurgeon 提交的 graph/root。不能用页面 growGraph 发明节点，也不能在首次回复之前创建知识脉络。',
  }
}

export async function requestGraphBootstrap(input: {
  routeId: string
  conceptId: string
  title: string
  fetch?: FetchPort
}): Promise<GraphBootstrapResult> {
  const missing = missingGraph()
  const client = createLiveApiClient(input.fetch)
  const ready = await client.requestJson({
    url: LIVE_READY_URL,
    method: 'GET',
    traceId: 'graph-ready',
  })
  const readyBody = asRecord(ready.value)
  if (!ready.ok || readyBody?.ready !== true) return missing
  const posted = await client.requestJson({
    url: LIVE_GRAPH_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      routeId: input.routeId,
      conceptId: input.conceptId,
      title: input.title,
    }),
    traceId: 'graph-bootstrap',
  })
  const body = asRecord(posted.value)
  if (posted.ok && body?.kind === 'completed') {
    const graph = snapshotFrom(body, body.reused === true)
    if (graph) return { kind: 'completed', graph }
  }
  return {
    ...missing,
    message: liveMessageOf(posted.value, missing.message),
  }
}

export async function requestGraphSnapshot(input: {
  routeId: string
  conceptId: string
  fetch?: FetchPort
}): Promise<GraphBootstrapResult> {
  const missing = missingGraph()
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
  return {
    ...missing,
    message: liveMessageOf(got.value, missing.message),
  }
}
