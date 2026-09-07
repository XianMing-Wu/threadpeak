import { ZhihuDataClient } from './zhihu-data.ts'
import { ZhihuLogin,loginConfig } from './zhihu-oauth.ts'
import { readOrCreateMockSecret, MOCK_ZHIHU_OWNER_PREFIX } from './zhihu-oauth-mock.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveProviderConfig } from '../config.ts'
import { createAgentLlmProvider } from '../agent-runtime/llm-provider.ts'
import { createAgentZhihuProvider } from '../agent-runtime/zhihu-provider.ts'
import type { HttpPort } from '../ports.ts'
import type { LlmProvider } from '../agent-runtime/types.ts'
import { openDatabase,migrate,type Sql } from './database.ts'
import { DurableStore } from './store.ts'
import { DurableWorker, ToolError,type TaskHandler } from './worker.ts'
import { importZhihuMaterial } from './materials-http.ts'
import { ProductTools } from './tools.ts'
import { createFlows } from './flows.ts'
import { createProductApp } from './http.ts'
import { withPermit } from './limits.ts'
import { createZhihuGate,limitZhihuProvider,type ZhihuGate } from './zhihu-gate.ts'

export function serverEnvironment():NodeJS.ProcessEnv{
  const env={...process.env}
  try{for(const line of readFileSync(resolve('.env'),'utf8').split(/\r?\n/)){
    const match=/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if(match && !env[match[1]!])env[match[1]!]=match[2]!.replace(/^(['"])(.*)\1$/,'$2')
  }}catch{ /* readiness handles absent provider configuration */ }
  return env
}
export const http:HttpPort=async(url,init)=>{
  const timeout=AbortSignal.timeout(init?.timeoutMs??90_000),signal=init?.signal?AbortSignal.any([timeout,init.signal]):timeout
  const response=await fetch(url,{method:init?.method??'GET',headers:init?.headers,body:init?.body,signal,redirect:'error'})
  return {ok:response.ok,status:response.status,headers:response.headers,body:response.body,text:()=>response.text()}
}
export function createZhihuUserServices(db:Sql,env:Record<string,string|undefined>,gate:ZhihuGate=createZhihuGate(db)){
  let oauth=loginConfig(env)
  if(oauth?.mode==='mock'&&!env.THREADPEAK_TOKEN_SECRET?.trim())oauth={...oauth,tokenSecret:readOrCreateMockSecret(env.THREADPEAK_DATA_DIR??resolve('server/.data/product-v2'))}
  const zhihuLogin=oauth?new ZhihuLogin(db,oauth,fetch,gate):undefined
  // Only the user API sub-adapter is mocked. PDF/data requests still need the real Access Secret.
  const zhihuData=env.ZHIHU_ACCESS_SECRET||zhihuLogin?.mock?new ZhihuDataClient(env.ZHIHU_ACCESS_SECRET??'',fetch,'https://developer.zhihu.com',zhihuLogin?.mock,gate):undefined
  return {zhihuLogin,zhihuData}
}
export async function startProductServer(env=serverEnvironment()){
  const production=env.NODE_ENV==='production',oauth=loginConfig(env)
  if(production&&(!env.DATABASE_URL||!env.THREADPEAK_PUBLIC_ORIGIN||(!oauth&&(!env.THREADPEAK_IDENTITY_SECRET||env.THREADPEAK_IDENTITY_SECRET.length<32||!env.THREADPEAK_IDENTITY_ISSUER||!env.THREADPEAK_IDENTITY_AUDIENCE))||!env.DEEPSEEK_CONTEXT_TOKENS))throw new Error('PRODUCTION_CONFIG_REQUIRED')
  // Capability is explicit for gateways/unknown models. Only this verified official
  // V4 family gets its documented 1M window; the product still caps each call at 500k.
  const officialV4=env.DEEPSEEK_BASE_URL && new URL(env.DEEPSEEK_BASE_URL).hostname==='api.deepseek.com' && /^deepseek-v4-(flash|pro)(?:-|$)/.test(env.DEEPSEEK_MODEL_NAME??'')
  const window=Number(env.DEEPSEEK_CONTEXT_TOKENS??(officialV4?1_000_000:64_000))
  if(!Number.isInteger(window)||window<32000||window>2_000_000)throw new Error('MODEL_CONTEXT_CONFIG_INVALID')
  if(env.THREADPEAK_LOGIN_URL&&new URL(env.THREADPEAK_LOGIN_URL).protocol!=='https:')throw new Error('LOGIN_URL_MUST_BE_HTTPS')
  const db=await openDatabase({url:env.DATABASE_URL,directory:env.THREADPEAK_DATA_DIR??resolve('server/.data/product-v2')});
  for(let attempt=0;;attempt++){try{await migrate(db);break}catch(error){const code=(error as {code?:string}).code??'';if(attempt>=9||!['ECONNREFUSED','ECONNRESET','CONNECTION_CLOSED','CONNECTION_ENDED','CONNECT_TIMEOUT','57P03','57P01'].includes(code)){await db.close();throw new Error('DATABASE_START_FAILED')}process.stdout.write(JSON.stringify({event:'server.waiting_for_database',attempt:attempt+1})+'\n');await new Promise(resolve=>setTimeout(resolve,Math.min(5000,1000*2**attempt)))}}
  const gate=createZhihuGate(db),store=new DurableStore(db),config=resolveProviderConfig(env),{zhihuData,zhihuLogin}=createZhihuUserServices(db,env,gate)
  // Switching to real (including production) cannot retain a usable demo workspace cookie.
  if(zhihuLogin?.config.mode!=='mock')await db.query('DELETE FROM tp_sessions WHERE owner_id LIKE $1',[`${MOCK_ZHIHU_OWNER_PREFIX}%`])
  let handler:TaskHandler=async ctx=>{
    if(ctx.job.kind==='material.zhihu'&&zhihuData&&zhihuLogin){await importZhihuMaterial(ctx,zhihuData,zhihuLogin);return}
    throw new ToolError('PROVIDER_CONFIG_REQUIRED',false)
  }
  if(config.ok){
    const rawLlm=createAgentLlmProvider({config:config.config,http}),rawZhihu=createAgentZhihuProvider({config:config.config,http:async(url,init)=>{const response=await http(url,init);await gate.observe(response);return response},clock:{now:()=>new Date(),unixSeconds:()=>Math.floor(Date.now()/1000)}})
    const llm:LlmProvider={complete:input=>withPermit(db,'llm',4,input.signal,signal=>rawLlm.complete({...input,signal}))}
    const zhihu=limitZhihuProvider(rawZhihu,gate)
    handler=createFlows(new ProductTools(llm,zhihu,window),zhihuData,zhihuLogin)
  }
  const worker=new DurableWorker(store,handler),app=await createProductApp({store,worker,providersReady:config.ok,zhihuData,zhihuLogin,identity:{production,origin:env.THREADPEAK_PUBLIC_ORIGIN,jwtSecret:env.THREADPEAK_IDENTITY_SECRET,issuer:env.THREADPEAK_IDENTITY_ISSUER,audience:env.THREADPEAK_IDENTITY_AUDIENCE,loginUrl:env.THREADPEAK_LOGIN_URL}})
  app.addHook('onClose',()=>db.close())
  const port=Number(env.THREADPEAK_PORT??4312)
  await app.listen({port,host:env.THREADPEAK_HOST??'127.0.0.1'});worker.start()
  process.stdout.write(JSON.stringify({event:'server.ready',port,providersReady:config.ok,storage:env.DATABASE_URL?'postgres':'pglite',mode:production?'production':'local',zhihuOAuthMode:zhihuLogin?.config.mode??'unconfigured'})+'\n')
  let closing=false
  const close=async()=>{if(closing)return;closing=true;await app.close()}
  process.once('SIGTERM',()=>void close());process.once('SIGINT',()=>void close())
  return {app,store,worker}
}
