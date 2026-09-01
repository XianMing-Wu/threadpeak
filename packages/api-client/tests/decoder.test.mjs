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
  sequence: 0,
  type: 'path.delta',
}

test('NDJSON decoder accepts envelope plus cursor and keeps extra domain fields raw', () => {
  const decoded = client.decodeNdjsonLine(JSON.stringify(streamEvent))
  assert.equal(decoded.ok, true)
  if (!decoded.ok || !('value' in decoded)) throw new Error('expected event')
  assert.equal(decoded.value.envelope.eventId, envelope.eventId)
  assert.equal(decoded.value.resourceId, 'path-session-fixture')
  assert.equal(decoded.value.sequence, 0)
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
      assert.equal(url, '/api/paths/generate')
      assert.equal(init?.method, 'POST')
      return { ok: true, status: 200, text: async () => '{"keep":true}' }
    },
  })
  const json = await posted.requestJson({
    url: '/api/paths/generate',
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
    url: '/api/paths/generate',
    method: 'POST',
    signal,
    traceId: 'trace-3',
  })
  assert.equal(cancelled.ok, false)
  if (cancelled.ok) throw new Error('expected abort')
  assert.equal(cancelled.aborted, true)
})
