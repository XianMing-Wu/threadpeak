import test from 'node:test'
import assert from 'node:assert/strict'
import {ZhihuDataClient} from './zhihu-data.ts'

test('large PDF transfer can finish after the ordinary API deadline while cancellation remains immediate',async t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  t.mock.method(AbortSignal,'timeout',ms=>{const c=new AbortController();setTimeout(()=>c.abort(new DOMException('Timeout','TimeoutError')),ms);return c.signal})
  const fetcher=async(_url,init)=>new Promise((resolve,reject)=>{
    init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})
    setTimeout(()=>resolve(new Response(JSON.stringify({Code:0,Data:{file_id:'uploaded-on-slow-link'}}))),300_000)
  })
  const api=new ZhihuDataClient('test-secret',fetcher),form=new FormData()
  form.append('file',new Blob([new Uint8Array(95*1024*1024)]),'large.pdf')
  const upload=api.json('/resources/v1/files',{form})
  const success=assert.doesNotReject(async()=>assert.equal((await upload).file_id,'uploaded-on-slow-link'))
  t.mock.timers.tick(300_000)
  await success
  const caller=new AbortController(),cancelled=assert.rejects(api.json('/resources/v1/files',{form,signal:caller.signal}),{name:'AbortError'})
  caller.abort()
  await cancelled
  const ordinary=assert.rejects(api.json('/api/v1/user/favlists'),{name:'TimeoutError'})
  t.mock.timers.tick(120_000)
  await ordinary
})
