// Real-provider qualitative samples using explicitly synthetic user/material inputs.
// Isolated in-memory database: never opens or writes the user's product workspace.
import {writeFile,mkdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {serverEnvironment,http} from '../server/durable/bootstrap.ts'
import {resolveProviderConfig} from '../server/config.ts'
import {createAgentLlmProvider} from '../server/agent-runtime/llm-provider.ts'
import {createAgentZhihuProvider} from '../server/agent-runtime/zhihu-provider.ts'
import {openDatabase,migrate} from '../server/durable/database.ts'
import {DurableStore} from '../server/durable/store.ts'
import {TaskContext} from '../server/durable/worker.ts'
import {ProductTools} from '../server/durable/tools.ts'
import {createFlows,selectPathCustomAnswer} from '../server/durable/flows.ts'
import {pathGoalContext} from '../server/durable/learning-goal.ts'
import {withPermit,pause} from '../server/durable/limits.ts'
import {inheritedArticles} from '../server/durable/materials.ts'

const scenarios=[
 {id:'paper-math',goal:'我上传了一段论文，想学懂其中的数学理论，但不知道从哪开始。',answer:'我会矩阵乘法和一元求导。我希望能自己解释每个公式为何成立，不需要复现代码，也不为求职；最后能向同学推一遍注意力公式就够了。',content:'测试论文摘录（合成材料，非真实论文）：设输入 X 的每一行是一个词向量，Q=XW_Q，K=XW_K，V=XW_V。注意力为 Attention(Q,K,V)=softmax(QK^T/sqrt(d_k))V，其中 softmax 按行归一化。需要理解矩阵形状、内积相似度、缩放以及归一化后权重的加权求和。本文不涉及优化器和训练过程。',learning:true},
 {id:'collection',goal:'我想系统学我第一个知乎收藏夹里的内容，但不知道顺序。',answer:'我只会基础四则运算，想把收藏中的矩阵知识串起来，能解释每篇之间的关系并做一个二维变换例子；不需要考试技巧，先只学这个收藏夹。',scope:{kind:'collections',folderIds:['synthetic-folder']},content:'测试收藏摘要（合成数据）：文章一：二维向量可看作带方向的位移，坐标依赖选定的基。文章二：矩阵作用在向量上表示线性变换，矩阵各列是基向量变换后的结果。文章三：两个变换连续执行对应矩阵相乘，顺序一般不能交换。文章四重复了文章二的矩阵与线性变换内容。'},
 {id:'finance',goal:'我想系统学习理财，但网上教法各不相同，我不知道怎么学。',answer:'我是零基础，先学会管理家庭现金流、判断风险和读懂常见金融产品；不是为了短期炒股，也不要荐股。希望最后能写一份自己的收支预算和风险检查清单。'},
 {id:'minimal-3d',goal:'我想在电脑上画一个可以用鼠标旋转的3D图像，只学完成这件事需要的最小路线。',answer:'我会一点 HTML 和 JavaScript，想在浏览器里画一个彩色立方体，鼠标拖动可以旋转视角就够了。可以使用现成库，不想先学完整线性代数、着色器或引擎开发。',learning:true},
 {id:'llm-job',goal:'我想找到大模型相关的工作，但不知道应该一步步学什么。',answer:'我有两年 Python 后端经验，目标是大模型应用开发岗位，偏 RAG 和 Agent 应用；不是研究算法或训练基础模型。想做一个能展示检索评测、工具调用和上线维护能力的求职作品，没有给自己限定时间。'},
]
const args=process.argv.slice(2),chosen=args.length?scenarios.filter(s=>args.includes(s.id)):scenarios
const env=serverEnvironment(),config=resolveProviderConfig(env)
if(!config.ok)throw new Error('真实 provider 未配置')
const rawLlm=createAgentLlmProvider({config:config.config,http}),rawZhihu=createAgentZhihuProvider({config:config.config,http,clock:{now:()=>new Date(),unixSeconds:()=>Math.floor(Date.now()/1000)}})
const permitDb=await openDatabase();await migrate(permitDb)
const zhihu={search:(q,n,signal)=>withPermit(permitDb,'zhihu',3,signal,next=>rawZhihu.search(q,n,next)),direct:input=>withPermit(permitDb,'direct',2,input.signal,next=>withPermit(permitDb,'zhihu',3,next,signal=>rawZhihu.direct({...input,signal})))}
const directory=resolve('qa/evidence/goal-agents/raw');await mkdir(directory,{recursive:true})
async function run(scenario){
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db)
 const calls=[]
 const llm={complete:async input=>{const time=Date.now();const r=await withPermit(permitDb,'llm',4,input.signal,signal=>rawLlm.complete({...input,signal}));calls.push({channel:'llm',input:input.messages.map(m=>({role:m.role,content:m.content})),output:r.kind==='completed'?r.text:undefined,milliseconds:Date.now()-time,json:input.json,kind:r.kind,...(r.kind==='failed'?{code:r.code}:{})});return r}}
 const tools=new ProductTools(llm,zhihu,Number(env.DEEPSEEK_CONTEXT_TOKENS??64000)),handler=createFlows(tools)
 const attachments=scenario.content?[{sourceId:'synthetic-material',ref:'F1',fileName:'合成测试材料.md',mimeType:'text/markdown',origin:'upload',content:scenario.content}]:[]
 const prior=args.includes('--learning-only')?JSON.parse(await readFile(resolve(directory,scenario.id+'.json'),'utf8')):undefined
 if(prior)calls.push(...prior.calls)
 const path=await store.create('evaluation','path',scenario.id,prior?.path??{goal:scenario.goal,depth:'fast',attachments,searchScope:scenario.scope??{kind:'zhihu'},status:'running',questionSets:[],conversation:[{messageId:'goal',role:'user',kind:'text',content:scenario.goal}]})
 let count=0,result
 async function job(resource,kind,input={},update){
   await store.enqueue('evaluation',resource,kind,`${scenario.id}-${++count}`,{depth:'fast',...input},update)
   for(let attempt=0;attempt<4;attempt++){
     const claimed=await store.claim(120000),ctx=new TaskContext(store,claimed,new AbortController().signal)
     const heartbeat=setInterval(()=>void store.renew(claimed,120000),10000)
     try{await handler(ctx);break}catch(error){
       if(!error.retryable||attempt===3)throw error
       await store.recover(claimed,error.code,false);await pause(Math.min(30000,3000*2**attempt));await store.resume('evaluation',resource)
       process.stdout.write(`${scenario.id}: 恢复临时故障 ${error.code}\n`)
     }finally{clearInterval(heartbeat)}
   }
   return (await store.resource('evaluation',resource)).body
 }
 try{
   process.stdout.write(`${scenario.id}: R1 → 搜索 → R2 → R3\n`)
   let state=prior?.path??await job(path.id,'path.start')
   for(const question of prior?[]:state.questionSets.at(-1).questions){state=await job(path.id,'path.answer',{questionId:question.id,customAnswer:scenario.answer},r=>selectPathCustomAnswer(r,question.id,scenario.answer))}
   result={scenario,provider:config.config.deepseekModelName,syntheticInput:true,realProviders:true,path:state,calls}
   process.stdout.write(`${scenario.id}: 路线已生成，${state.route.concepts.length} 个概念\n`)
   if(scenario.learning&&!args.includes('--route-only')){
     const concept=state.route.concepts[0],articles=inheritedArticles(attachments),conversationId='learning-first'
     const learning=await store.create('evaluation','learning',`${path.id}:${concept.id}`,{version:2,searchScope:state.searchScope,goalContext:pathGoalContext(state,concept.id),routeId:state.document.id,conceptId:concept.id,title:concept.title,description:concept.detailedDescription,hasDispute:concept.hasDispute,articles,nodes:[],initialized:false,phase:'searching',active:conversationId,conversations:[{id:conversationId,title:concept.title,date:new Date().toISOString(),messages:[]}]})
     result.learning=await job(learning.id,'learning.enter',{conversationId})
     process.stdout.write(`${scenario.id}: 首次学习完成\n`)
   }
   result.status='completed'
 }catch(error){result={...result,scenario,status:'failed',error:error.code??error.message,calls,path:(await store.resource('evaluation',path.id)).body};process.stdout.write(`${scenario.id}: ${result.error}\n`)}
 result.checkpoints=[...(prior?.checkpoints??[]),...await store.db.query('SELECT kind,checkpoints FROM tp_jobs WHERE owner_id=$1',['evaluation'])]
 await writeFile(resolve(directory,scenario.id+'.json'),JSON.stringify(result,null,2)+'\n');await db.close()
}
// Sequential samples share the same provider permit limits as the application.
try{for(const scenario of chosen)await run(scenario)}finally{await permitDb.close()}
