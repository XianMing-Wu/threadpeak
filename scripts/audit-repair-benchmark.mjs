// Synthetic, repeatable local measurements. Requires the dedicated disposable test DB.
import {performance} from 'node:perf_hooks'
import {writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {openDatabase,migrate} from '../server/durable/database.ts'
import {DurableStore} from '../server/durable/store.ts'
import {readLibraryPage} from '../server/durable/library.ts'
import {layoutTree,documentOrder} from '../src/learning-v2/tree.ts'
import {validateTree} from '@threadpeak/contracts/learning-v2'
import {nodeFieldPatch} from '@threadpeak/contracts/node-edits'
import {sourceLookup} from '../server/durable/authors-network.ts'
const url=process.env.TEST_DATABASE_URL
if(!url||new URL(url).pathname!=='/threadpeak_test')throw Error('Isolated threadpeak_test database required')
const db=await openDatabase({url}),result={date:new Date().toISOString(),node:process.version,synthetic:true,tree:[],database:{}}
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]
const measure=async work=>{const times=[];let last;for(let i=0;i<9;i++){const start=performance.now();last=await work();times.push(performance.now()-start)}return {samples:times.length,p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),bytes:Buffer.byteLength(JSON.stringify(last))}}
try{
 await migrate(db)
 for(const count of [1000,3000,6000,20000]){
  const nodes=Array.from({length:count},(_,i)=>({id:i?`n${i}`:'root',type:i===0?'root':i===1?'article':'answer',title:`节点 ${i}`,text:'用于规模测量的合成卡片',parents:i?[i===1?'root':`n${i-1}`]:[],sources:i?['n1']:[]}))
  const times=[]
  for(let i=0;i<5;i++){const start=performance.now();validateTree(nodes);const layout=layoutTree(nodes);documentOrder(nodes);if(Object.keys(layout).length!==count)throw Error('missing node');times.push(performance.now()-start)}
  const edited=nodes.map((n,i)=>i===count-1?{...n,text:'编辑后'}:n),patch=nodeFieldPatch(nodes,edited)
  const state={nodes,articles:[{id:'n1',title:'原文',summary:'原始总结',url:'https://www.zhihu.com/question/1/answer/2',author:'作者',authorId:'author'}],conversations:[]},start=performance.now(),lookup=sourceLookup(state)
  for(const node of nodes)lookup(node.id)
  result.tree.push({count,samples:5,validateLayoutDocumentP50Ms:percentile(times,.5),validateLayoutDocumentP95Ms:percentile(times,.95),authorLookupMs:performance.now()-start,fullEditBytes:Buffer.byteLength(JSON.stringify({baseNodes:nodes,nodes:edited})),patchBytes:Buffer.byteLength(JSON.stringify({patch}))})
 }
 const owner='benchmark:'+randomUUID(),store=new DurableStore(db),long=''.padEnd(30000,'公开测试材料 ')
 await db.query("INSERT INTO tp_resources(id,owner_id,kind,scope,body,created_at,updated_at) SELECT $1||g,$1,'chat',g::text,jsonb_build_object('title','Chat '||g,'messages',jsonb_build_array(jsonb_build_object('text',$2::text))),$3,$3 FROM generate_series(1,300) g",[owner,long,Date.now()])
 await db.query('ANALYZE tp_resources')
 result.database.oldFullRead=await measure(()=>store.list(owner,'chat'))
 result.database.projectedAllPages=await measure(async()=>{const pages=[];let cursor;do{const page=await readLibraryPage(db,owner,cursor);pages.push(page);cursor=page.nextCursor}while(cursor);return pages})
 result.database.pagePlan=await db.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,body->>'title' FROM tp_resources WHERE owner_id=$1 AND kind IN ('path','chat','learning') ORDER BY updated_at DESC,id DESC LIMIT 100",[owner])
 // Global TTL select uses the same time predicate/order as maintenance.
 await db.query("INSERT INTO tp_provider_calls(id,owner_id,job_id,step,provider,body,created_at) SELECT $1||g,'bench-owner-'||(g%100),'bench-job','bench','bench','{}'::jsonb,$2::bigint+g FROM generate_series(1,20000) g",[owner,Date.now()-86400000])
 await db.query('ANALYZE tp_provider_calls')
 result.database.callTimePlan=await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM tp_provider_calls WHERE created_at<$1 ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED',[Date.now()])
 result.database.scope={chatResources:300,charactersPerChat:long.length,callRecords:20000,productionLoad:false}
 await writeFile('qa/evidence/project-audit-fixes-2026-09-08/benchmarks.json',JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({tree:result.tree,database:{oldFullRead:result.database.oldFullRead,projectedAllPages:result.database.projectedAllPages}},null,2))
}finally{await db.close()}
