// Audit probes: these assertions confirm defects on the recorded revision.
// They are not acceptance tests for desired behavior. No live provider or user DB is used.
import assert from 'node:assert/strict'
import {openDatabase, migrate} from '../../../server/durable/database.ts'
import {DurableStore} from '../../../server/durable/store.ts'
import {TaskContext} from '../../../server/durable/worker.ts'
import {ProductTools} from '../../../server/durable/tools.ts'
import {createFlows,replyInput} from '../../../server/durable/flows.ts'
import {createAgentLlmProvider} from '../../../server/agent-runtime/llm-provider.ts'
import {validateTree} from '../../../packages/contracts/src/learning-v2.ts'
import {layoutTree} from '../../../src/learning-v2/tree.ts'

const db = await openDatabase()
await migrate(db)
const store = new DurableStore(db)
const observations = []
async function context(kind, body, key, input = {}) {
  const resource = await store.create('audit-owner', kind === 'path.answer' ? 'path' : kind.startsWith('learning.') ? 'learning' : 'probe', key, body)
  await store.enqueue('audit-owner', resource.id, kind, key, {depth:'fast',...input})
  return new TaskContext(store, await store.claim(), new AbortController().signal)
}
try {
  for (const output of ['{}', 'this is not JSON']) {
    let calls = 0
    const tools = new ProductTools({complete:async () => {calls++; return {kind:'completed',text:output}}}, {})
    const ctx = await context('path.answer', {
      goal:'学习矩阵变换', attachments:[{sourceId:'audit-material',fileName:'notes.txt',content:'这是与矩阵无关的园艺资料。植物需要水分与阳光。'}],
      depth:'fast', status:'awaiting_answers', conversation:[],
      exploration:{candidates:[{carrier:'线性代数',concept:'矩阵变换',purpose:'理解向量变换',necessity:'direct'}]},
      questionSets:[{round:1,status:'active',questions:[{id:'q',prompt:'希望做到什么',options:[{id:'o',label:'解释旋转矩阵',routeEffect:'解释矩阵'}]}],selectedOptionIds:{q:'o'}}],
    }, `route-${output}`)
    await createFlows(tools)(ctx)
    const snapshot = await store.snapshot(ctx.job.owner_id, ctx.job.resource_id)
    assert.equal(snapshot.data.status, 'published')
    assert.equal(snapshot.job.status, 'completed')
    observations.push({probe:'invalid_R4_published',output,calls,status:snapshot.data.status,jobStatus:snapshot.job.status,anchor:snapshot.data.route.concepts[0].goalAlignment.materialAnchors[0]})
  }
  const config = {deepseekBaseUrl:'https://example.invalid/v1',deepseekModelName:'audit-model',deepseekApiKey:'audit-only'}
  const output = {selections:[],normalizedQuestion:'未经正式输出确认的选择'}
  const provider = createAgentLlmProvider({config,http:async () => ({ok:true,status:200,text:async () => JSON.stringify({choices:[{finish_reason:'stop',message:{content:'',reasoning_content:JSON.stringify(output)}}]})})})
  const result = await provider.complete({messages:[],thinkingDepth:'deep',json:true})
  assert.equal(result.kind,'completed')
  observations.push({probe:'reasoning_only_json_accepted',kind:result.kind,body:JSON.parse(result.text)})

  const search = new ProductTools({}, {
    search:async () => ({kind:'empty'}),
    globalSearch:async () => ({kind:'hits',items:['alpha','beta'].map((id) => ({evidenceId:id,title:id,summary:`Document ${id}`,url:`https://example.invalid/read?id=${id}`,authorId:null,authorName:null}))}),
  })
  const ctx = await context('probe',{},'search')
  const hits = await search.search(ctx,'web-probe','query',{kind:'web'})
  assert.equal(hits.length,1)
  observations.push({probe:'query_parameter_identity_lost',inputCount:2,outputCount:hits.length,keptUrl:hits[0].url})

  const state = {version:2,routeId:'route',conceptId:'concept',title:'概念',description:'范围',hasDispute:false,initialized:true,phase:'ready',
    active:'conversation',conversations:[{id:'conversation',title:'会话',date:'2026-09-08',messages:[]}],
    articles:[{id:'article',title:'材料',summary:'来源内容',author:'来源',authorId:null,likes:null,topic:'概念',sourceKind:'upload'}],
    nodes:[{id:'root',type:'root',title:'概念',text:'',parents:[],sources:[]},{id:'article',type:'article',title:'材料',text:'来源内容',parents:['root'],sources:['article']}],
  }
  const lengths = []
  const authorTools = new ProductTools({complete:async () => ({kind:'completed',text:JSON.stringify({queries:['甲'.repeat(20),'乙'.repeat(150),'丙'.repeat(150)]})})}, {
    search:async q => {lengths.push(q.length);return {kind:'empty'}},direct:async () => ({kind:'completed',text:'离线边界替身正文'}),
  })
  const authorContext = await context('learning.author',state,'author-query',{conversationId:'conversation',context:replyInput(state,'解释这个问题',['article'],'conversation'),excludedAuthorIds:[]})
  await createFlows(authorTools)(authorContext)
  assert.deepEqual(lengths,[20,301])
  observations.push({probe:'author_packing_differs_from_validation',individualLengths:[20,150,150],actualSearchLengths:lengths,contractMax:200})

  const node = (i, parent) => ({id:i === 0 ? 'root' : `n${i}`,type:i === 0 ? 'root' : 'custom',title:'card',text:'',parents:parent ? [parent] : [],sources:[]})
  for (const size of [1000,3000,6000]) {
    const nodes = Array.from({length:size},(_,i) => node(i,i ? i === 1 ? 'root' : `n${i-1}` : null))
    validateTree(nodes)
    const start = performance.now()
    try {layoutTree(nodes,[],[]); observations.push({probe:'deep_tree_layout',nodes:size,durationMs:Math.round(performance.now()-start),ok:true})}
    catch (error) {observations.push({probe:'deep_tree_layout',nodes:size,durationMs:Math.round(performance.now()-start),ok:false,error:error.name,message:error.message})}
  }
  console.log(JSON.stringify({timestamp:new Date().toISOString(),runtime:process.version,observations},null,2))
} finally {await db.close()}
