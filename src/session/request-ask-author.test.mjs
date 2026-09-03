import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAskAuthor } from './request-ask-author.ts'

function jsonResponse(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value),
  }
}

test('ask-author requires a selection before calling the live API', async () => {
  let called = 0
  const result = await requestAskAuthor({
    question: '为什么？',
    quote: '  ',
    fetch: async () => {
      called += 1
      return jsonResponse(200, { ready: true })
    },
  })
  assert.equal(result.kind, 'unavailable')
  assert.match(result.message, /划选/)
  assert.equal(called, 0)
})

test('ask-author maps looked-up author cards and keeps Liu Kanshan as direct text', async () => {
  const authors = await requestAskAuthor({
    question: '为什么？',
    quote: '同时保持加法',
    hostNodeId: 'root',
    hostContent: '线性映射同时保持加法。',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, {
        kind: 'authors',
        authors: [{
          authorId: 'https://www.zhihu.com/people/real',
          displayName: '真实作者',
          evidenceSummary: '必须保持加法。',
          evidenceUrl: 'https://www.zhihu.com/question/1',
          displayText: '必须保持加法。\n\n详细内容可以阅读我的文章 https://www.zhihu.com/question/1',
        }],
      })
    },
  })
  assert.equal(authors.kind, 'authors')
  assert.equal(authors.authors[0].name, '真实作者')
  assert.equal(authors.authors[0].text, '必须保持加法。')
  assert.equal(authors.authors[0].url, 'https://www.zhihu.com/question/1')
  assert.doesNotMatch(authors.authors[0].text, /详细内容可以阅读我的文章/)
  assert.doesNotMatch(authors.authors[0].text, /zhihu\.com/)

  const articleOnly = await requestAskAuthor({
    question: '为什么？',
    quote: '同时保持加法',
    hostNodeId: 'root',
    hostContent: '线性映射同时保持加法。',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, {
        kind: 'authors',
        authors: [{
          authorId: 'author-ev-ev-article',
          displayName: '真实作者',
          evidenceSummary: '必须保持加法。',
          evidenceUrl: 'https://zhuanlan.zhihu.com/p/1',
          displayText: '必须保持加法。\n\n详细内容可以阅读我的文章 https://zhuanlan.zhihu.com/p/1',
        }],
      })
    },
  })
  assert.equal(articleOnly.kind, 'authors')
  assert.equal(articleOnly.authors[0].url, 'https://zhuanlan.zhihu.com/p/1')

  const direct = await requestAskAuthor({
    question: '为什么？',
    quote: '同时保持加法',
    fetch: async (url) => {
      if (url === '/api/ready') return jsonResponse(200, { ready: true })
      return jsonResponse(200, { kind: 'direct', text: '我是刘看山。' })
    },
  })
  assert.equal(direct.kind, 'direct')
  assert.match(direct.text, /刘看山/)
})
