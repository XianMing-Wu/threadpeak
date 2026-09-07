import test from 'node:test'
import assert from 'node:assert/strict'
import {openDatabase,migrate} from './database.ts'
import {digest,DurableStore} from './store.ts'
import {DurableWorker} from './worker.ts'
import {createProductApp} from './http.ts'
import {ProductTools} from './tools.ts'
import {createFlows} from './flows.ts'
import {matchingSource} from './source-presentation.ts'
const url='https://zhuanlan.zhihu.com/p/123?utm_source=old'
const excerpt='矩阵乘法：设 ，，则。满足结合律： 满足分配律：，重要注意：'
const s={version:2,routeId:'route',conceptId:'concept',title:'矩阵',articles:[{id:'article',title:'矩阵运算',summary:excerpt,author:'作者',authorId:'author',likes:null,url,topic:'矩阵'}],nodes:[{id:'root',type:'root',title:'矩阵',text:'',parents:[],sources:[]},{id:'article',type:'article',title:'矩阵运算',text:excerpt,parents:['root'],sources:['article']}],conversations:[],active:'',initialized:true,phase:'ready'}
test('source refresh matches the exact content URL, never a same-title or same-name author',()=>{
 assert.equal(matchingSource(url,[{url:'https://zhuanlan.zhihu.com/p/999',authorName:'作者',title:'矩阵运算'}]),undefined)
 assert.equal(matchingSource(url,[{url:'https://zhuanlan.zhihu.com/p/123?utm_source=new',avatar:'verified'}]).avatar,'verified')
})
test('old source enrichment is owner scoped, persistent and idempotent; AI reading never overwrites original evidence',async t=>{
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db)
 let searches=0,models=0
 const tools=new ProductTools({async complete(){models++;return {kind:'completed',text:JSON.stringify({content:'### 矩阵的乘法\n\n'+('对于矩阵，乘积是否存在首先取决于维数是否匹配。这是根据摘要主题整理的独立说明。').repeat(2)+'\n\n$AB \\ne BA$，其中 $A=\\begin{pmatrix}1&0\\\\0&0\\end{pmatrix}$。'})}}},{async search(){searches++;return {kind:'hits',items:[{evidenceId:'live',url:'https://zhuanlan.zhihu.com/p/123?utm_source=new',title:'矩阵运算',summary:excerpt,avatar:'https://pic1.zhimg.com/real.jpg',authorId:'upstream',authorName:'作者'}]}},async direct(){throw Error('not used')}})
 const worker=new DurableWorker(store,createFlows(tools),1,()=>{}),app=await createProductApp({store,worker,identity:{production:false},providersReady:true})
 t.after(async()=>{await app.close();await db.close()})
 const session=await app.inject({method:'GET',url:'/api/v2/session'}),cookie=session.headers['set-cookie'].split(';')[0]
 const [owned]=await db.query('SELECT owner_id FROM tp_sessions LIMIT 1')
 const learning=await store.create(owned.owner_id,'learning','existing',s)
 const request=()=>app.inject({method:'POST',url:'/api/v2/sources/presentation',headers:{cookie},payload:{url}})
 const metadata=await app.inject({method:'POST',url:'/api/v2/sources/presentation',headers:{cookie},payload:{url,includeReading:false}})
 assert.equal(metadata.statusCode,200)
 for(let i=0;i<200;i++){if((await store.snapshot(owned.owner_id,metadata.json().id)).job?.status==='completed')break;await new Promise(r=>setTimeout(r,10))}
 const metadataData=(await store.snapshot(owned.owner_id,metadata.json().id)).data
 assert.equal(metadataData.metadata.avatar,'https://pic1.zhimg.com/real.jpg');assert.equal(metadataData.reading,undefined);assert.equal(models,0)
 const oldScope=digest({url:'https://zhuanlan.zhihu.com/p/123',summary:excerpt,version:2,includeReading:true})
 const old=await store.create(owned.owner_id,'source-presentation',oldScope,{status:'ready',metadata:{},source:{url,summary:excerpt}})
 const first=await request();assert.equal(first.statusCode,200);const id=first.json().id;assert.notEqual(id,old.id,'a completed presentation from an older reading policy must not hide new missing-source detection')
 for(let i=0;i<200;i++){if((await store.snapshot(owned.owner_id,id)).job?.status==='completed')break;await new Promise(r=>setTimeout(r,10))}
 assert.notEqual(id,metadata.json().id,'a cached avatar result cannot masquerade as a completed formula reading')
 const data=(await store.snapshot(owned.owner_id,id)).data
 assert.equal(data.status,'ready');assert.equal(data.metadata.avatar,'https://pic1.zhimg.com/real.jpg');assert.equal(data.reading.kind,'ai-formula')
 assert.equal((await store.resource(owned.owner_id,learning.id)).body.articles[0].summary,excerpt)
 assert.equal((await store.resource(owned.owner_id,learning.id)).body.nodes[1].text,excerpt)
 assert.equal((await request()).json().id,id);assert.equal(searches,2);assert.equal(models,1)
 const anonymous=await app.inject({method:'POST',url:'/api/v2/sources/presentation',payload:{url}});assert.equal(anonymous.statusCode,401)
 const second=await app.inject({method:'GET',url:'/api/v2/session'}),otherCookie=second.headers['set-cookie'].split(';')[0]
 const other=await app.inject({method:'POST',url:'/api/v2/sources/presentation',headers:{cookie:otherCookie},payload:{url}});assert.equal(other.statusCode,404)
 assert.equal((await db.query('SELECT * FROM tp_author_usage')).length,0)
})
