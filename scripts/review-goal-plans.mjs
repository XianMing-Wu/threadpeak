// Re-run only the strict R4 step on saved, synthetic evaluation context.
// Never mutates the archived sample or uses the user's database.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {serverEnvironment,http} from '../server/durable/bootstrap.ts'
import {resolveProviderConfig} from '../server/config.ts'
import {resolveCapabilities} from '../server/durable/capabilities.ts'
import {createAgentLlmProvider} from '../server/agent-runtime/llm-provider.ts'
import {ProductTools} from '../server/durable/tools.ts'
import {TaskContext} from '../server/durable/worker.ts'
import {DurableStore,digest} from '../server/durable/store.ts'
import {openDatabase,migrate} from '../server/durable/database.ts'
import {STAGED_PLAN_PROMPT} from '../server/path-generation/staged-plan.ts'
const [sourceArg,outArg]=process.argv.slice(2)
if(!sourceArg||!outArg)throw Error('Usage: node scripts/review-goal-plans.mjs source-directory output-directory')
const source=resolve(sourceArg),out=resolve(outArg);if(source===out)throw Error('Keep original evaluation evidence')
const env=serverEnvironment(),config=resolveProviderConfig(env),capabilities=resolveCapabilities(env)
if(!config.ok)throw Error('Provider not configured')
await mkdir(out,{recursive:true});const provider=createAgentLlmProvider({config:config.config,http})
for(const file of (await readdir(source)).filter(f=>f.endsWith('.json'))){
 const prior=JSON.parse(await readFile(resolve(source,file),'utf8'))
 if(!prior.scenario||prior.scenario.content&&!prior.scenario.content.includes('合成'))throw Error('Synthetic evaluation input required')
 const call=prior.calls.find(c=>c.json&&c.input[0]?.content.includes('通向真实目标的最小充分学习路线'))
 if(!call)continue
 const input=JSON.parse(call.input[1].content),db=await openDatabase();await migrate(db);const store=new DurableStore(db),calls=[]
 const tools=new ProductTools({complete:async request=>{const start=Date.now(),result=await provider.complete(request);calls.push({messages:request.messages,result,durationMs:Date.now()-start});return result}}, {},capabilities)
 const resource=await store.create('synthetic-review','test',file,{});await store.enqueue('synthetic-review',resource.id,'test',file,{depth:'fast'});const job=await store.claim(300000),ctx=new TaskContext(store,job,new AbortController().signal)
 let result;try{const route=await tools.routePlan(ctx,input,'review:'+file,input.attachments.map(a=>a.sourceId));result={status:'completed',route}}catch(error){result={status:'failed',code:error.code??error.message}}
 await writeFile(resolve(out,file),JSON.stringify({...result,syntheticInput:true,realLlm:true,reusedSearchEvidence:true,date:new Date().toISOString(),promptHash:digest(STAGED_PLAN_PROMPT),model:config.config.deepseekModelName,capabilities,calls},null,2)+'\n')
 console.log(file+': '+result.status);await db.close()
}
