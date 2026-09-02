import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { resolveProviderConfig } from './config.ts'
import { createCompositionApp } from './http.ts'
import { loadTestConfig } from './path/config.ts'
import { buildPathApp } from './path/http.ts'
import { createRefusingProviderPair } from './path/providers.ts'
import { InMemoryPathSessionStore } from './path/service.ts'

const uuid = () => randomUUID().toLowerCase()

test('path stream rejects invalid content-type, schema, and missing sessions', async () => {
  const { search, model } = createRefusingProviderPair()
  const app = await buildPathApp({
    config: loadTestConfig(),
    search,
    model,
    store: new InMemoryPathSessionStore(),
  })
  const headers = {
    'x-threadpeak-tenant-id': '11111111-1111-4111-8111-111111111111',
    'x-threadpeak-principal-id': '22222222-2222-4222-8222-222222222222',
    'x-threadpeak-trace-id': 'path-http-test',
  }

  const unsupported = await app.inject({
    method: 'POST',
    url: '/api/paths/generate/stream',
    headers: { ...headers, 'content-type': 'text/plain' },
    payload: '{}',
  })
  assert.equal(unsupported.statusCode, 415)

  const schema = await app.inject({
    method: 'POST',
    url: '/api/paths/generate/stream',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: { kind: 'start', requestId: uuid(), sessionId: uuid() },
  })
  assert.equal(schema.statusCode, 422)

  const missing = await app.inject({
    method: 'GET',
    url: `/api/paths/sessions/${uuid()}`,
    headers,
  })
  assert.equal(missing.statusCode, 404)
  await app.close()
})

test('composition without provider config fail-closes ready and path stream', async () => {
  const app = await createCompositionApp({
    config: resolveProviderConfig({}),
    http: async () => ({ ok: false, status: 503, text: async () => '' }),
  })
  const ready = await app.inject({ method: 'GET', url: '/ready' })
  assert.equal(ready.statusCode, 503)
  const stream = await app.inject({
    method: 'POST',
    url: '/api/paths/generate/stream',
    headers: { 'content-type': 'application/json' },
    payload: { kind: 'start', requestId: uuid(), sessionId: uuid(), goal: '线性代数' },
  })
  assert.equal(stream.statusCode, 503)
  await app.close()
})
