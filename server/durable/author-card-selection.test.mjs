import test from 'node:test'
import assert from 'node:assert/strict'
import {authorCardCandidates} from './author-card-selection.ts'
import {ProductTools} from './tools.ts'

const evidence=[
  {evidenceId:'opaque-original-a',authorId:'author-a',authorName:'作者甲',url:'https://zhuanlan.zhihu.com/p/1',title:'资料一',summary:'完整公开文章总结'},
  {evidenceId:'opaque-original-b',authorId:'author-b',authorName:'作者乙',url:'https://zhuanlan.zhihu.com/p/2',title:'资料二',summary:'另一份完整总结'},
  {evidenceId:'opaque-original-c',authorId:'author-a',authorName:'作者甲',url:'https://zhuanlan.zhihu.com/p/3',title:'资料三',summary:'同一作者的另一篇文章'},
]

test('short selections resolve only to the original evidence; unknown and repeated authors are rejected explicitly',()=>{
  const catalog=authorCardCandidates(evidence)
  assert.deepEqual(catalog.candidates.map(e=>e.evidenceId),['E1','E2','E3'])
  assert.deepEqual(catalog.resolve([{evidenceId:'E2'},{evidenceId:'E1'}]),[evidence[1],evidence[0]])
  assert.deepEqual(catalog.resolve([]),[])
  assert.throws(()=>catalog.resolve([{evidenceId:'E9'}]),/selections\[0\].*E1、E2、E3/)
  assert.throws(()=>catalog.resolve([{evidenceId:'E1'},{evidenceId:'E3'}]),/selections\[1\].*同一作者/)
  assert.equal(evidence[0].evidenceId,'opaque-original-a')
  const sameName=authorCardCandidates(evidence.slice(0,2).map(e=>({...e,authorName:'同名作者'})))
  assert.equal(sameName.resolve([{evidenceId:'E1'},{evidenceId:'E2'}]).length,2)
})

test('the same author-selection agent repairs a bad reference with specific feedback at the same depth',async()=>{
  const catalog=authorCardCandidates(evidence),calls=[],checkpoints=[]
  const tools=new ProductTools({complete:async input=>{
    calls.push(input)
    return {kind:'completed',text:JSON.stringify({normalizedQuestion:'详细讲解一下',selections:[{evidenceId:calls.length===1?'E9':'E2'}]})}
  }},{})
  const ctx={job:{input:{depth:'deep'}},signal:new AbortController().signal,step:async(n,i,work)=>work(),activity:async()=>{},store:{checkpoint:async(j,n,h,v)=>checkpoints.push({n,v})}}
  const selection=await tools.learning(ctx,'A-card-select',{candidates:catalog.candidates,question:'详细讲解一下'},v=>catalog.resolve(v.selections),'A-card-select:refs-v1')
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.thinkingDepth==='deep'))
  assert.equal(calls[0].messages[0].content,calls[1].messages[0].content)
  assert.match(calls[1].messages.at(-1).content,/selections\[0\].*E1、E2、E3/)
  assert.equal(catalog.resolve(selection.selections)[0],evidence[1]);assert.equal(checkpoints.length,1)
})
