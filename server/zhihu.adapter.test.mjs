import assert from 'node:assert/strict'
import test from 'node:test'
import { parseZhihuSearchPayload, zhihuDirectUrl, zhihuSearchUrl } from './zhihu.adapter.ts'

test('zhihu search URL stays under /api/v1/content/zhihu_search', () => {
  assert.equal(
    zhihuSearchUrl('https://developer.zhihu.com/api/v1', '线性映射', 8),
    'https://developer.zhihu.com/api/v1/content/zhihu_search?Query=%E7%BA%BF%E6%80%A7%E6%98%A0%E5%B0%84&Count=8',
  )
  assert.equal(
    zhihuSearchUrl('https://developer.zhihu.com', '线性映射', 8),
    'https://developer.zhihu.com/api/v1/content/zhihu_search?Query=%E7%BA%BF%E6%80%A7%E6%98%A0%E5%B0%84&Count=8',
  )
  assert.equal(zhihuDirectUrl('https://developer.zhihu.com/api/v1'), 'https://developer.zhihu.com/v1/chat/completions')
})

test('official ContentText items parse and Liu Kanshan is not an author key', () => {
  const parsed = parseZhihuSearchPayload({
    Code: 0,
    Data: {
      Items: [{
        Title: '什么是线性映射',
        Url: 'https://www.zhihu.com/question/1',
        ContentText: '保持加法和数乘',
        AuthorName: '真实作者',
        AuthorHomepage: '/people/real',
      }, {
        Title: '直达',
        Url: 'https://www.zhihu.com/question/2',
        ContentText: '刘看山说明',
        AuthorName: '刘看山',
        AuthorHomepage: 'https://www.zhihu.com/people/liukanshan',
      }],
    },
  })
  assert.equal(parsed.kind, 'hits')
  assert.equal(parsed.items.length, 2)
  assert.equal(parsed.items[0].excerpt, '保持加法和数乘')
  assert.equal(parsed.items[0].authorKey, 'https://www.zhihu.com/people/real')
  assert.equal(parsed.items[1].authorName, null)
  assert.equal(parsed.items[1].authorKey, null)
})

test('official items without AuthorHomepage still keep the article Url', () => {
  const parsed = parseZhihuSearchPayload({
    Code: 0,
    Data: {
      Items: [{
        Title: '积分梯度是什么',
        Url: 'https://zhuanlan.zhihu.com/p/1',
        ContentText: '梯度是积分核的对偶。',
        AuthorName: '真实作者',
      }],
    },
  })
  assert.equal(parsed.kind, 'hits')
  assert.equal(parsed.items[0].url, 'https://zhuanlan.zhihu.com/p/1')
  assert.equal(parsed.items[0].authorName, '真实作者')
  assert.equal(parsed.items[0].authorKey, null)
  assert.equal(parsed.items[0].authorUrl, null)
})

test('non-zero Zhihu Code is a failed search, not empty evidence', () => {
  const parsed = parseZhihuSearchPayload({ Code: 20001, Message: 'auth', Data: { Items: [] } })
  assert.equal(parsed.kind, 'failed')
  assert.match(parsed.message, /20001/)
})
