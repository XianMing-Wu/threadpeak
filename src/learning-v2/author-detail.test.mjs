import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

test('author overview lists all articles across concepts and keeps reading and destination actions contextual',async()=>{
 const server=await createServer({configFile:false,cacheDir:`/tmp/threadpeak-author-ssr-${process.pid}`,optimizeDeps:{noDiscovery:true,include:[],entries:[]},server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
 try{
  const {AuthorDetail}=await server.ssrLoadModule('/src/learning-v2/AuthorPanels.tsx')
  const topic=id=>({id:`learning:${id}`,title:`主题${id}`,uses:0,helpful:0,score:0,pinned:false,hidden:false})
  const evidence=(id)=>({evidenceId:id,authorId:'same-author',authorName:'作者',title:`资料${id}`,summary:`原始正文${id}`,url:`https://zhuanlan.zhihu.com/p/${id}`,uses:[{key:id,topicId:`learning:${id}`,topic:`主题${id}`,question:'相关问题',nodeIds:[],origin:'learning'}]})
  const author={id:'same-author',name:'作者',identity:'platform',evidence:[evidence('1'),evidence('2')],topics:[topic('1'),topic('2')]}
  const html=renderToStaticMarkup(createElement(AuthorDetail,{author,initialLearningId:'1',onClose(){},async onFeedback(){}}))
  assert.match(html,/资料1/);assert.match(html,/资料2/)
  assert.equal((html.match(/class="au-source-row"/g)||[]).length,2)
  assert.match(html,/学习足迹/);assert.match(html,/推荐设置/)
  assert.doesNotMatch(html,/原始正文|加入这篇资料|选择正在学习的概念|au-topic-stats/)
 }finally{await server.close()}
})
