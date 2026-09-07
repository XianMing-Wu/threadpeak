// Browser regression server: explicit test providers and disposable in-memory storage.
import {openDatabase,migrate} from '../server/durable/database.ts'
import {DurableStore} from '../server/durable/store.ts'
import {DurableWorker} from '../server/durable/worker.ts'
import {ProductTools} from '../server/durable/tools.ts'
import {createFlows} from '../server/durable/flows.ts'
import {createProductApp} from '../server/durable/http.ts'
import {plan,interview,exploration} from '../tests/fixtures/goal-agents.mjs'
const llm={complete:async args=>{const c=JSON.parse(args.messages[1].content);let value
 if(c.newerRoundPreferred){value=plan();Object.assign(value.learningGoal,{motivation:'',startingPoint:'',constraints:[],nonGoals:[],assumptions:[]});value.stages[0][0].concepts[0].attachmentRefs=[];value.stages[0][0].concepts[0].goalAlignment.materialAnchors=[]}
 else if(c.exploration){value=interview();value.questions.push({...interview().questions[0],id:'q2',options:interview().questions[0].options.map(o=>({...o,id:o.id+'2'})),prompt:'开始之前，有什么情况希望我特别照顾到？'})}
 else if(c.searchGroups){value=exploration();value.candidates[0].materialRefs=[]}
 else value={queries:[0,1,2,3].map(i=>({id:String(i),text:`坐标学习${i}`,angle:i<2?'normal_learning':'pitfall_or_dispute'}))}
 return {kind:'completed',text:JSON.stringify(value)}
}}
const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,createFlows(new ProductTools(llm,{search:async()=>({kind:'empty'})})),1)
const app=await createProductApp({store,worker,identity:{production:false},providersReady:true});app.get('/qa-reset',async(_r,reply)=>reply.header('Set-Cookie','tp_workspace=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0').redirect('http://localhost:4404/#home'));app.addHook('onClose',async()=>{await worker.stop();await db.close()});await app.listen({port:4412,host:'127.0.0.1'});worker.start()
process.stdout.write('QA only: http://localhost:4404 → isolated test providers\n');process.once('SIGTERM',()=>void app.close());process.once('SIGINT',()=>void app.close())
