import assert from 'node:assert/strict'
import test from 'node:test'
import { lessonFromCanonical, requestCanonicalAnswer, requestCanonicalSnapshot } from './request-canonical-answer.ts'

test('canonical request fail-closes without inventing a first lesson', async () => {
  const result = await requestCanonicalAnswer({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    title: '核与像',
    fetch: async () => {
      throw new Error('offline')
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /不能用草稿发明一课/)
})

test('completed canonical text is split into lesson paragraphs and keeps the hash', async () => {
  const result = await requestCanonicalAnswer({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    title: '核与像',
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
          contentHash: 'abc',
          evidenceCount: 4,
          reused: true,
        }),
      }
    },
  })
  assert.equal(result.kind, 'completed')
  assert.equal(result.reused, true)
  assert.equal(result.contentHash, 'abc')
  const lesson = lessonFromCanonical('核与像', result.text)
  assert.deepEqual(lesson.paragraphs, ['第一段。', '第二段。'])
  assert.doesNotMatch(lesson.heading, /线性变换/)
})

test('canonical snapshot is a read-only GET and does not invent a first lesson', async () => {
  const missing = await requestCanonicalSnapshot({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    fetch: async () => ({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ kind: 'missing' }),
    }),
  })
  assert.equal(missing.kind, 'unavailable')
  assert.match(missing.message, /不能用草稿发明一课/)

  const present = await requestCanonicalSnapshot({
    routeId: 'generated-path',
    conceptId: 'kernel-image',
    fetch: async (url, init) => {
      assert.match(String(url), /\/api\/learning\/canonical-answer\?/)
      assert.equal(init?.method ?? 'GET', 'GET')
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          kind: 'completed',
          text: '已 settle 的首次回复。',
          contentHash: 'abc',
          evidenceCount: 2,
          reused: true,
        }),
      }
    },
  })
  assert.equal(present.kind, 'completed')
  assert.equal(present.reused, true)
  assert.equal(present.contentHash, 'abc')
  assert.match(present.text, /已 settle 的首次回复/)
})
