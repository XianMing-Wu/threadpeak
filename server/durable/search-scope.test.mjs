import {placeAnswer} from '../../tests/fixtures/card-answer.mjs'
import {plan as goalPlan} from '../../tests/fixtures/goal-agents.mjs'
import {ROUTE_INTERVIEW_OUTPUT} from '../path-generation/direct-route.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {globalSearchUrl,parseZhihuSearchPayload} from '../zhihu.adapter.ts'
import {createAgentZhihuProvider} from '../agent-runtime/zhihu-provider.ts'
import {ProductTools} from './tools.ts'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
import {createFlows} from './flows.ts'
import {createProductApp} from './http.ts'
import {readAuthorNetwork} from './authors-network.ts'

const payload={Code:0,Data:{HasMore:false,Items:[{Title:'矩阵乘法',ContentID:'12',ContentType:'Article',ContentText:'正文'.repeat(2500),Url:'https://blog.csdn.net/example/article/details/12?utm_source=zhihu',AuthorName:'站外作者',AuthorAvatar:'https://picx.zhimg.com/a.jpg',VoteUpCount:23,CommentCount:4,EditTime:1745486539,AuthorityLevel:'2',RankingScore:.87,CommentInfoList:[{Content:'解释了具体例子'}]}]}}
test('global search uses official all-index contract and retains content metadata without author identities',async()=>{
  const url=new URL(globalSearchUrl('https://developer.zhihu.com/api/v1','矩阵 例子',500))
  assert.equal(url.pathname,'/api/v1/content/global_search');assert.equal(url.searchParams.get('Count'),'20');assert.equal(url.searchParams.get('SearchDB'),'all');assert.equal(url.searchParams.get('Query'),'矩阵 例子')
  const result=parseZhihuSearchPayload(payload,'web');assert.equal(result.kind,'hits');const e=result.items[0]
  assert.equal(e.excerpt.length,5000);assert.equal(e.authorName,null);assert.equal(e.authorKey,null);assert.equal(e.avatar,undefined)
  assert.equal(e.site,'blog.csdn.net');assert.equal(e.likes,23);assert.equal(e.editedAt,1745486539);assert.equal(e.commentCount,4);assert.deepEqual(e.comments,['解释了具体例子'])
  assert.equal(parseZhihuSearchPayload(payload).kind,'empty')
  const zhihu=structuredClone(payload);zhihu.Data.Items[0].Url='https://zhuanlan.zhihu.com/p/12';zhihu.Data.Items[0].AuthorBadgeText='数学领域';zhihu.Data.Items[0].AuthorBadge='https://picx.zhimg.com/badge.png'
  const author=parseZhihuSearchPayload(zhihu).items[0];assert.equal(author.avatar,'https://picx.zhimg.com/a.jpg');assert.equal(author.badge,'数学领域');assert.equal(author.rankingScore,.87)
  for(const unsafe of ['javascript:alert(1)','http://blog.csdn.net/x','https://secret@example.com/x']){const bad=structuredClone(payload);bad.Data.Items[0].Url=unsafe;assert.equal(parseZhihuSearchPayload(bad,'web').kind,'empty')}
})
test('real provider adapter keeps global origin, platform headers and no CSDN author ID',async()=>{
  const provider=createAgentZhihuProvider({config:{zhihuApiBaseUrl:'https://developer.zhihu.com/api/v1',zhihuAccessSecret:'platform-test'},clock:{unixSeconds:()=>100},http:async(url,init)=>{
    assert.equal(new URL(url).pathname,'/api/v1/content/global_search');assert.equal(init.headers.Authorization,'Bearer platform-test');assert.equal(init.headers['X-Request-Timestamp'],'100')
    return {ok:true,status:200,text:async()=>JSON.stringify(payload)}
  }})
  const result=await provider.globalSearch('矩阵',20);assert.equal(result.kind,'hits');assert.equal(result.items[0].authorId,null);assert.equal(result.items[0].sourceKind,'web');assert.equal(result.items[0].summary.length,5000)
})
test('web branch retains successful provider checkpoint across rate limiting and prefers Zhihu on duplicate URLs',async()=>{
  let zcalls=0,wcalls=0;const saved=new Map();const ctx={activity:async()=>{},signal:new AbortController().signal,step:async(name,input,fn)=>{if(saved.has(name))return saved.get(name);const value=await fn();saved.set(name,value);return value}}
  const z={evidenceId:'z',authorId:'author-z',authorName:'知乎作者',title:'概念',summary:'知乎摘要',url:'https://www.zhihu.com/answer/12?utm_source=z',sourceKind:'zhihu'}
  const tools=new ProductTools({}, {search:async()=>{zcalls++;return {kind:'hits',items:[z]}},globalSearch:async()=>{wcalls++;return wcalls===1?{kind:'failed',code:'HTTP_429',retryable:true,message:'限流'}:{kind:'hits',items:[{...z,evidenceId:'other',url:'https://www.zhihu.com/answer/12?utm_source=web'},{...z,evidenceId:'csdn',url:'https://blog.csdn.net/example/article/details/13'}]}}})
  await assert.rejects(tools.search(ctx,'R-S:0','概念',{kind:'web'}),e=>e.code==='HTTP_429')
  const result=await tools.search(ctx,'R-S:0','概念',{kind:'web'});assert.equal(zcalls,1);assert.equal(wcalls,2);assert.equal(result.length,2);assert.equal(result[0].authorId,'author-z');assert.equal(result[1].authorId,null)
  await assert.rejects(tools.search(ctx,'bad','概念',{kind:'collections',folderIds:['1']}),e=>e.code==='EXTERNAL_SEARCH_OUTSIDE_SCOPE')
})
test('collection-only route and concept inherit owned scope with zero external search/direct calls',async t=>{
  const db=await openDatabase();await migrate(db);const store=new DurableStore(db),inputs=[]
  const llm={complete:async args=>{
    const c=JSON.parse(args.messages[1].content);inputs.push(c)
    if(c.citationCatalog)return {kind:'completed',text:JSON.stringify(placeAnswer(c))}
    if(c.read_card_scope){return {kind:'completed',text:JSON.stringify({sourceReview:c.read_card_scope.cards.map(x=>({ref:x.ref,contribution:'解释坐标'})),sections:[{after:'C1',title:'理解坐标',text:'坐标表示基下的分量。'}]})}}
    if(c.angle)return {kind:'completed',text:'根据所选收藏，坐标表示基下的分量。'}
    if(c.newerRoundPreferred){const p=goalPlan();return {kind:'completed',text:JSON.stringify({...p,stages:p.stages.map(carriers=>({parallel:false,carriers}))})}}
    if(c.catalogCarriers)return {kind:'completed',text:ROUTE_INTERVIEW_OUTPUT}
    if(c.firstSearch)return {kind:'completed',text:JSON.stringify({carriers:[]})}
    return {kind:'completed',text:JSON.stringify({queries:[0,1,2,3].map(i=>({id:String(i),text:`坐标学习课程推荐${i}`,purpose:'发现目标相关的学习选择',angle:i<2?'normal_learning':'pitfall_or_dispute'}))})}
  }}
  const noExternal={search:async()=>{throw new Error('unexpected external search')},globalSearch:async()=>{throw new Error('unexpected global search')},direct:async()=>{throw new Error('unexpected Zhihu direct')}}
  const worker=new DurableWorker(store,createFlows(new ProductTools(llm,noExternal)),1,()=>{})
  const app=await createProductApp({store,worker,identity:{production:false},providersReady:true})
  t.after(async()=>{await app.close();await db.close()})
  const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0],own='account:zhihu:test-authorized'
  await db.query('UPDATE tp_sessions SET owner_id=$1',[own])
  const material=await store.create(own,'attachment','selected-folder',{fileName:'线性代数收藏',origin:'collection',folderId:'55',status:'ready',mimeType:'text/markdown',content:'坐标表示基下的分量。',entries:[{id:'e',title:'坐标入门',summary:'坐标表示基下的分量。',url:'https://zhuanlan.zhihu.com/p/55',authorId:'https://www.zhihu.com/people/a',authorName:'作者甲',likes:1}]})
  const body={goal:'学会收藏夹内容',searchScope:{kind:'collections',folderIds:['55']},attachments:[{sourceId:material.id,fileName:'client name',content:'client text must not be used'}]}
  const bad=await app.inject({method:'POST',url:'/api/path-runs',headers:{cookie},payload:{...body,searchScope:{kind:'collections',folderIds:['forged']}}});assert.equal(bad.statusCode,400)
  const accepted=await app.inject({method:'POST',url:'/api/path-runs',headers:{cookie},payload:body});assert.equal(accepted.statusCode,202,accepted.body);const id=accepted.json().runId
  async function finish(id){for(let i=0;i<500;i++){const s=await store.snapshot(own,id);if(['completed','waiting'].includes(s.job?.status))return s;await new Promise(r=>setTimeout(r,10))}throw new Error('timeout')}
  let snapshot=await finish(id);assert.equal(snapshot.job.status,'completed',JSON.stringify(snapshot.job));assert.equal(snapshot.data.attachments[0].content,'坐标表示基下的分量。')
  for(const q of snapshot.data.questionSets[0].questions)await app.inject({method:'POST',url:`/api/path-runs/${id}/select`,headers:{cookie},payload:{questionId:q.id,optionId:q.options[0].id}})
  snapshot=await finish(id);assert.equal(snapshot.data.status,'published',JSON.stringify(snapshot.job))
  assert.equal(inputs.find(c=>c.newerRoundPreferred).attachments[0].contentBasis,'source_summary')
  assert.equal(snapshot.data.route.concepts[0].goalAlignment.materialAnchors[0].evidenceKind,'context_summary')
  const enter=await app.inject({method:'POST',url:'/api/v2/learning/enter',headers:{cookie},payload:{routeId:snapshot.data.document.id,conceptId:snapshot.data.route.concepts[0].id}})
  assert.equal(enter.statusCode,200,enter.body);const learning=await finish(enter.json().id);assert.equal(learning.job.status,'completed',JSON.stringify(learning.job));assert.deepEqual(learning.data.searchScope,body.searchScope);assert.equal(learning.data.articles.length,1);assert.equal(inputs.filter(c=>c.angle).length,0)
  assert.ok(inputs.every(c=>JSON.stringify(c).includes('坐标')))
  const fakeWeb={...learning.data,articles:learning.data.articles.map(a=>({...a,sourceKind:'web',author:'伪作者'}))}
  await store.edit(own,enter.json().id,undefined,()=>fakeWeb)
  const network=await readAuthorNetwork(db,own);assert.ok(network.authors.every(a=>a.evidence.every(e=>e.uses.every(u=>!u.resourceId))))
})
