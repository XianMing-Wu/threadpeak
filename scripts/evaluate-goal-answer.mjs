// Re-evaluate only L-answer against recorded real search/direct outputs. No synthetic provider.
import {readFile,writeFile} from 'node:fs/promises'
import {serverEnvironment,http} from '../server/durable/bootstrap.ts'
import {resolveProviderConfig} from '../server/config.ts'
import {createAgentLlmProvider} from '../server/agent-runtime/llm-provider.ts'
import {openDatabase,migrate} from '../server/durable/database.ts'
import {DurableStore} from '../server/durable/store.ts'
import {TaskContext} from '../server/durable/worker.ts'
import {ProductTools} from '../server/durable/tools.ts'
import {replyInput} from '../server/durable/flows.ts'
const config=resolveProviderConfig(serverEnvironment());if(!config.ok)throw Error('PROVIDER_REQUIRED')
const raw=createAgentLlmProvider({config:config.config,http})
for(const name of process.argv.slice(2)){
 const file=`qa/goal-agents-2026-09-07/raw/${name}.json`,sample=JSON.parse(await readFile(file,'utf8')),state=sample.learning
 if(!state?.initialized)throw Error('COMPLETED_REAL_LEARNING_REQUIRED')
 const last=sample.checkpoints.filter(j=>j.kind==='learning.enter').at(-1)
 const directAnswers=Object.entries(last.checkpoints).filter(([k])=>k.startsWith('L-direct:')&&k.includes('@')).map(([k,v])=>({angle:k.split(':')[1].split('@')[0],content:v.value}))
 if(directAnswers.length!==3)throw Error('THREE_RECORDED_DIRECT_ANSWERS_REQUIRED')
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),resource=await store.create('evaluation','learning','answer',{})
 await store.enqueue('evaluation',resource.id,'learning.enter','answer-only',{depth:'fast'})
 const ctx=new TaskContext(store,await store.claim(180000),new AbortController().signal),calls=[]
 const heartbeat=setInterval(()=>void store.renew(ctx.job,180000),10000)
 const tools=new ProductTools({complete:async input=>{const out=await raw.complete(input);calls.push({input:input.messages,kind:out.kind,output:out.kind==='completed'?out.text:undefined});return out}},{})
 const {cards,...input}=replyInput({...state,conversations:state.conversations.map(c=>({...c,messages:[]}))},state.title,[],state.active)
 try{const output=await tools.answerCards(ctx,{...input,directAnswers});sample.focusedAnswer={realProvider:true,reusedRealSources:true,calls,paragraphs:output.paragraphs};process.stdout.write(`${name}: L-answer ${output.paragraphs.length} 段\n`)}catch(error){sample.focusedAnswer={calls,error:error.code??error.message};process.stdout.write(`${name}: ${sample.focusedAnswer.error}\n`)}
 clearInterval(heartbeat);await writeFile(file,JSON.stringify(sample,null,2)+'\n');await db.close()
}
