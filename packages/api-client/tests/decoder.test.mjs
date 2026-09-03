import assert from 'node:assert/strict'
import test from 'node:test'

const client = await import('../src/index.ts')

const envelope = {
  eventId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2030-01-02T03:04:05.000Z',
  traceId: 'fixture-trace',
  schemaVersion: 1,
}

const streamEvent = {
  ...envelope,
  resourceId: 'path-session-fixture',
  sequence: 1,
  type: 'path.delta',
}

test('stream decoder accepts path seq and requestId when sessionId is still null', () => {
  const decoded = client.decodeNdjsonLine(JSON.stringify({
    ...envelope,
    requestId: '33333333-3333-4333-8333-333333333333',
    sessionId: null,
    seq: 1,
    type: 'stage.started',
    stage: 'validate',
  }))
  assert.equal(decoded.ok, true)
  if (!decoded.ok || !('value' in decoded)) throw new Error('expected event')
  assert.equal(decoded.value.resourceId, '33333333-3333-4333-8333-333333333333')
  assert.equal(decoded.value.sequence, 1)
})

test('stream decoder accepts aggregateId and rejects sequence 0', () => {
  const decoded = client.decodeNdjsonLine(JSON.stringify({
    ...envelope,
    aggregateId: 'knowledge-aggregate',
    sequence: 1,
    type: 'answer.completed',
  }))
  assert.equal(decoded.ok, true)
  if (!decoded.ok || !('value' in decoded)) throw new Error('expected event')
  assert.equal(decoded.value.resourceId, 'knowledge-aggregate')
  const zero = client.decodeNdjsonLine(JSON.stringify({
    ...envelope,
    resourceId: 'path-session-fixture',
    sequence: 0,
  }))
  assert.equal(zero.ok, false)
})

test('NDJSON decoder accepts envelope plus cursor and keeps extra domain fields raw', () => {
  const decoded = client.decodeNdjsonLine(JSON.stringify(streamEvent))
  assert.equal(decoded.ok, true)
  if (!decoded.ok || !('value' in decoded)) throw new Error('expected event')
  assert.equal(decoded.value.envelope.eventId, envelope.eventId)
  assert.equal(decoded.value.resourceId, 'path-session-fixture')
  assert.equal(decoded.value.sequence, 1)
  assert.equal(decoded.value.raw.type, 'path.delta')
})

test('empty NDJSON lines are skipped and unknown versions fail closed', () => {
  assert.deepEqual(client.decodeNdjsonLine('   '), { ok: true, skipped: true })
  const incompatible = client.decodeNdjsonLine(JSON.stringify({
    ...streamEvent,
    schemaVersion: 2,
  }))
  assert.equal(incompatible.ok, false)
  if (incompatible.ok) throw new Error('expected failure')
  assert.equal(incompatible.error.code, 'SCHEMA_INCOMPATIBLE')
})

test('SSE decoder only reads data fields and rejects blocks without data', () => {
  const decoded = client.decodeSseBlock(`event: path\ndata: ${JSON.stringify(streamEvent)}\n\n`)
  assert.equal(decoded.ok, true)
  const missing = client.decodeSseBlock('event: path\n\n')
  assert.equal(missing.ok, false)
  if (missing.ok) throw new Error('expected failure')
  assert.equal(missing.error.code, 'SCHEMA_INVALID')
})

test('NDJSON transport yields lines before the connection closes', async () => {
  const firstLine = JSON.stringify(streamEvent)
  const secondLine = JSON.stringify({ ...streamEvent, sequence: 2, eventId: '22222222-2222-4222-8222-222222222222' })
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${firstLine}\n`))
      controller.enqueue(encoder.encode(`${secondLine}\n`))
      controller.close()
    },
  })
  const api = client.createApiClient({
    fetch: async () => ({ ok: true, status: 200, text: async () => `${firstLine}\n${secondLine}\n`, body: stream }),
  })
  const events = []
  for await (const item of api.readNdjson('/stream', 'trace-stream')) events.push(item)
  assert.equal(events.length, 2)
  assert.equal(events[0].ok, true)
  assert.equal(events[0].value.sequence, 1)
})

test('public errors reject unknown keys and injected fetch never invents success', async () => {
  const rejected = client.decodePublicError({
    code: 'SCHEMA_INVALID',
    message: 'Event payload failed schema validation.',
    traceId: 'fixture-trace',
    extra: true,
  })
  assert.equal(rejected.ok, false)

  const accepted = client.decodePublicError({
    code: 'SCHEMA_INVALID',
    message: 'Event payload failed schema validation.',
    traceId: 'fixture-trace',
  })
  assert.equal(accepted.ok, true)

  const api = client.createApiClient({
    fetch: async () => {
      throw new Error('network down')
    },
  })
  const failed = await api.readUnknown('/resource', 'trace-1')
  assert.equal(failed.ok, false)
  if (failed.ok) throw new Error('expected failure')
  assert.equal(failed.error.code, 'TRANSPORT_FAILED')

  const posted = client.createApiClient({
    fetch: async (url, init) => {
      assert.equal(url, '/api/path-runs')
      assert.equal(init?.method, 'POST')
      return { ok: true, status: 200, text: async () => '{"keep":true}' }
    },
  })
  const json = await posted.requestJson({
    url: '/api/path-runs',
    method: 'POST',
    body: '{"raw_goal":"x"}',
    traceId: 'trace-2',
  })
  assert.deepEqual(json, { ok: true, status: 200, value: { keep: true } })

  const aborted = client.createApiClient({
    fetch: async (_url, init) => {
      assert.equal(init?.signal?.aborted, true)
      const error = new Error('Aborted')
      error.name = 'AbortError'
      throw error
    },
  })
  const signal = AbortSignal.abort()
  const cancelled = await aborted.requestJson({
    url: '/api/path-runs',
    method: 'POST',
    signal,
    traceId: 'trace-3',
  })
  assert.equal(cancelled.ok, false)
  if (cancelled.ok) throw new Error('expected abort')
  assert.equal(cancelled.aborted, true)
})
