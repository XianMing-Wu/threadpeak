import { z } from 'zod'
import type { Article } from '@threadpeak/contracts/learning-v2'
import { boundedSummary } from './context.ts'
import { CommandError, digest, type Resource } from './store.ts'
import { ToolError, type TaskContext } from './worker.ts'
import type { ProductTools } from './tools.ts'
import type { ZhihuDataClient } from './zhihu-data.ts'

export const MaterialEntrySchema=z.object({id:z.string(),title:z.string(),summary:z.string(),url:z.string().url(),authorId:z.string().nullable(),authorName:z.string().nullable(),authorUrl:z.string().url().optional(),likes:z.number().nullable()})
export type MaterialEntry=z.infer<typeof MaterialEntrySchema>
export type Material={fileName:string;mimeType:'application/pdf'|'text/markdown'|'text/plain';content:string;status:'processing'|'ready';origin:'upload'|'collection'|'creation';bytes:number;hash:string;rawContent?:string;entries?:MaterialEntry[];folderId?:string;recent?:boolean}
export function validateUpload(fileName:string,bytes:Buffer){
  const ext=fileName.toLowerCase().match(/\.(pdf|md|markdown|txt)$/)?.[1]
  if(!ext||!bytes.length)throw new CommandError('ATTACHMENT_INVALID',400)
  if(bytes.length>(ext==='pdf'?100:10)*1024*1024)throw new CommandError('ATTACHMENT_SIZE',400)
  if(ext==='pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new CommandError('ATTACHMENT_INVALID',400)
  return ext
}
export function textUpload(fileName:string,bytes:Buffer):Material{
  const ext=validateUpload(fileName,bytes)
  if(ext==='pdf')throw new CommandError('PDF_TASK_REQUIRED',400)
  let content:string;try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new CommandError('TEXT_ENCODING',422)}
  if(!content.trim())throw new CommandError('ATTACHMENT_EMPTY',422)
  if(content.length>2_000_000)throw new CommandError('ATTACHMENT_TEXT_SIZE',422)
  return {fileName,mimeType:ext==='txt'?'text/plain':'text/markdown',content,rawContent:content,status:'ready',origin:'upload',bytes:bytes.length,hash:digest(bytes.toString('base64'))}
}
export function materialView(record:Resource<Material>){const b=record.body;return {sourceId:record.id,fileName:b.fileName,mimeType:b.mimeType,content:b.status!=='processing'?b.content:'',status:b.status??'ready',origin:b.origin??'upload',count:b.entries?.length,bytes:b.bytes,folderId:b.folderId,recent:b.recent}}
/** Plan against parsed PDF text, then compress for the actual goal, never a generic upload summary. */
export function planningMaterial(record:Resource<Material>){
  const b=record.body,parsed=b.mimeType==='application/pdf'&&!!b.rawContent?.trim()
  return {...b,sourceId:record.id,rawContent:undefined,content:parsed?b.rawContent!:b.content,
    contentBasis:parsed?'parsed_document':b.mimeType==='application/pdf'||b.origin!=='upload'?'source_summary':'source_text'}
}
export function inheritedArticles(attachments:any[]):Article[]{
  const articles:Article[]=[]
  for(const a of attachments){
    if(a.entries?.length){for(const entry of a.entries as MaterialEntry[])articles.push({id:`material-${digest({sourceId:a.sourceId,url:entry.url}).slice(0,32)}`,title:entry.title,summary:entry.summary||'该收藏内容未提供摘要，可阅读原文。',author:entry.authorName??'知乎收藏',authorId:entry.authorId,authorUrl:entry.authorUrl,likes:entry.likes,url:entry.url,topic:a.fileName,sourceKind:a.origin==='creation'?'creation':'collection',materialId:a.sourceId})}
    else articles.push({id:`material-${a.sourceId}`,title:a.fileName,summary:a.content,author:'我的资料',authorId:null,likes:null,topic:a.mimeType==='application/pdf'?(a.contentBasis==='parsed_document'?'PDF 正文':'PDF 总结'):'上传文件',sourceKind:'upload',materialId:a.sourceId})
  }
  return articles
}
const pause=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal.reason)};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve()},1500);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop()})
export async function preparePdf(ctx:TaskContext,tools:ProductTools,api:ZhihuDataClient){
  const resource=await ctx.store.resource<Material>(ctx.job.owner_id,ctx.job.resource_id),meta=resource.body
  if(meta.status==='ready'){await ctx.store.commit(ctx.job,r=>r.body);return}
  await ctx.progress('正在上传 PDF')
  const uploaded=await ctx.step('PDF-upload',{hash:meta.hash},async()=>{
    const [row]=await ctx.store.db.query<{base64:string}>('SELECT base64 FROM tp_material_uploads WHERE resource_id=$1',[resource.id]);if(!row)throw new ToolError('PDF_UPLOAD_MISSING',false)
    const form=new FormData();form.append('file',new Blob([Buffer.from(row.base64,'base64')],{type:'application/pdf'}),meta.fileName)
    const data=await api.json('/resources/v1/files',{form,signal:ctx.signal});if(typeof data.file_id!=='string')throw new ToolError('PDF_UPLOAD_INVALID');return data.file_id as string
  })
  await ctx.store.db.query('DELETE FROM tp_material_uploads WHERE resource_id=$1',[resource.id])
  await ctx.progress('正在解析 PDF')
  const taskId=await ctx.step('PDF-task',{fileId:uploaded},async()=>{const data=await api.json('/api/v1/pdf-parse/tasks',{body:{file_id:uploaded},key:`threadpeak-pdf-${resource.id}`,signal:ctx.signal});if(typeof data.task_id!=='string')throw new ToolError('PDF_TASK_INVALID');return data.task_id as string})
  const parsed=await ctx.step('PDF-content',{taskId},async()=>{
    const until=Date.now()+20*60_000
    while(Date.now()<until){
      ctx.signal.throwIfAborted();const state=await api.json(`/api/v1/pdf-parse/tasks/${encodeURIComponent(taskId)}`,{signal:ctx.signal})
      if(state.task_status==='failed')throw new ToolError('PDF_PARSE_FAILED',false)
      if(state.task_status==='succeeded'){
        if(typeof state.result?.url!=='string')throw new ToolError('PDF_RESULT_INVALID')
        const raw=await api.pdfResult(state.result.url,ctx.signal)
        if(!Array.isArray(raw.pages))throw new ToolError('PDF_RESULT_INVALID')
        const content=raw.pages.map((p:any)=>Array.isArray(p.blocks)?p.blocks.map((b:any)=>typeof b.content==='string'?b.content:'').filter(Boolean).join('\n\n'):'').filter(Boolean).join('\n\n')
        const summary=typeof state.result.summary==='string'?state.result.summary.trim():''
        if(!content.trim()&&!summary)throw new ToolError('PDF_UNREADABLE',false)
        if(content.length>2_000_000)throw new ToolError('ATTACHMENT_TEXT_SIZE',false)
        return {content,summary}
      }
      if(!['pending','running'].includes(state.task_status))throw new ToolError('PDF_STATE_INVALID')
      await ctx.progress(`正在解析 PDF${Number.isFinite(state.progress)?` · ${Math.round(Math.max(0,Math.min(1,state.progress))*100)}%`:''}`);await pause(ctx.signal)
    }
    throw new ToolError('PDF_STILL_PROCESSING')
  })
  await ctx.progress('正在整理 PDF 总结')
  const summary=parsed.summary||await boundedSummary(tools.llm,ctx,parsed.content,`${resource.id}:${meta.fileName}`,12000,ctx.job.input.depth??'fast',tools.window)
  await ctx.flush();await ctx.store.commit(ctx.job,async(r,tx)=>{await tx.query('DELETE FROM tp_material_uploads WHERE resource_id=$1',[r.id]);return {...r.body,content:summary,rawContent:parsed.content,status:'ready'}})
}
