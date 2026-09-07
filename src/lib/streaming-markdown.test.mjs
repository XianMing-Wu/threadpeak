import test from 'node:test'
import assert from 'node:assert/strict'
import {streamingMarkdown} from '../../packages/contracts/src/streaming-markdown.ts'
import {prepareReading} from '../../packages/contracts/src/reading-policy.ts'
import {createServer} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

test('every partial formula prefix waits for complete delimiters; code and money remain visible',()=>{
 for(const formula of [String.raw`$\hat{v}=\frac{v}{\|v\|}$`,String.raw`$$A=\begin{pmatrix}1&2\\3&4\end{pmatrix}$$`,String.raw`\(x_i+1\)`,String.raw`\[x^2\]`]){
  for(let i=2;i<formula.length;i++)assert.equal(streamingMarkdown('之前。'+formula.slice(0,i)),'之前。',formula.slice(0,i))
  assert.equal(streamingMarkdown('之前。'+formula+'之后。'),'之前。'+formula+'之后。')
 }
 for(const s of ['预算 $5 和 $10。','`$x_i`','```cpp\nconst char* s = "$x_i";','[链接](https://example.com/$x)','预算 \\$5'])assert.equal(streamingMarkdown(s),s)
})

test('unfenced SSE code stays a single code block, preserving braces, underscores and comments',()=>{
 const source='// SSE 向量点积\n__m128 dot_product_sse(const float* a, const float* b, int n) {\n    __m128 sum = _mm_setzero_ps();\n    for (int i = 0; i < n; i += 4) {\n        __m128 va = _mm_load_ps(&a[i]);\n        sum = _mm_add_ps(sum, va);\n    }\n    // 水平求和\n    return sum;\n}\n\n这段代码需要核对边界条件。'
 const p=prepareReading(source,true)
 assert.equal(p.math.length,0);assert.match(p.markdown,/```cpp\n\/\/ SSE 向量点积/);assert.match(p.markdown,/return sum;\n}\n```/)
 assert.match(p.markdown,/这段代码需要核对边界条件。/);assert.doesNotMatch(p.markdown,/\$/)
})

test('waiting learning task retains rendered draft and recover actions; finalized cards are not fabricated',async()=>{
 const server=await createServer({configFile:false,cacheDir:`/tmp/threadpeak-stream-ssr-${process.pid}`,optimizeDeps:{noDiscovery:true,include:[],entries:[]},server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
 try{
  const {ChatPanel}=await server.ssrLoadModule('/src/learning-v2/Chat.tsx'),{LearningData}=await server.ssrLoadModule('/src/learning-v2/data.tsx')
  const draft=String.raw`正文保留，$x_i=2$。后半个公式 $\frac{1}{`
  const task={id:'job',status:'waiting',phase:'关联尚未完成',draft,activities:[{id:'answer:write',kind:'write',title:'撰写讲解',status:'done',startedAt:1,updatedAt:2},{id:'answer:attach',kind:'edit',title:'关联知识卡',status:'running',startedAt:2,updatedAt:3}]}
  const props={conversation:{id:'c',messages:[{id:'q',role:'user',text:'问题'}]},selected:[],nodes:[],depth:'fast',phase:'ready',draft,busy:false,paused:true,task,onDepth(){},onRemove(){},onClear(){},onSend(){},onStop(){},onRetry(){}}
  const html=renderToStaticMarkup(createElement(LearningData.Provider,{value:{articles:[],concept:'概念'}},createElement(ChatPanel,props)))
  assert.match(html,/正文保留/);assert.match(html,/class="katex/);assert.match(html,/继续完成/);assert.match(html,/关联知识卡/)
  assert.doesNotMatch(html,/引用到提问|\\frac|在脉络中查看|lp-chat-empty/)
 }finally{await server.close()}
})

test('C++ template tokens and pointer signatures survive HTML cleanup unchanged',()=>{
 for(const code of ['std::vector<float> values = {1, 2, 3};','float *cross_product(const float *a) {\n    return a;\n}','float* cross_product(const float* a) {\n    return a;\n}']){
  const p=prepareReading(code);assert.ok(p.markdown.includes(code),p.markdown);assert.match(p.markdown,/```cpp/);assert.equal(p.math.length,0)
 }
})
