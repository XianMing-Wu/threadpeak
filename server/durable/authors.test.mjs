import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {DurableStore} from './store.ts'
import {TaskContext,DurableWorker} from './worker.ts'
import {ProductTools} from './tools.ts'
import {createFlows} from './flows.ts'
import {createProductApp} from './http.ts'
import {readAuthorNetwork,knownSourceIdentity,sourceForNode,recordAuthorUse,learningTopic,sourceTopic} from './authors-network.ts'
import {validateAuthorMatches,searchAuthors,authorEvidenceScope} from './authors-search.ts'
import {rankAuthorMatches,consultationDraft,AuthorBriefSchema} from '@threadpeak/contracts/authors'
import {networkGraph} from '../../src/learning-v2/author-graph.ts'
const source=(id,name=id)=>({evidenceId:id,authorId:`author-${id}`,authorName:name,title:'向量空间与换基',summary:`材料 ${id} 说明同一个线性映射在不同基下有不同的坐标表示。`,url:`https://www.zhihu.com/question/1/answer/${id}`})
const state=(items)=>({version:2,routeId:'route',conceptId:'concept',title:'线性映射',description:'从矩阵和坐标理解',hasDispute:false,articles:items.map(e=>({id:e.evidenceId,title:e.title,summary:e.summary,author:e.authorName,authorId:e.authorId,likes:null,url:e.url,topic:'知乎文章'})),nodes:[{id:'root',type:'root',title:'线性映射',text:'',parents:[],sources:items.map(e=>e.evidenceId)},...items.map(e=>({id:e.evidenceId,type:'article',title:e.title,text:e.summary,parents:['root'],sources:[e.evidenceId]}))],conversations:[{id:'chat',title:'学习',messages:[],date:'2026-09-06'}],active:'chat',initialized:true,phase:'ready'})
async function setup(t){const db=await openDatabase();await migrate(db);t.after(()=>db.close());return new DurableStore(db)}
const selection=e=>({sourceRef:typeof e==='string'?e:e.ref,fit:'direct',reason:'材料讲解了换基与坐标之间的关系。',canHelpWith:'理解换基',limitation:'未确认是否提供咨询',question:'能否带我算一个二维例子？',messageBody:'我在学习换基，想请教怎样一步步算一个二维例子。',passageRefs:['P1']})

test('learning authors are discovered with immutable sources, no automatic credit, no display-name merge',async t=>{
 const store=await setup(t),items=[source('a','同名'),source('b','同名')],s=state(items)
 s.nodes[1].text='用户编辑副本';s.nodes.push({id:'answer',type:'answer',title:'扩展',text:'讲解',parents:['a'],sources:['a'],basisId:'a'})
 s.nodes.push({id:'mine',type:'custom',title:'笔记',text:'我的文字',parents:['a'],sources:[]})
 const r=await store.create('owner','learning','one',s)
 const n=await readAuthorNetwork(store.db,'owner');assert.equal(n.authors.length,2)
 assert.equal(n.authors[0].evidence[0].summary,items[0].summary);assert.deepEqual(n.authors[0].evidence[0].uses[0].nodeIds,['a','answer'])
 assert.equal(n.authors[0].topics[0].score,0);assert.equal(sourceForNode(s,'mine'),undefined)
 assert.deepEqual((await readAuthorNetwork(store.db,'other')).authors,[])
 await store.edit('owner',r.id,undefined,r=>({...r.body,nodes:r.body.nodes.filter(n=>n.id!=='answer')}))
 assert.deepEqual((await readAuthorNetwork(store.db,'owner')).authors[0].evidence[0].uses[0].nodeIds,['a'])
})
test('explicit multi-source use shares one credit; retries, defaults, failures and cancellation never inflate it',async t=>{
 const store=await setup(t),s=state([source('a'),source('b')]),r=await store.create('owner','learning','use',s)
 const rows=[{basisId:'a'},{basisId:'a'},{basisId:'b'}]
 await recordAuthorUse(store.db,'owner',r.id,'default',s,[],rows)
 assert.equal((await store.db.query('SELECT * FROM tp_author_usage')).length,0)
 for(let i=0;i<2;i++)await recordAuthorUse(store.db,'owner',r.id,'same',s,['a','b'],rows)
 let usage=await store.db.query('SELECT * FROM tp_author_usage');assert.equal(usage.length,2);assert.equal(usage.reduce((n,u)=>n+u.amount,0),1)
 for(let i=0;i<10;i++)await recordAuthorUse(store.db,'owner',r.id,`more-${i}`,s,['a'],[{basisId:'a'}])
 assert.equal((await readAuthorNetwork(store.db,'owner')).authors.find(a=>a.id==='author-a').topics[0].score,3)
 await store.enqueue('owner',r.id,'learning.reply','rollback',{});const job=await store.claim()
 await assert.rejects(store.commit(job,async(r,tx)=>{await recordAuthorUse(tx,'owner',r.id,job.id,s,['a'],rows);throw new Error('crash')}))
 assert.equal((await store.db.query('SELECT * FROM tp_author_usage WHERE event_key=$1',[job.id])).length,0)
 await store.cancel('owner',r.id)
 await assert.rejects(store.commit(job,async(r,tx)=>{await recordAuthorUse(tx,'owner',r.id,job.id,s,['a'],rows);return s}))
})
test('matching selects numbered passages, preserves all text and never invents identity after compression',()=>{
 const a={...source('a'),comments:['读者反馈，不是作者观点'],likes:5,commentCount:30,editedAt:1234,rankingScore:2,badge:'认证文案'},b=source('b'),original=[a,b],candidates=authorEvidenceScope(original)
 assert.deepEqual(candidates[0].metadata.comments,[{content:'读者反馈，不是作者观点'}]);assert.equal(candidates[0].metadata.editedAt,1234);assert.equal(candidates[0].metadata.badge,'认证文案')
 const output=selections=>({selections,unresolved:''})
 assert.throws(()=>validateAuthorMatches(output([{...selection('E1'),passageRefs:['P999']}]),{candidates},original),/段落编号/)
 assert.throws(()=>validateAuthorMatches(output([selection('invented')]),{candidates},original),/sourceRef/)
 assert.equal(validateAuthorMatches(output([selection('E1'),selection('E1')]),{candidates},original).selections.length,1)
 const result=validateAuthorMatches(output([selection('E2')]),{candidates},original)
 assert.equal(result.selections[0].quote,b.summary);assert.equal(result.selections[0].evidenceId,'b')
 const compressed=structuredClone(candidates);compressed[0].passages[0].content='[上下文摘要] 换基不改变映射。'
 assert.equal(validateAuthorMatches(output([selection('E1')]),{candidates:compressed},original).summaryVersions.a,true)
 compressed[0].passages[0].ref='P9'
 assert.throws(()=>validateAuthorMatches(output([selection('E1')]),{candidates:compressed},original),/绑定/)
 const unknown=[{...a,authorId:'author-ev-a',authorName:'同名'},{...b,authorId:'author-ev-b',authorName:'同名'}]
 assert.equal(validateAuthorMatches(output(['E1','E2'].map(selection)),{candidates:authorEvidenceScope(unknown)},unknown).selections.length,2)
 const long={...a,summary:('公式：$x^2$。换基！\n'+'a'.repeat(4000)+'🦊').repeat(10)}
 assert.equal(authorEvidenceScope([long])[0].passages.map(p=>p.content).join(''),long.summary)
})
test('relevance precedes preference, personalization is explainable and hidden/new controls remain effective',()=>{
 const candidate=(id,fit,score,known=true)=>({...source(id),...selection(source(id)),fit,known,topic:{id:'x',title:'换基',uses:score,helpful:0,score,pinned:false,hidden:false},quoteSummarized:false,history:[]})
 const items=[candidate('a','direct',0),candidate('b','direct',2),candidate('c','direct',0),candidate('new','direct',0,false),candidate('irrelevant','related',999)]
 assert.deepEqual(rankAuthorMatches(items,false).map(x=>x.evidenceId),['a','b','c'])
 assert.deepEqual(rankAuthorMatches(items,true).map(x=>x.evidenceId),['b','a','new'])
 items[1].topic.hidden=true
 assert(!rankAuthorMatches(items,false).some(x=>x.evidenceId==='b'))
 assert.deepEqual(rankAuthorMatches(items,true,true).map(x=>x.evidenceId),['new'])
 const draft=consultationDraft(AuthorBriefSchema.parse({question:'如何换基',purpose:'consult',attempted:'做了一个例子'}),{...items[0],messageBody:undefined})
 assert.match(draft,/已尝试/);assert.match(draft,/是否开放咨询/);assert.match(draft,/https:\/\/www.zhihu.com/)
})
test('N0 with three known people still searches both routes; same-model reference repair and durable topic discovery',async t=>{
 const store=await setup(t),known=[source('a'),source('b'),source('c')]
 await store.create('owner','learning','scope',state(known));let searches=0,attempts=0
 const fresh=source('new'),llm={async complete(input){
  const data=JSON.parse(input.messages[1].content)
  if(input.messages[0].content.includes('needs 列出'))return {kind:'completed',text:JSON.stringify({topic:'线性映射',needs:['换基'],queries:['线性映射换基坐标含义','同一线性映射不同基矩阵']})}
  attempts++;const picks=data.candidates.map(selection)
  if(attempts===1)picks[0].passageRefs=['P999']
  assert.equal(data.candidates.length,4)
  return {kind:'completed',text:JSON.stringify({selections:picks,unresolved:'服务是否开放需确认。'})}
 }}
 const zhihu={async search(){searches++;return {kind:'hits',items:[fresh]}},async direct(){throw Error('not used')}}
 const tools=new ProductTools(llm,zhihu),brief=AuthorBriefSchema.parse({question:'线性映射换基坐标'}),r=await store.create('owner','authors','search',{question:brief.question})
 await store.enqueue('owner',r.id,'authors.search','search-command',brief);const job=await store.claim(),ctx=new TaskContext(store,job,new AbortController().signal)
 await searchAuthors(ctx,tools)
 const result=(await store.snapshot('owner',r.id)).data
 assert.equal(searches,2);assert.equal(attempts,2);assert.equal(result.results.length,3);assert.equal(result.candidates.length,4)
 assert(result.results.some(a=>a.authorId===fresh.authorId));assert(result.candidates.some(a=>a.authorName===fresh.authorName))
 assert.equal((await readAuthorNetwork(store.db,'owner')).authors.find(a=>a.id===fresh.authorId).topics[0].score,0)
})
test('author feedback validates ownership and source/topic membership, is reversible and idempotent',async t=>{
 const store=await setup(t),worker=new DurableWorker(store,async()=>{},()=>{}),app=await createProductApp({store,worker,identity:{production:false},providersReady:true});t.after(()=>app.close())
 const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0],headers={cookie},owner=(await store.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
 const r=await store.create(owner,'learning','scope',state([source('a')]))
 const payload={authorId:'author-a',topicId:learningTopic(r.id),evidenceId:'a',kind:'helpful',value:true}
 const request=(p,k='feedback-test-1')=>app.inject({method:'POST',url:'/api/v2/authors/feedback',headers:{...headers,'Idempotency-Key':k},payload:p})
 let result=await request(payload);assert.equal(result.statusCode,200);assert.equal(result.json().authors[0].topics[0].score,2)
 await request(payload);assert.equal((await store.db.query('SELECT * FROM tp_author_preferences')).length,1)
 assert.equal((await request({...payload,evidenceId:'other'},'bad-source')).statusCode,404)
 assert.equal((await request({...payload,value:false})).statusCode,409)
 result=await request({...payload,value:false},'undo-feedback');assert.equal(result.json().authors[0].topics[0].score,0)
 const other=await app.inject({method:'POST',url:'/api/auth/guest'}),otherCookie=String(other.headers['set-cookie']).split(';')[0]
 assert.equal((await app.inject({method:'POST',url:'/api/v2/authors/feedback',headers:{cookie:otherCookie},payload})).statusCode,404)
 await request({...payload,kind:'pinned'},'pin-feedback')
 result=await app.inject({method:'POST',url:'/api/v2/authors/preferences/clear',headers,payload:{}});assert.equal(result.statusCode,200);assert.equal(result.json().authors.length,1);assert.equal(result.json().authors[0].topics[0].pinned,false)
 // A late transport replay of old feedback cannot resurrect cleared preferences.
 await request(payload);assert.equal((await store.db.query('SELECT * FROM tp_author_preferences')).length,0)
})
test('import uses owned evidence, verifies concept relevance and preserves the single-parent tree',async t=>{
 const store=await setup(t),s=state([source('a')]),r=await store.create('owner','learning','import',s),e=source('new')
 const tools={async learning(_ctx,_name,input){assert.equal(input.concept.title,'线性映射');assert.equal(input.candidates[0].summary,e.summary);return {evidenceIds:[e.evidenceId]}}},flow=createFlows(tools)
 await store.enqueue('owner',r.id,'learning.import','import-source',{evidence:e});let job=await store.claim();await flow(new TaskContext(store,job,new AbortController().signal))
 let data=(await store.snapshot('owner',r.id)).data;assert.equal(data.nodes.find(n=>n.id==='new').parents[0],'root');assert.equal(data.conversations[0].messages.length,0);assert.equal(data.importResult.status,'added')
 await store.enqueue('owner',r.id,'learning.import','import-again',{evidence:e});job=await store.claim();await flow(new TaskContext(store,job,new AbortController().signal));data=(await store.snapshot('owner',r.id)).data;assert.equal(data.importResult.status,'already-present');assert.equal(data.articles.length,2)
 tools.learning=async()=>({evidenceIds:[]})
 await store.enqueue('owner',r.id,'learning.import','import-unrelated',{evidence:source('wrong')});job=await store.claim();await flow(new TaskContext(store,job,new AbortController().signal));data=(await store.snapshot('owner',r.id)).data;assert.equal(data.importResult.status,'unrelated');assert.equal(data.articles.length,2)
})

test('one stable author retains many articles, concepts, archived questions and search occurrences',async t=>{
 const store=await setup(t),a=source('a','作者甲'),b={...source('b','作者甲'),authorId:a.authorId}
 const first=state([a,b]),second={...state([a]),conceptId:'functions',title:'函数'}
 const p=(id,basisId)=>({id,basisId,title:`解释 ${id}`,text:'补充说明',parents:[basisId],sources:[basisId]})
 const pa=p('answer-a','a'),pb=p('answer-b','b')
 first.nodes.push({...pa,type:'answer'},{...pb,type:'answer'})
 first.conversations[0].messages=[{id:'q1',role:'user',text:'换基为什么改变坐标？'},{id:'response1',role:'assistant',paragraphs:[pa]}]
 first.conversations.push({id:'archived',title:'旧对话',date:'2026-09-06',messages:[{id:'q2',role:'user',text:'怎么手算矩阵？'},{id:'response2',role:'assistant',paragraphs:[pb]}]})
 await store.create('owner','path','route',{document:{id:'route'},route:{concepts:[{id:'concept',carrierId:'linear'},{id:'functions',carrierId:'analysis'}],carriers:[{id:'linear',title:'线性代数'},{id:'analysis',title:'数学分析'}]}})
 const one=await store.create('owner','learning','first',first),two=await store.create('owner','learning','second',second)
 for(const [id,question] of [['search1','如何求逆？'],['search2','如何判断可逆？']])await store.db.query('INSERT INTO tp_author_discoveries(owner_id,author_id,evidence_id,topic_id,search_id,body) VALUES($1,$2,$3,$4,$5,$6::jsonb)',['owner',a.authorId,a.evidenceId,'topic:矩阵',id,JSON.stringify({evidence:a,question,topic:'矩阵',topicId:'topic:矩阵',searchId:id})])
 await migrate(store.db) // migration re-entry keeps both occurrences
 const n=await readAuthorNetwork(store.db,'owner'),author=n.authors[0]
 assert.equal(n.authors.length,1);assert.equal(author.evidence.length,2);assert.equal(author.topics.length,3)
 assert(author.evidence[0].uses.some(u=>u.question==='换基为什么改变坐标？'&&u.nodeTitles['answer-a']==='解释 answer-a'))
 assert.deepEqual(author.evidence[0].uses.filter(u=>u.origin==='search').map(u=>u.question).sort(),['如何判断可逆？','如何求逆？'].sort())
 assert.equal(author.evidence[0].uses.find(u=>u.resourceId===one.id).carrier,'线性代数')
 assert.equal(author.evidence[0].uses.find(u=>u.resourceId===two.id).carrier,'数学分析')
 const graph=networkGraph(n)
 assert.equal(graph.nodes.filter(n=>n.kind==='author').length,1)
 assert.equal(graph.nodes.filter(n=>n.kind==='question').length,4)
 assert.equal(graph.nodes.filter(n=>n.kind==='concept').length,3)
 assert.equal(graph.nodes.filter(n=>n.kind==='carrier').length,2)
 assert.equal(new Set(graph.edges.map(e=>e.id)).size,graph.edges.length)
 assert.equal(networkGraph(n,learningTopic(one.id)).nodes.filter(n=>n.kind==='question').length,2)
 const rows=[{basisId:'a'},{basisId:'b'}]
 await recordAuthorUse(store.db,'owner',one.id,'one-command',first,['a','b'],rows)
 const use=(await store.db.query('SELECT * FROM tp_author_usage'))[0]
 assert.equal(use.amount,1);assert.deepEqual(use.body.evidenceIds,['a','b'])
 // The same article's experience can help an independent search. Unrelated
 // articles and explicit other concepts cannot borrow the author's global weight.
 const updated=(await readAuthorNetwork(store.db,'owner')).authors[0]
 assert.equal(sourceTopic(updated,'b','topic:new','新问法').score,1)
 assert.equal(sourceTopic(updated,'unknown','topic:new','新问法').score,0)
 assert.equal(sourceTopic(updated,'b',learningTopic(two.id),'函数',true).score,0)
})

test('many materials compile to at most three distinct people without merging stored identities',()=>{
 const c=(id,authorId,name)=>({...source(id,name),authorId,fit:'direct',known:false,topic:{id:'x',score:0,pinned:false,hidden:false}})
 const pool=[c('a','author-a','甲'),c('b','author-a','甲'),c('c','author-c','丙'),c('d','author-d','丁')]
 assert.deepEqual(rankAuthorMatches(pool,false).map(x=>x.evidenceId),['a','c','d'])
 assert.equal(rankAuthorMatches([c('a','author-ev-a','同名'),c('b','author-ev-b','同名')],false).length,1)
 assert.equal(rankAuthorMatches([c('a','verified-a','同名'),c('b','verified-b','同名')],false).length,2)
 assert.equal(pool.length,4)
})

test('search and import enforce ownership and retry the original frozen command after source edits',async t=>{
 const store=await setup(t),worker=new DurableWorker(store,async()=>{},()=>{}),app=await createProductApp({store,worker,identity:{production:false},providersReady:true});t.after(()=>app.close())
 const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0],headers={cookie},owner=(await store.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
 const own=await store.create(owner,'learning','owned',state([source('a')])),foreign=await store.create('other','learning','foreign',state([source('secret')]))
 const post=(url,payload,key)=>app.inject({method:'POST',url,headers:{...headers,'Idempotency-Key':key},payload})
 const question={question:'我不理解换基',learningId:own.id,selected:['a']}
 assert.equal((await post('/api/v2/authors/search',{...question,learningId:foreign.id},'foreign-search')).statusCode,404)
 assert.equal((await post('/api/v2/authors/search',{...question,selected:['missing']},'missing-card')).statusCode,400)
 const search=await post('/api/v2/authors/search',question,'frozen-search');assert.equal(search.statusCode,200)
 await store.edit(owner,own.id,undefined,r=>({...r.body,nodes:r.body.nodes.filter(n=>n.id!=='a')}))
 const repeated=await post('/api/v2/authors/search',question,'frozen-search');assert.equal(repeated.statusCode,200);assert.equal(repeated.json().job.id,search.json().job.id)
 const accepted=await store.existingCommand(owner,'frozen-search');assert.equal(accepted.input.selectedContext[0].content,source('a').summary);assert.equal(accepted.input.concept.description,'从矩阵和坐标理解')
 assert.equal((await post('/api/v2/authors/search',{...question,question:'改了问题'},'frozen-search')).statusCode,409)
 const target=await store.create(owner,'learning','target',state([source('b')]))
 assert.equal((await post(`/api/v2/learning/${target.id}/import-author-source`,{authorId:'author-secret',evidenceId:'secret'},'foreign-source')).statusCode,404)
 const request={authorId:'author-b',evidenceId:'b'},imported=await post(`/api/v2/learning/${target.id}/import-author-source`,request,'frozen-import');assert.equal(imported.statusCode,200)
 await store.edit(owner,target.id,undefined,r=>({...r.body,nodes:r.body.nodes.filter(n=>n.id!=='b')}))
 const retried=await post(`/api/v2/learning/${target.id}/import-author-source`,request,'frozen-import');assert.equal(retried.statusCode,200);assert.equal(retried.json().job.id,imported.json().job.id)
})

test('demo sources remain in the demo network but never become real consultation candidates',async t=>{
 const store=await setup(t),owner='account:zhihu:mock:qa'
 const demo={...source('demo','【演示作者】林小数'),authorId:'https://zhihu-demo.invalid/people/demo',url:'https://zhihu-demo.invalid/article/1'}
 await store.create(owner,'learning','demo-learning',state([demo]))
 assert.equal((await readAuthorNetwork(store.db,owner)).authors.length,1)
 let searches=0
 const tools=new ProductTools({async complete(input){
  assert.match(input.messages[0].content,/needs 列出/,'demo evidence must never reach the matching step')
  return {kind:'completed',text:JSON.stringify({topic:'线性映射',needs:['换基'],queries:['线性映射换基坐标','二维换基的直观例子']})}
 }},{async search(){searches++;return {kind:'empty'}},async direct(){throw Error('not used')}})
 const brief=AuthorBriefSchema.parse({question:'线性映射换基坐标'}),resource=await store.create(owner,'authors','demo-search',{question:brief.question})
 await store.enqueue(owner,resource.id,'authors.search','demo-search-command',brief)
 const ctx=new TaskContext(store,await store.claim(),new AbortController().signal)
 await searchAuthors(ctx,tools)
 assert.equal(searches,2);assert.deepEqual((await store.snapshot(owner,resource.id)).data.results,[])
})

test('importing the second article of one author adds only that article to the selected concept',async t=>{
 const store=await setup(t),a=source('111','同一位作者'),b={...source('222','同一位作者'),authorId:a.authorId,title:'第二篇资料'}
 let checked=[]
 const tools={async learning(_ctx,_name,input){checked=input.candidates.map(e=>e.evidenceId);return {evidenceIds:checked}}}
 const worker=new DurableWorker(store,createFlows(tools),1,()=>{}),app=await createProductApp({store,worker,identity:{production:false},providersReady:true});t.after(()=>app.close())
 const session=await app.inject({method:'POST',url:'/api/auth/guest'}),headers={cookie:String(session.headers['set-cookie']).split(';')[0]},owner=(await store.db.query('SELECT owner_id FROM tp_sessions'))[0].owner_id
 const origin=await store.create(owner,'learning','article-origin',state([a,b])),target=await store.create(owner,'learning','article-destination',{...state([]),title:'矩阵的坐标表示'})
 const post=payload=>app.inject({method:'POST',url:`/api/v2/learning/${target.id}/import-author-source`,headers,payload})
 assert.equal((await post({authorId:a.authorId})).statusCode,400,'an author alone cannot select an article')
 const accepted=await post({authorId:a.authorId,evidenceId:b.evidenceId});assert.equal(accepted.statusCode,200)
 for(let i=0;i<200;i++){if((await store.snapshot(owner,target.id)).job?.status==='completed')break;await new Promise(r=>setTimeout(r,10))}
 const imported=(await store.snapshot(owner,target.id)).data
 assert.deepEqual(checked,[b.evidenceId]);assert.deepEqual(imported.articles.map(a=>a.id),[b.evidenceId]);assert.equal(imported.importResult.status,'added')
 assert.deepEqual(imported.nodes.find(n=>n.id===b.evidenceId).parents,['root'])
 assert.equal((await store.resource(owner,origin.id)).body.articles.length,2)
 const network=await readAuthorNetwork(store.db,owner)
 assert.equal(network.authors.length,1);assert.equal(network.authors[0].evidence.length,2)
 assert.equal(network.authors[0].evidence.find(e=>e.evidenceId===a.evidenceId).uses.some(u=>u.resourceId===target.id),false)
 assert.equal(network.authors[0].evidence.find(e=>e.evidenceId===b.evidenceId).uses.some(u=>u.resourceId===target.id),true)
})

test('identity lookup ignores tracking parameters but keeps semantic URL parameters and fragments',()=>{
 const original={...source('verified'),url:'https://www.zhihu.com/question?id=1'}
 const network={version:3,authors:[{id:'platform-one',name:'同名',identity:'platform',evidence:[original],topics:[]}]}
 const uncertain={...source('search'),authorId:'author-ev-search',url:'https://www.zhihu.com/question?id=2'}
 assert.equal(knownSourceIdentity(uncertain,network).authorId,'author-ev-search')
 assert.equal(knownSourceIdentity({...uncertain,url:original.url+'&utm_source=api'},network).authorId,'platform-one')
 assert.equal(knownSourceIdentity({...uncertain,url:original.url+'#/other'},network).authorId,'author-ev-search')
})

test('source footprints expose real card kinds and distinguish automatic entry text from the same later question',async t=>{
 const store=await setup(t),s=state([source('a')])
 for(const id of ['first','later'])s.nodes.push({id,type:'answer',title:'同名讲解',text:'说明',parents:['a'],sources:['a'],basisId:'a'})
 const paragraph=id=>({id,title:'同名讲解',text:'说明',parents:['a'],sources:['a'],basisId:'a'})
 s.conversations[0].messages=[{id:'concept-question',role:'user',text:s.title},{id:'first-reply',role:'assistant',paragraphs:[paragraph('first')]},{id:'question-later',role:'user',text:s.title},{id:'later-reply',role:'assistant',paragraphs:[paragraph('later')]}]
 await store.create('owner','learning','footprints',s)
 const e=(await readAuthorNetwork(store.db,'owner')).authors[0].evidence[0]
 assert.deepEqual(e.uses.find(u=>u.origin==='learning').nodeKinds,{a:'article',first:'answer',later:'answer'})
 const questions=e.uses.filter(u=>u.origin==='conversation')
 assert.equal(questions.length,2);assert.equal(questions[0].questionKind,'initial');assert.equal(questions[1].questionKind,'follow_up')
 assert.notEqual(questions[0].key,questions[1].key)
 const {sourceFootprints}=await import('../../src/learning-v2/source-footprints.ts')
 const grouped=sourceFootprints(e);assert.equal(grouped.length,1);assert.equal(grouped[0].cards.length,3);assert.equal(grouped[0].questions.length,1);assert.deepEqual(grouped[0].questions[0].nodeIds,['later'])
})
