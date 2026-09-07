import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('source comments preserve every supplied comment without counts or redundant links', async t => {
  const server = await createServer({configFile:false,cacheDir:`/tmp/threadpeak-comments-ssr-${process.pid}`,optimizeDeps:{noDiscovery:true,include:[],entries:[]},server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
  try {
    const { CommentList } = await server.ssrLoadModule('/src/learning-v2/SourceComments.tsx')
    const render = props => renderToStaticMarkup(createElement(CommentList, props))
    await t.test('all returned comments stay visible even when there are more than ten', () => {
      const comments = Array.from({length:24}, (_, i) => `评论内容${i + 1}`)
      const html = render({comments, total:80, url:'https://zhuanlan.zhihu.com/p/12'})
      assert.equal((html.match(/<li>/g) ?? []).length,24)
      for (const comment of comments) assert.ok(html.includes(comment))
      assert.doesNotMatch(html,/共 80 条|24 条精选评论|已收录/)
      assert.doesNotMatch(html,/<details|<summary/)
      assert.doesNotMatch(html,/到原文查看全部评论|href=/)
    })
    await t.test('missing comments do not imply no comments; unknown total is never invented', () => {
      assert.equal(render({total:31,url:'https://www.zhihu.com/answer/12'}),'')
      const unknown = render({comments:['第一条'],url:'https://www.zhihu.com/answer/12'})
      assert.match(unknown,/第一条/); assert.doesNotMatch(unknown,/共 1 条|已收录|href=/)
      assert.equal(render({comments:[],total:0}),'')
    })
    await t.test('demo and unsafe links cannot become full-comment destinations', () => {
      assert.equal(render({comments:['演示'],url:'https://zhihu-demo.invalid/p/12'}),'')
      assert.doesNotMatch(render({comments:['安全内容'],url:'javascript:alert(1)'}),/href=|javascript:/)
    })
  } finally { await server.close() }
})
