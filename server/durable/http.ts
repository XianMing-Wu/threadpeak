import {DIRECT_ROUTE_VERSION} from '../path-generation/direct-route.ts'
import {sharedHttpRateLimitStore} from './http-rate-limit.ts'
import helmet from '@fastify/helmet'
import rateLimit, {normalizeIP} from '@fastify/rate-limit'
import {isIP} from 'node:net'
import {readLibraryPage} from './library.ts'
import { pathGoalContext, hydrateLearningGoal, ownedPath } from './learning-goal.ts'
import { SearchScopeSchema } from '@threadpeak/contracts/search-scope'
import {registerSourcePresentation} from './source-presentation.ts'
import { registerAuthorRoutes } from './authors-http.ts'
import Fastify, { type FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { NodeSchema, paragraphNode, validateTree, type LearningState } from '@threadpeak/contracts/learning-v2'
import { mergeNodeEdits, mergeNodeFieldPatch, NodeEditConflict } from '@threadpeak/contracts/node-edits'
import { createIdentity, type IdentityConfig } from './auth.ts'
import { CommandError, digest, type DurableStore, type Resource } from './store.ts'
import type { DurableWorker } from './worker.ts'
import { replyInput, selectPathOption, allAnswered,selectPathCustomAnswer, type PathState } from './flows.ts'
import {sourceForNode} from './authors-network.ts'
import { pathTrace } from './path-trace.ts'
import { registerMaterialRoutes } from './materials-http.ts'
import { inheritedArticles, planningMaterial } from './materials.ts'
import type { ZhihuDataClient } from './zhihu-data.ts'
import type { ZhihuLogin } from './zhihu-oauth.ts'
import { oauthCookie } from './zhihu-oauth.ts'
import { ToolError } from './worker.ts'

const Text=z.string().trim().min(1).max(20000),Id=z.string().min(1).max(240)
const depth=z.enum(['fast','deep']).default('fast')
const attachment=z.object({sourceId:Id})
const startSchema=z.object({searchScope:SearchScopeSchema.default({kind:'zhihu'}),goal:Text,attachments:z.array(attachment).max(8).default([]),thinkingDepth:depth})
const commandSchema=z.object({kind:z.enum(['reply','author','new-conversation','activate-conversation']),question:Text.optional(),selected:z.array(Id).max(200).default([]),conversationId:Id,depth})
function requestKey(request:FastifyRequest){const key=request.headers['idempotency-key'];if(typeof key!=='string'||key.trim().length<8||key.length>200)throw new CommandError('IDEMPOTENCY_KEY_REQUIRED',400);return key}
const bodyOf=(request:FastifyRequest)=>request.body??{}
const resourceId=(request:FastifyRequest)=>(request.params as {id:string}).id

export function trustedProxies(value:string[]=[]):string[] {
  for(const address of value){
    const [ip,prefix,...extra]=address.split('/'),version=isIP(ip!)
    if(!version||extra.length||prefix!==undefined&&(!/^\d+$/.test(prefix)||Number(prefix)<1||Number(prefix)>(version===4?32:128)))throw new Error('TRUSTED_PROXY_CONFIG_INVALID')
  }
  return value
}
export async function createProductApp(ports:{store:DurableStore;worker:DurableWorker;identity:IdentityConfig;providersReady:boolean;requestLimit?:number;trustedProxies?:string[];zhihuData?:ZhihuDataClient;zhihuLogin?:ZhihuLogin;closeStorage?:()=>Promise<void>}){
  const app=Fastify({logger:false,bodyLimit:1_000_000,requestTimeout:120_000,trustProxy:trustedProxies(ports.trustedProxies)})
  await app.register(helmet)
  await app.register(rateLimit,{global:false,max:ports.requestLimit??600,timeWindow:60_000,store:sharedHttpRateLimitStore(ports.store.db),skipOnError:false})
  const identity=createIdentity(ports.store,ports.identity),owners=new WeakMap<FastifyRequest,string>()
  const owner=(request:FastifyRequest)=>owners.get(request)!
  const guestLimit=app.rateLimit({max:20,timeWindow:3_600_000,keyGenerator:request=>`guest-entry:${normalizeIP(request.ip,64)}`})
  const limit=app.rateLimit({keyGenerator:request=>JSON.stringify([owner(request)??'anonymous',normalizeIP(request.ip,64)])})
  const entryRoutes=new Set(['/health','/api/ready','/api/auth/config','/api/auth/guest','/api/auth/zhihu/start','/api/auth/zhihu/callback','/api/v2/session','/api/auth/session'])
  app.addHook('onRequest',async(request,reply)=>{
    reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff')
    // Liveness must remain available during a database outage. Readiness and
    // every API route still use the shared limiter and fail closed on failure.
    if(request.url.split('?')[0]==='/health')return
    const entry=entryRoutes.has(request.url.split('?')[0]!)
    // Login and public routes are limited before session/OAuth writes. Their
    // bucket cannot be rotated by requesting a fresh development identity.
    if(entry)await limit.call(app,request,reply)
    if(request.url.split('?')[0]==='/api/auth/guest')await guestLimit.call(app,request,reply)
    let failure:unknown
    try{if(request.url.startsWith('/api/')&&!['/api/ready','/api/auth/config','/api/auth/guest','/api/auth/zhihu/start','/api/auth/zhihu/callback'].includes(request.url.split('?')[0]!))owners.set(request,await identity.resolve(request,reply))}catch(error){failure=error}
    if(!entry)await limit.call(app,request,reply)
    if(failure)throw failure
  })
  app.setErrorHandler((error,_request,reply)=>{
    const httpStatus=(error as {statusCode?:number})?.statusCode??500
    const zhihuAuthFailure=error instanceof ToolError&&error.code==='ZHIHU_AUTH_FAILED'
    const status=error instanceof CommandError?error.status:zhihuAuthFailure?401:error instanceof NodeEditConflict?409:error instanceof z.ZodError?400:[400,413,415,429].includes(httpStatus)?httpStatus:500
    const code=error instanceof CommandError?error.code:zhihuAuthFailure?'ZHIHU_AUTH_FAILED':error instanceof NodeEditConflict?'NODE_EDIT_CONFLICT':status===400?'INVALID_INPUT':status===429?'REQUEST_RATE_LIMITED':status===415?'UNSUPPORTED_MEDIA_TYPE':status===413?'REQUEST_TOO_LARGE':'SERVICE_UNAVAILABLE'
    const notices:Record<string,string>={ZHIHU_AUTH_FAILED:'知乎资料授权校验未通过，请重新连接账号；若仍失败，请联系服务管理员。',UPLOAD_BUSY:'正在上传的文件较多，请等当前上传完成后重试。',MATERIAL_QUOTA_EXCEEDED:'资料存储已达到当前服务额度，请联系管理员调整额度后继续。',PROVIDER_CONFIG_REQUIRED:'生成服务尚未配置完成，请稍后重试。',RETRY_BUDGET_EXHAUSTED:'这次任务已达到继续次数上限，已有内容仍然保留。',RETRY_EXPIRED:'这次任务已归档，已有内容仍然保留。',RETRY_COOLDOWN:'请稍后再继续这次任务。',REQUEST_RATE_LIMITED:'请求较多，请稍后再试。',REQUEST_TOO_LARGE:'提交的内容较大，请减少后重试。',COLLECTION_SCOPE_INVALID:'请先选择收藏夹并等待内容读取完成。',ZHIHU_LOGIN_REQUIRED:'连接账号后即可选择你的收藏夹。',ZHIHU_NOT_CONFIGURED:'知乎账号连接暂未开放，仍可添加文件开始学习。',ZHIHU_REAUTHORIZE:'知乎授权已到期，请重新连接账号。',PDF_NOT_CONFIGURED:'PDF 解析服务尚未连接，请先添加 Markdown 或文本文件。',MATERIAL_PROCESSING:'资料还在整理，完成后即可生成路线。',COLLECTION_EMPTY:'这个收藏夹还没有可读取的公开内容。'}
    const message=notices[code]??(code==='ACCOUNT_BUSY'?'正在处理的任务较多，请稍后继续。':code==='PDF_UNREADABLE'||code==='ATTACHMENT_EMPTY'?'这份 PDF 没有可读取的文字，请换成含文字的 PDF、Markdown 或文本文件。':code==='ATTACHMENT_SIZE'||code==='ATTACHMENT_TEXT_SIZE'?'附件较大，请拆成较小的文件再添加。':code==='TEXT_ENCODING'?'请将文本另存为 UTF-8 后添加。':code==='NODE_EDIT_CONFLICT'?'这张卡片的同一内容已在另一处编辑，你的版本仍保留，请选择要保存的版本。':code==='REVISION_CONFLICT'?'内容已在另一处更新，正在读取最新版本。':code==='BUSY'?'当前任务还在进行。':status===404?'找不到这项内容。':status===401?'请先登录。':status===400?'请检查这次输入。':'这次操作暂时还没完成，已有内容已保留。')
    reply.code(status).send({code,message})
  })
  app.addHook('preHandler',async request=>{
    if(ports.providersReady||request.method!=='POST')return
    const url=request.url.split('?')[0]!
    const generation=url==='/api/path-runs'||/\/api\/path-runs\/[^/]+\/(select|follow-up|reply|retry)$/.test(url)||/\/api\/v2\/chats\/[^/]+\/reply$/.test(url)||url==='/api/v2/authors/search'||url==='/api/v2/sources/presentation'||url.endsWith('/import-author-source')||url.endsWith('/resume')||url.endsWith('/commands')&&['reply','author'].includes((request.body as any)?.kind)
    if(generation)throw new CommandError('PROVIDER_CONFIG_REQUIRED',503)
  })
  app.get('/health',()=>({ok:true}))
  app.get('/api/ready',async(_request,reply)=>{
    try{await ports.store.db.query('SELECT 1')}catch{return reply.code(503).send({ready:false})}
    return reply.code(ports.providersReady?200:503).send({ready:ports.providersReady,storage:true})
  })
  app.get('/api/auth/config',()=>({mode:ports.identity.production?'production':'local',loginUrl:ports.identity.loginUrl??null,zhihuAvailable:!!ports.zhihuLogin,zhihuMode:ports.zhihuLogin?.config.mode??'real',zhihuDemo:ports.zhihuLogin?.config.mode==='mock'}))
  app.post('/api/auth/guest',(request,reply)=>identity.startGuest(request,reply))
  app.get('/api/auth/zhihu/start',async(request,reply)=>{
    if(request.headers['sec-fetch-site']==='cross-site'||request.headers.origin&&ports.identity.origin&&request.headers.origin!==ports.identity.origin)throw new CommandError('ORIGIN_DENIED',403)
    if(!ports.zhihuLogin)throw new CommandError('ZHIHU_NOT_CONFIGURED',503)
    let current:string|undefined
    if(ports.zhihuLogin.config.mode==='mock'&&request.headers.cookie?.includes('tp_workspace=')){try{current=await identity.resolve(request,reply)}catch(error){if(!(error instanceof CommandError)||error.status!==401)throw error}}
    const result=await ports.zhihuLogin.start(current);reply.header('Set-Cookie',result.cookie);return {kind:'redirect',authorizeUrl:result.authorizeUrl,mode:ports.zhihuLogin.config.mode??'real'}
  })
  app.get('/api/auth/zhihu/callback',async(request,reply)=>{
    const binding=request.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('tp_zhihu_oauth='))?.slice(15)??''
    const clearCookie=oauthCookie('',0,ports.zhihuLogin?.config.redirectUri.startsWith('https:')??ports.identity.production)
    reply.header('Set-Cookie',clearCookie).header('Referrer-Policy','no-referrer')
    try{
      if(!ports.zhihuLogin)throw new CommandError('ZHIHU_NOT_CONFIGURED',503)
      const query=z.object({authorization_code:z.string().min(1).max(4096).optional(),code:z.string().min(1).max(4096).optional(),state:z.string().regex(/^[a-f0-9]{64}$/),error:z.string().max(200).optional()}).parse(request.query)
      if(query.error)throw new CommandError(query.error==='access_denied'?'OAUTH_DENIED':'OAUTH_STATE_INVALID',400)
      const cookie=await ports.zhihuLogin.callback(query.authorization_code??query.code??'',query.state,binding)
      reply.header('Set-Cookie',[cookie,clearCookie])
      return reply.redirect('/?oauth=success#home')
    }catch(error){
      await ports.zhihuLogin?.discardAttempt(binding)
      // Fixed local destinations and public reasons; never echo upstream text,
      // authorization codes, tokens, or the untrusted error_description.
      if(error instanceof CommandError&&error.code==='OAUTH_DENIED')return reply.redirect('/?oauth=cancelled#home')
      if(error instanceof CommandError&&error.status===429)return reply.redirect('/?oauth=busy#home')
      return reply.redirect('/?oauth=failed#home')
    }
  })
  app.get('/api/v2/session',async request=>{
    const own=owner(request),[account]=await ports.store.db.query<{profile:unknown;token_expires_at:number}>('SELECT profile,token_expires_at FROM tp_zhihu_accounts WHERE owner_id=$1',[own])
    const authorization=account?{status:!ports.zhihuLogin?'unavailable':account.token_expires_at<=Date.now()?'expired':'active',expiresAt:Number(account.token_expires_at)}:undefined
    return {kind:own.startsWith('account:')?'authenticated':'guest',capabilities:{zhihuMaterials:!!account},provider:account?'zhihu':own.startsWith('account:')?'account':null,profile:account?.profile,authorization,demo:!!(account?.profile as any)?.demo,available:true,workspaceId:digest(own)}
  })
  registerMaterialRoutes(app,ports.store,ports.worker,owner,requestKey,ports.zhihuData,ports.zhihuLogin)
  registerSourcePresentation(app,ports.store,ports.worker,owner)
  async function ownedAttachments(own:string,items:z.infer<typeof attachment>[]){
    return Promise.all(items.map(async item=>{
      const resource=await ports.store.resource(own,item.sourceId)
      if(resource.kind!=='attachment')throw new CommandError('ATTACHMENT_NOT_FOUND',404)
      if(resource.body.status==='processing')throw new CommandError('MATERIAL_PROCESSING',409)
      return planningMaterial(resource as Resource<import('./materials.ts').Material>)
    }))
  }
  app.get('/api/auth/session',request=>({kind:owner(request).startsWith('account:')?'authenticated':'guest',provider:owner(request).startsWith('account:zhihu:')?'zhihu':owner(request).startsWith('account:')?'account':null}))
  app.post('/api/auth/logout',(request,reply)=>identity.logout(request,reply,owner(request)))
  app.get('/api/v2/resources/:id',async request=>{
    const afterData=(request.query as {afterData?:string}).afterData
    if(afterData!==undefined)return ports.store.snapshot(owner(request),resourceId(request),z.coerce.number().int().min(0).parse(afterData))
    const after=(request.query as {after?:string}).after
    if(after!==undefined){
      const revision=z.coerce.number().int().min(0).parse(after)
      const [current]=await ports.store.db.query<{revision:number}>('SELECT revision FROM tp_resources WHERE owner_id=$1 AND id=$2',[owner(request),resourceId(request)])
      if(!current)throw new CommandError('NOT_FOUND',404)
      if(current.revision===revision)return {unchanged:true,revision}
    }
    await hydrateLearningGoal(ports.store,owner(request),resourceId(request))
    return ports.store.snapshot(owner(request),resourceId(request))
  })
  app.post('/api/v2/resources/:id/cancel',async request=>{await ports.store.cancel(owner(request),resourceId(request));return ports.store.snapshot(owner(request),resourceId(request))})
  app.post('/api/v2/resources/:id/resume',async request=>{await ports.store.resume(owner(request),resourceId(request));ports.worker.wake();return ports.store.snapshot(owner(request),resourceId(request))})
  app.post('/api/v2/chats/enter',async request=>{
    const input=z.object({chatId:Id,question:Text,attachments:z.array(attachment).max(8).default([]),depth}).parse(bodyOf(request)),own=owner(request)
    input.attachments=await ownedAttachments(own,input.attachments)
    if(!ports.providersReady){const [old]=await ports.store.db.query<Resource>("SELECT * FROM tp_resources WHERE owner_id=$1 AND kind='chat' AND scope=$2",[own,input.chatId]);if(!old||(await ports.store.snapshot(own,old.id)).job===null)throw new CommandError('PROVIDER_CONFIG_REQUIRED',503);return ports.store.snapshot(own,old.id)}
    const resource=await ports.store.create(own,'chat',input.chatId,{title:input.question,attachments:input.attachments,messages:[]})
    const existing=(await ports.store.snapshot(own,resource.id)).job
    if(!existing){
      await ports.store.enqueue(own,resource.id,'chat.reply',`chat-enter:${resource.id}`,{question:resource.body.title,depth:input.depth},(r,jobId)=>({...r.body,messages:[{id:`question-${jobId}`,role:'user',text:resource.body.title}]}))
      ports.worker.wake()
    }
    return ports.store.snapshot(own,resource.id)
  })
  app.post('/api/v2/chats/:id/reply',async request=>{
    const input=z.object({question:Text,depth}).parse(bodyOf(request)),own=owner(request),id=resourceId(request)
    await ports.store.enqueue(own,id,'chat.reply',requestKey(request),input,(r,jobId)=>{
      if(r.kind!=='chat')throw new CommandError('NOT_FOUND',404)
      return {...r.body,messages:[...r.body.messages,{id:`question-${jobId}`,role:'user',text:input.question}]}
    });ports.worker.wake();return ports.store.snapshot(own,id)
  })
  app.get('/api/v2/library',async request=>{
    const query=z.object({cursor:z.string().max(1000).optional()}).parse(request.query)
    return readLibraryPage(ports.store.db,owner(request),query.cursor)
  })
  async function pathByDocument(own:string,documentId:string){
    const paths=await ports.store.db.query<Resource>("SELECT * FROM tp_resources WHERE owner_id=$1 AND kind='path' AND (id=$2 OR body->'document'->>'id'=$2)",[own,documentId])
    const path=paths.find(p=>p.id===documentId)??(paths.length===1?paths[0]:undefined)
    if(!path||path.body.status!=='published')throw new CommandError('NOT_FOUND',404)
    return path
  }
  app.get('/api/v2/paths/:id/progress',async request=>{
    const path=await pathByDocument(owner(request),resourceId(request));return {value:path.body.progress??null}
  })
  app.put('/api/v2/paths/:id/progress',async request=>{
    const {value}=z.object({value:z.string().max(1_000_000)}).parse(bodyOf(request)),path=await pathByDocument(owner(request),resourceId(request))
    await ports.store.edit(owner(request),path.id,undefined,r=>({...r.body,progress:value}));return {saved:true}
  })
  async function pathView(own:string,id:string){
    const snapshot=await ports.store.snapshot(own,id),path=snapshot.data as PathState
    if(snapshot.kind!=='path')throw new CommandError('NOT_FOUND',404)
    const busy=snapshot.job&&['queued','running'].includes(snapshot.job.status),waiting=snapshot.job?.status==='waiting'||snapshot.job?.status==='cancelled'
    const answerDuringWork=path.workflow===DIRECT_ROUTE_VERSION&&['path.start','path.answer'].includes(snapshot.job?.kind??'')
    return {runId:id,searchScope:path.searchScope??{kind:'zhihu'},goal:path.goal,recoverable:snapshot.job?.recoverable??false,status:path.status==='awaiting_answers'&&!allAnswered(path)&&(!busy||answerDuringWork)?'awaiting_answers':busy?'running':waiting?'failed':path.status,preparing:!!busy&&snapshot.job?.kind==='path.start',stage:snapshot.job?.phase??'',questionSets:path.questionSets,document:path.document,route:path.route,
      reply:path.conversation.filter((m:any)=>m.role==='assistant').at(-1)?.content,followUpMessage:path.conversation.filter((m:any)=>m.role==='assistant').at(-1)?.content,conversation:path.conversation,knowledgeCreated:false,revision:snapshot.revision,
      trace:pathTrace(await ports.store.db.query<any>('SELECT id,kind,status,checkpoints,activities FROM tp_jobs WHERE owner_id=$1 AND resource_id=$2 ORDER BY created_at,id',[own,id]),path),
      ...(waiting?{error:{code:snapshot.job?.recoverable?'RECOVERABLE':'RETRY_BUDGET_EXHAUSTED',message:snapshot.job?.recoverable?'这次还没完成，已收集的资料和选择都已保留。':'本次重试次数已用完，已有资料和选择仍然保留。'}}:{})}
  }
  app.post('/api/path-runs',async(request,reply)=>{
    const input=startSchema.parse(bodyOf(request)),key=requestKey(request),own=owner(request)
    input.attachments=await ownedAttachments(own,input.attachments)
    if(input.searchScope.kind==='collections'){
      if(!own.startsWith('account:zhihu:'))throw new CommandError('ZHIHU_LOGIN_REQUIRED',401)
      const folders=new Set(input.searchScope.folderIds)
      const selected=input.attachments as any[]
      if(folders.size!==input.searchScope.folderIds.length||[...folders].some(id=>!selected.some(a=>a.origin==='collection'&&a.folderId===id&&a.entries?.length))||selected.some(a=>a.origin!=='upload'&&!(a.origin==='collection'&&folders.has(a.folderId))))throw new CommandError('COLLECTION_SCOPE_INVALID',400)
    }
    const state:PathState={searchScope:input.searchScope,goal:input.goal,attachments:input.attachments,depth:input.thinkingDepth,status:'running',questionSets:[],conversation:[{messageId:'goal',role:'user',kind:'text',content:input.goal}]}
    const resource=await ports.store.create(own,'path',key,state)
    await ports.store.enqueue(own,resource.id,'path.start',key,{...input,depth:input.thinkingDepth})
    ports.worker.wake();return reply.code(202).send(await pathView(own,resource.id))
  })
  app.get('/api/path-runs/:id',request=>pathView(owner(request),resourceId(request)))
  app.post('/api/path-runs/:id/select',async request=>{
    const answer=z.union([z.object({questionId:Id,optionId:Id}).strict(),z.object({questionId:Id,customAnswer:z.string().max(4000).refine(s=>!!s.trim())}).strict()]).parse(bodyOf(request)),own=owner(request),id=resourceId(request)
    const state=(await ports.store.resource<PathState>(own,id)).body
    const update=(r:Resource)=>'customAnswer' in answer?selectPathCustomAnswer(r,answer.questionId,answer.customAnswer):selectPathOption(r,answer.questionId,answer.optionId)
    if(state.workflow==='route-direct-v6')await ports.store.answerPath(own,id,requestKey(request),{...answer,depth:state.depth},update)
    else await ports.store.enqueue(own,id,'path.answer',requestKey(request),{...answer,depth:state.depth},update)
    ports.worker.wake();return pathView(own,id)
  })
  for(const action of ['follow-up','reply'] as const)app.post(`/api/path-runs/:id/${action}`,async request=>{
    const {message,thinkingDepth}=z.object({message:Text,thinkingDepth:depth}).parse(bodyOf(request)),own=owner(request),id=resourceId(request)
    await ports.store.enqueue(own,id,action==='follow-up'?'path.clarify':'path.chat',requestKey(request),{question:message,depth:thinkingDepth},r=>{
      if(r.kind!=='path'||action==='reply'&&r.body.status!=='published'||action==='follow-up'&&r.body.status!=='awaiting_answers')throw new CommandError('INVALID_STAGE')
      r.body.conversation.push({messageId:randomUUID(),role:'user',kind:'text',content:message});return r.body
    });ports.worker.wake();return pathView(own,id)
  })
  app.post('/api/path-runs/:id/retry',async request=>{await ports.store.resume(owner(request),resourceId(request));ports.worker.wake();return pathView(owner(request),resourceId(request))})
  app.post('/api/v2/learning/enter',async(request,reply)=>{
    const input=z.object({routeId:Id,conceptId:Id,depth}).parse(bodyOf(request)),own=owner(request)
    const path=await ownedPath(ports.store,own,input.routeId)
    if(!path||path.body.status!=='published')throw new CommandError('NOT_FOUND',404)
    const conceptId=path.body.conceptIdByWireId?.[input.conceptId]??input.conceptId
    const concept=path.body.route.concepts.find((c:any)=>c.id===conceptId)
    if(!concept)throw new CommandError('NOT_FOUND',404)
    if(!ports.providersReady){const [old]=await ports.store.db.query<Resource>("SELECT * FROM tp_resources WHERE owner_id=$1 AND kind='learning' AND scope=$2",[own,`${path.id}:${conceptId}`]);if(!old||(await ports.store.snapshot(own,old.id)).job===null)throw new CommandError('PROVIDER_CONFIG_REQUIRED',503);return ports.store.snapshot(own,old.id)}
    const conversationId=randomUUID(),materials=inheritedArticles(path.body.attachments??[])
    const materialNodes=materials.length?[{id:'root',type:'root' as const,title:concept.title,text:'',sources:materials.map(a=>a.id),parents:[]},...materials.map(a=>({id:a.id,type:'article' as const,title:a.title,text:a.summary,sources:[a.id],parents:['root']}))]:[]
    const state:LearningState={goalContext:pathGoalContext(path.body,conceptId),searchScope:path.body.searchScope??{kind:'zhihu'},version:2,routeId:path.body.document.id,conceptId,learningSummary:concept.learningSummary,title:concept.title,description:concept.detailedDescription,hasDispute:concept.hasDispute,
      articles:materials,nodes:materialNodes,initialized:false,phase:'searching',active:conversationId,conversations:[{id:conversationId,title:concept.title,date:new Date().toISOString(),messages:[{id:'concept-question',role:'user',text:concept.title}]}]}
    const resource=await ports.store.create(own,'learning',`${path.id}:${conceptId}`,state)
    const missing=materials.filter(a=>!resource.body.articles.some((old:any)=>old.id===a.id))
    if(missing.length||state.goalContext&&(!resource.body.goalContext||!resource.body.goalContext.routeContext&&!!state.goalContext.routeContext))await ports.store.edit(own,resource.id,undefined,r=>{
      const body=r.body as LearningState
      if(state.goalContext)body.goalContext={...state.goalContext,...body.goalContext,...state.goalContext?.routeContext?{routeContext:state.goalContext.routeContext}:{}}
      if(!body.nodes.length)body.nodes.push({id:'root',type:'root',title:body.title,text:'',sources:[],parents:[]})
      for(const a of missing)if(!body.articles.some(old=>old.id===a.id)){body.articles.push(a);body.nodes.push({id:a.id,type:'article',title:a.title,text:a.summary,sources:[a.id],parents:['root']})}
      body.nodes.find(n=>n.type==='root')!.sources=body.articles.map(a=>a.id);return body
    })
    if(!resource.body.initialized){
      const existing=(await ports.store.snapshot(own,resource.id)).job
      if(!existing){await ports.store.enqueue(own,resource.id,'learning.enter',`enter:${resource.id}`,{depth:input.depth,conversationId:resource.body.active});ports.worker.wake()}
    }
    return reply.code(200).send(await ports.store.snapshot(own,resource.id))
  })
  app.post('/api/v2/learning/:id/commands',async request=>{
    const input=commandSchema.parse(bodyOf(request)),own=owner(request),id=resourceId(request)
    await hydrateLearningGoal(ports.store,own,id)
    if(input.kind==='new-conversation'||input.kind==='activate-conversation'){
      const existing=await ports.store.resource<LearningState>(own,id)
      if(input.kind==='new-conversation'&&existing.body.conversations.some(c=>c.id===input.conversationId))return ports.store.snapshot(own,id)
      if(input.kind==='new-conversation')await ports.store.cancel(own,id)
      const resource=await ports.store.resource<LearningState>(own,id)
      await ports.store.edit(own,id,undefined,r=>{
        if(r.kind!=='learning')throw new CommandError('NOT_FOUND',404)
        if(input.kind==='activate-conversation'){if(!r.body.conversations.some((c:any)=>c.id===input.conversationId))throw new CommandError('CONVERSATION_NOT_FOUND');r.body.active=input.conversationId}
        else {const next={id:input.conversationId,title:'新对话',date:new Date().toISOString(),messages:[]};if(!r.body.conversations.some((c:any)=>c.id===next.id))r.body.conversations.push(next);r.body.active=next.id;if(r.body.nodes.length)r.body.phase='ready'}
        return r.body
      });return ports.store.snapshot(own,id)
    }
    if(!input.question)throw new CommandError('QUESTION_REQUIRED',400)
    const key=requestKey(request),previous=await ports.store.existingCommand(own,key)
    if(previous){if(previous.resource_id!==id||previous.kind!==`learning.${input.kind}`||digest(previous.input.intent)!==digest(input))throw new CommandError('COMMAND_CONFLICT');return ports.store.snapshot(own,id)}
    const resource=await ports.store.resource<LearningState>(own,id)
    if(resource.kind!=='learning'||!resource.body.nodes.length)throw new CommandError('MATERIAL_NOT_READY')
    const context=replyInput(resource.body,input.question,input.selected,input.conversationId)
    if(input.kind==='author'&&context.cards.length!==1)throw new CommandError('ONE_AUTHOR_HOST_REQUIRED',400)
    const hostSource=input.kind==='author'?sourceForNode(resource.body,context.cards[0]!.id):undefined
    const excludedSourceUrls=[...new Set([...resource.body.nodes.map(n=>n.author?.url),hostSource?.url].filter((url):url is string=>!!url))]
    const excludedAuthorIds=[...new Set([...resource.body.nodes.map(n=>n.author?.id),hostSource?.authorId,...context.cards.flatMap(card=>resource.body.articles.filter(a=>card.sources.includes(a.id)).map(a=>a.authorId))].filter(Boolean))]
    const excludedAuthorNames=[...new Set([...resource.body.nodes.map(n=>n.author?.name),...context.cards.flatMap(card=>resource.body.articles.filter(a=>card.sources.includes(a.id)).map(a=>a.author))].filter(Boolean))]
    await ports.store.enqueue(own,id,`learning.${input.kind}`,key,{...input,intent:input,context,excludedAuthorIds,excludedAuthorNames,excludedSourceUrls,hostSource},(r,jobId)=>{
      // Freeze the exact card versions seen when accepting this command.
      if(r.revision!==resource.revision)throw new CommandError('REVISION_CONFLICT')
      const conversation=r.body.conversations.find((c:any)=>c.id===input.conversationId)
      conversation.messages.push({id:`question-${jobId}`,role:'user',text:input.question,selected:input.selected})
      if(conversation.messages.length===1)conversation.title=input.question!.slice(0,80)
      return r.body
    });ports.worker.wake();return ports.store.snapshot(own,id)
  })
  app.patch('/api/v2/learning/:id/nodes',{bodyLimit:20_000_000},async request=>{
    const nodeList=z.array(NodeSchema).max(20_000)
    const input=z.object({revision:z.number().int().min(0),nodes:nodeList.optional(),baseNodes:nodeList.optional(),patch:z.object({nodes:nodeList,baseNodes:nodeList}).optional()}).refine(v=>v.patch?!v.nodes&&!v.baseNodes:!!v.nodes).parse(bodyOf(request)),own=owner(request),id=resourceId(request)
    try{if(input.nodes)validateTree(input.nodes)}catch{throw new CommandError('INVALID_TREE',400)}
    await ports.store.edit(own,id,input.baseNodes||input.patch?undefined:input.revision,r=>{
      if(r.kind!=='learning')throw new CommandError('NOT_FOUND',404)
      const old=r.body.nodes as LearningState['nodes']
      const nodes=input.patch?mergeNodeFieldPatch(input.patch,old):input.baseNodes?mergeNodeEdits(input.baseNodes,input.nodes!,old):input.nodes!
      try{validateTree(nodes)}catch{throw new CommandError('INVALID_TREE',400)}
      const retained=(r.body as LearningState).conversations.flatMap(c=>c.messages.flatMap(m=>m.paragraphs??[])).map(paragraphNode)
      const currentById=new Map(old.map(n=>[n.id,n])),nextById=new Map(nodes.map(n=>[n.id,n])),retainedById=new Map(retained.map(n=>[n.id,n]))
      for(const node of old.filter(n=>n.type==='root'||n.type==='article')){
        const next=nextById.get(node.id)
        if(!next||next.type!==node.type||JSON.stringify(next.parents)!==JSON.stringify(node.parents)||JSON.stringify(next.sources)!==JSON.stringify(node.sources))throw new CommandError('SOURCE_IMMUTABLE')
      }
      for(const node of nodes){
        const before=currentById.get(node.id)??retainedById.get(node.id)
        if(!before&&node.type!=='custom')throw new CommandError('GENERATED_NODE_IMMUTABLE')
        if(before&&(before.type!==node.type||JSON.stringify(before.author)!==JSON.stringify(node.author)||JSON.stringify(before.sources)!==JSON.stringify(node.sources)||JSON.stringify(before.parents)!==JSON.stringify(node.parents)||before.basisId!==node.basisId||before.origin!==node.origin))throw new CommandError('NODE_PROVENANCE_IMMUTABLE')
      }
      return {...r.body,nodes}
    });return ports.store.snapshot(own,id)
  })
  registerAuthorRoutes(app,ports.store,ports.worker,owner,requestKey)
  app.addHook('onClose',async()=>{await ports.worker.stop();await ports.closeStorage?.()})
  return app
}
