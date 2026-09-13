import {isMockZhihuOwner,isMockZhihuUrl} from './zhihu-oauth-mock.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { CommandError,digest,type DurableStore,type Resource } from './store.ts'
import type { DurableWorker,TaskContext } from './worker.ts'
import { ToolError } from './worker.ts'
import { materialView,textUpload,validateUpload,type Material,type MaterialEntry } from './materials.ts'
import type { ZhihuDataClient } from './zhihu-data.ts'
import type { ZhihuLogin } from './zhihu-oauth.ts'
import { safeZhihuUrl } from './authors-network.ts'
const Name=z.string().trim().min(1).max(200)
export function registerMaterialRoutes(app:FastifyInstance,store:DurableStore,worker:DurableWorker,owner:(r:FastifyRequest)=>string,key:(r:FastifyRequest)=>string,api?:ZhihuDataClient,login?:ZhihuLogin){
  // Authentication runs in the parent onRequest hook, before accepting large bodies.
  void app.register(async uploads=>{
    const active=new Map<string,number>(),held=new WeakMap<FastifyRequest,string>()
    let total=0
    const release=(request:FastifyRequest)=>{const own=held.get(request);if(!own)return;held.delete(request);total--;const count=(active.get(own)??1)-1;if(count)active.set(own,count);else active.delete(own)}
    uploads.addHook('onRequest',async request=>{
      const own=owner(request);if(total>=4||(active.get(own)??0)>=2)throw new CommandError('UPLOAD_BUSY',429)
      total++;active.set(own,(active.get(own)??0)+1);held.set(request,own)
      request.raw.once('close',()=>{if(!request.raw.complete)release(request)})
    })
    uploads.addHook('onResponse',async request=>release(request))
    uploads.addHook('onError',async request=>release(request))
    uploads.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:101*1024*1024},(_request,body,done)=>done(null,body))
    uploads.post('/api/v2/materials/upload',{bodyLimit:101*1024*1024},async request=>{
      const commandKey=key(request),name=Name.parse((request.query as any).name),bytes=request.body as Buffer
      if(!Buffer.isBuffer(bytes))throw new CommandError('ATTACHMENT_INVALID',400)
      return upload(name,bytes,owner(request),commandKey)
    })
    // Compatibility with an already open composer; the same durable pipeline handles PDFs.
    uploads.post('/api/v2/attachments',{bodyLimit:20_000_000},async request=>{
      const commandKey=key(request),input=z.object({fileName:Name,base64:z.string().max(14_000_000)}).parse(request.body)
      return upload(input.fileName,Buffer.from(input.base64,'base64'),owner(request),commandKey)
    })
  })
  async function upload(name:string,bytes:Buffer,own:string,commandKey:string){
    const ext=validateUpload(name,bytes),hash=digest(bytes.toString('base64'))
    const [existing]=await store.db.query<Resource<Material>>("SELECT * FROM tp_resources WHERE owner_id=$1 AND kind='attachment' AND scope=$2",[own,commandKey])
    if(existing&&(existing.body.hash!==hash||existing.body.fileName!==name))throw new CommandError('COMMAND_CONFLICT')
    if(existing?.body.status==='ready')return materialView(existing)
    if(ext==='pdf'&&!api)throw new CommandError('PDF_NOT_CONFIGURED',503)
    const body:Material=ext==='pdf'?{fileName:name,mimeType:'application/pdf',hash,bytes:bytes.length,status:'processing',origin:'upload',content:''}:textUpload(name,bytes)
    const resource=existing??await store.create(own,'attachment',commandKey,body)
    if(ext==='pdf'){
      await store.db.query('INSERT INTO tp_material_uploads(resource_id,base64) VALUES($1,$2) ON CONFLICT DO NOTHING',[resource.id,bytes.toString('base64')])
      await store.enqueue(own,resource.id,'material.pdf',`pdf:${resource.id}`,{depth:'fast'});worker.wake()
    }
    return materialView(resource)
  }
  app.get('/api/v2/materials',async request=>{
    const {cursor}=z.object({cursor:z.string().max(1000).optional()}).parse(request.query)
    let before:{time:number;id:string}|undefined
    try{if(cursor)before=z.object({time:z.number().int().nonnegative(),id:z.string().min(1).max(240)}).parse(JSON.parse(Buffer.from(cursor,'base64url').toString()))}catch{throw new CommandError('INVALID_MATERIAL_CURSOR',400)}
    const rows=await store.db.query<Resource<Material>>(`SELECT id,updated_at,jsonb_build_object('fileName',body->'fileName','mimeType',body->'mimeType','status',body->'status','origin',body->'origin','bytes',body->'bytes','folderId',body->'folderId','recent',body->'recent') AS body
      FROM tp_resources WHERE owner_id=$1 AND kind='attachment' AND ($2::bigint IS NULL OR (updated_at,id)<($2::bigint,$3::text)) ORDER BY updated_at DESC,id DESC LIMIT 51`,[owner(request),before?.time??null,before?.id??''])
    const page=rows.slice(0,50),last=page.at(-1)
    return {items:page.map(row=>{const {content,...meta}=materialView(row);return meta}),...(rows.length>50&&last?{nextCursor:Buffer.from(JSON.stringify({time:last.updated_at,id:last.id})).toString('base64url')}:{})}
  })
  app.get('/api/v2/materials/:id',async request=>{
    const snapshot=await store.snapshot(owner(request),(request.params as any).id)
    if(snapshot.kind!=='attachment')throw new CommandError('NOT_FOUND',404)
    const [task]=await store.db.query<{error_code:string}>('SELECT error_code FROM tp_jobs WHERE owner_id=$1 AND resource_id=$2 ORDER BY created_at DESC LIMIT 1',[owner(request),snapshot.id])
    const messages:Record<string,string>={ZHIHU_AUTH_FAILED:'知乎资料授权校验未通过，请重新连接账号后继续。',COLLECTION_EMPTY:'这里还没有可读取的公开内容，可以选择其他收藏夹。',COLLECTION_TOO_LARGE:'收藏夹内容较多，请分成较小的专题收藏夹后添加。',ATTACHMENT_TEXT_SIZE:'资料正文较长，请拆成较小的专题后添加。',PDF_PARSE_FAILED:'这份 PDF 未能解析，请检查文件后重新添加。',ZHIHU_REAUTHORIZE:'知乎授权已到期，请重新连接账号后继续。',PDF_UNREADABLE:'这份 PDF 没有可读取的文字或摘要。'}
    return {...materialView({id:snapshot.id,body:snapshot.data} as Resource<Material>),job:snapshot.job,notice:task?messages[task.error_code]:undefined}
  })
  app.get('/api/v2/zhihu/folders',async request=>{
    if(!owner(request).startsWith('account:zhihu:'))throw new CommandError('ZHIHU_LOGIN_REQUIRED',401)
    if(!api||!login)throw new CommandError('ZHIHU_NOT_CONFIGURED',503)
    const token=await login.userToken(owner(request)),data=await api.user('favlists',token,{Limit:100})
    if(!Array.isArray(data.Items))throw new CommandError('ZHIHU_CONTENT_INVALID',502)
    return {items:data.Items.filter((f:any)=>f.IsPublic===true&&Number.isSafeInteger(f.UrlToken)&&f.UrlToken>0).map((f:any)=>({id:String(f.UrlToken),title:String(f.Title??'收藏夹'),description:String(f.Description??''),url:safeZhihuUrl(f.Url,isMockZhihuOwner(owner(request))),demo:isMockZhihuOwner(owner(request))}))}
  })
  app.post('/api/v2/materials/zhihu',async request=>{
    if(!owner(request).startsWith('account:zhihu:'))throw new CommandError('ZHIHU_LOGIN_REQUIRED',401)
    if(!api||!login)throw new CommandError('ZHIHU_NOT_CONFIGURED',503)
    const input=z.object({kind:z.enum(['collection','creation','recent']),folderId:z.string().regex(/^[1-9]\d{0,15}$/).optional()}).parse(request.body),own=owner(request)
    const token=await login.userToken(own)
    let title=input.kind==='recent'?'最近收藏':'我的知乎创作'
    if(input.kind==='collection'){
      if(!input.folderId||!Number.isSafeInteger(Number(input.folderId)))throw new CommandError('INVALID_INPUT',400)
      const folders=await api.user('favlists',token,{Limit:100}),folder=folders.Items?.find((f:any)=>String(f.UrlToken)===input.folderId&&f.IsPublic===true)
      if(!folder)throw new CommandError('FOLDER_NOT_FOUND',404)
      title=String(folder.Title??'知乎收藏夹')
    }
    const body:Material={fileName:title,mimeType:'text/markdown',status:'processing',origin:input.kind==='recent'?'collection':input.kind,content:'',hash:digest(input),bytes:0,folderId:input.folderId,recent:input.kind==='recent'}
    const resource=await store.create(own,'attachment',key(request),body)
    if(resource.body.hash!==body.hash)throw new CommandError('COMMAND_CONFLICT')
    await store.enqueue(own,resource.id,'material.zhihu',`zhihu-material:${resource.id}`,{depth:'fast'});worker.wake();return materialView(resource as Resource<Material>)
  })
}
export async function importZhihuMaterial(ctx:TaskContext,api:ZhihuDataClient,login:ZhihuLogin){
  const resource=await ctx.store.resource<Material>(ctx.job.owner_id,ctx.job.resource_id),body=resource.body
  if(body.status==='ready'){await ctx.store.commit(ctx.job,r=>r.body);return}
  const entries:MaterialEntry[]=[],seen=new Set<string>(),offsets=new Set<string>();let offset='0'
  while(true){
    if(offsets.has(offset))throw new ToolError('ZHIHU_PAGING_INVALID',false);offsets.add(offset)
    const page=await ctx.step(`import-page:${offset}`,{origin:body.origin,folderId:body.folderId,offset},async()=>{
      const token=await login.userToken(ctx.job.owner_id)
      return api.user(body.recent?'collections':body.origin==='creation'?'contents':'favlist_contents',token,{Offset:offset,Limit:50,...(body.origin==='creation'?{ContentType:'all',SortField:'ts',SortOrder:'desc'}:{FavlistUrlToken:body.folderId})},ctx.signal)
    })
    if(!Array.isArray(page.Items)||!body.recent&&typeof page.Paging?.IsEnd!=='boolean')throw new ToolError('ZHIHU_CONTENT_INVALID',false)
    for(const item of page.Items){
      const demo=isMockZhihuOwner(ctx.job.owner_id)
      const url=safeZhihuUrl(item.Url,demo);if(!url)throw new ToolError('ZHIHU_CONTENT_INVALID',false)
      // Strip only tracking fields for identity. Preserve the original attributed URL in the source.
      const canonical=new URL(url);canonical.search='';canonical.hash='';if(seen.has(canonical.href))continue;seen.add(canonical.href)
      const authorUrl=safeZhihuUrl(item.Author?.Url,demo),token=typeof item.Author?.UrlToken==='string'?item.Author.UrlToken:''
      const authorId=demo?(isMockZhihuUrl(authorUrl)?authorUrl:null):token&&/^[\w-]+$/.test(token)?`https://www.zhihu.com/people/${token}`:authorUrl?.match(/\/people\/([^/?]+)/)?.[1]?`https://www.zhihu.com/people/${authorUrl.match(/\/people\/([^/?]+)/)![1]}`:null
      entries.push({id:digest(canonical.href),title:String(item.Title??'知乎内容'),summary:String(item.Summary??''),url,authorId,authorName:typeof item.Author?.Name==='string'?item.Author.Name:null,authorUrl,likes:Number.isFinite(item.LikeCount)?Math.max(0,item.LikeCount):null})
    }
    await ctx.progress(`正在整理${body.origin==='collection'?'收藏夹':'创作'} · ${entries.length} 篇`)
    if(entries.length>2000)throw new ToolError('COLLECTION_TOO_LARGE',false)
    if(body.recent||page.Paging.IsEnd)break
    if(!/^\d+$/.test(String(page.Paging.NextOffset))||BigInt(page.Paging.NextOffset)<=BigInt(offset))throw new ToolError('ZHIHU_PAGING_INVALID',false)
    offset=String(page.Paging.NextOffset)
  }
  if(!entries.length)throw new ToolError('COLLECTION_EMPTY',false)
  const content=entries.map(e=>`## ${e.title}\n\n${e.summary||'未提供摘要'}\n\n${e.url}`).join('\n\n')
  if(content.length>2_000_000)throw new ToolError('ATTACHMENT_TEXT_SIZE',false)
  await ctx.store.commit(ctx.job,r=>({...r.body,status:'ready',entries,content,rawContent:content,bytes:Buffer.byteLength(content)}))
}
