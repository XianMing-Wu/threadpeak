import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLink, isDemoSourceUrl } from './source-link.ts'

test('OAuth demo source and profile links are preview-only, including query and hash', () => {
  for (const url of ['https://zhihu-demo.invalid/people/test', 'https://zhihu-demo.invalid/articles/12?from=favorites#p1']) {
    assert.deepEqual(sourceLink(url), { kind: 'demo' })
    assert.equal(isDemoSourceUrl(url), true)
    assert.equal(sourceLink(url).href, undefined)
  }
})

test('real evidence retains attribution links and external sites are not treated as demo authors', () => {
  const url = 'https://zhuanlan.zhihu.com/p/123?utm_source=openapi'
  assert.deepEqual(sourceLink(url), { kind: 'external', href: url })
  assert.equal(isDemoSourceUrl('https://blog.csdn.net/example/article/details/123'), false)
})

test('missing, executable and credential-bearing URLs cannot become source links', () => {
  for (const url of [null, undefined, '', 'invalid', 'javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com']) {
    assert.deepEqual(sourceLink(url), { kind: 'unavailable' })
  }
})
