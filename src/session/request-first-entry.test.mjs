import assert from 'node:assert/strict'
import test from 'node:test'
import { requestFirstEntry, requestFirstEntrySnapshot } from './request-first-entry.ts'

test('first-entry snapshot is GET and does not invent a lesson', async () => {
  const missing = await requestFirstEntrySnapshot({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    fetch: async () => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ kind: 'missing' }),
    }),
  })
  assert.equal(missing.kind, 'unavailable')
  assert.match(missing.message, /请先从路线进入学习/)

  const present = await requestFirstEntrySnapshot({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    fetch: async (url, init) => {
      assert.match(String(url), /\/api\/learning\/first-entry\?/)
      assert.equal(init?.method ?? 'GET', 'GET')
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          kind: 'completed',
          text: '已 settle 的首次回复。',
          contentHash: 'abc',
          reused: true,
          graph: {
            graphId: 'kg_1',
            routeId: 'generated-path',
            conceptId: 'kernel-image',
            canonicalContentHash: 'abc',
            revision: 1,
            root: { nodeId: 'root', title: '核与像', role: 'root', canonicalContentHash: 'abc' },
          },
        }),
      }
    },
  })
  assert.equal(present.kind, 'completed')
  assert.equal(present.reused, true)
  assert.equal(present.graph.root.title, '核与像')
})

test('first-entry POST returns answer and graph together', async () => {
  const result = await requestFirstEntry({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    title: '核与像',
    detailedDescription: '讲清保运算',
    fetch: async (url) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          kind: 'completed',
          text: '第一段。\n\n第二段。',
          contentHash: 'hash-1',
          reused: false,
          graph: {
            graphId: 'kg_1',
            routeId: 'generated-path',
            conceptId: 'kernel-image',
            canonicalContentHash: 'hash-1',
            revision: 1,
            root: { nodeId: 'root', title: '核与像', role: 'root', canonicalContentHash: 'hash-1' },
          },
        }),
      }
    },
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.graph.root.title, '核与像')
  assert.equal(result.contentHash, result.graph.canonicalContentHash)
})

test('running first-entry polls expose L0b draft text', async () => {
  const drafts = []
  let calls = 0
  const result = await requestFirstEntry({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    title: '核与像',
    detailedDescription: '讲清保运算',
    onDraft: (text) => { if (text) drafts.push(text) },
    fetch: async (url, init) => {
      if (String(url).includes('/api/ready')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ready: true }) }
      }
      calls += 1
      if ((init?.method ?? 'GET') === 'POST' || calls === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ kind: 'running', trace: [{ id: 'l0b', kind: 'agent', status: 'running', title: '组织第一段讲解' }] }),
        }
      }
      if (calls === 2) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            kind: 'running',
            draftText: '向量与空间变换',
            trace: [{ id: 'l0b', kind: 'agent', status: 'running', title: '组织第一段讲解' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          kind: 'completed',
          text: '向量与空间变换',
          contentHash: 'hash-1',
          reused: false,
          graph: {
            graphId: 'kg_1',
            routeId: 'generated-path',
            conceptId: 'kernel-image',
            canonicalContentHash: 'hash-1',
            revision: 1,
            root: { nodeId: 'root', title: '核与像', role: 'root', canonicalContentHash: 'hash-1' },
          },
        }),
      }
    },
  })
  assert.equal(result.kind, 'completed')
  assert.ok(drafts.includes('向量与空间变换'))
})
