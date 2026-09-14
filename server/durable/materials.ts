import { z } from 'zod'
import type { Article } from '@threadpeak/contracts/learning-v2'
import { boundedSummary } from './context.ts'
import { CommandError, digest, type Resource } from './store.ts'
import { ToolError, type TaskContext } from './worker.ts'
import type { ProductTools } from './tools.ts'
import type { ZhihuDataClient } from './zhihu-data.ts'
import { withPermit } from './limits.ts'
import { pdfText } from './pdf-text.ts'

export const MaterialEntrySchema=z.object({id:z.string(),title:z.string(),summary:z.string(),url:z.string().url(),authorId:z.string().nullable(),authorName:z.string().nullable(),authorUrl:z.string().url().optional(),likes:z.number().nullable()})
export type MaterialEntry=z.infer<typeof MaterialEntrySchema>
export type Material={fileName:string;mimeType:'application/pdf'|'text/markdown'|'text/plain';content:string;status:'processing'|'ready';origin:'upload'|'collection'|'creation';bytes:number;hash:string;rawContent?:string;entries?:MaterialEntry[];folderId?:string;recent?:boolean;parseNotice?:string}
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
export function materialView(record:Resource<Material>){const b=record.body;return {sourceId:record.id,fileName:b.fileName,mimeType:b.mimeType,content:b.status!=='processing'?b.content:'',status:b.status??'ready',origin:b.origin??'upload',count:b.entries?.length,bytes:b.bytes,folderId:b.folderId,recent:b.recent,notice:b.parseNotice}}
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
    else articles.push({id:`material-${a.sourceId}`,title:a.fileName,summary:a.parseNotice?`${a.parseNotice}\n\n${a.content}`:a.content,author:'我的资料',authorId:null,likes:null,topic:a.mimeType==='application/pdf'?(a.contentBasis==='parsed_document'?'PDF 正文':'PDF 总结'):'上传文件',sourceKind:'upload',materialId:a.sourceId})
  }
  return articles
}
const pause=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(signal.reason)};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve()},1500);signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop()})
export async function preparePdf(ctx:TaskContext,tools:ProductTools,api:ZhihuDataClient){
  const resource=await ctx.store.resource<Material>(ctx.job.owner_id,ctx.job.resource_id),meta=resource.body
  if(meta.status==='ready'){await ctx.store.commit(ctx.job,r=>r.body);return}
  const localText=()=>ctx.step('PDF-local-text:v1',{hash:meta.hash},()=>withPermit(ctx.store.db,'pdf-upload-memory',1,ctx.signal,async signal=>{
    const [row]=await ctx.store.db.query<{base64:string}>('SELECT base64 FROM tp_material_uploads WHERE resource_id=$1',[resource.id])
    return row?pdfText(Buffer.from(row.base64,'base64'),signal):''
  },{queueTimeoutMs:10*60_000}))
  const original=await localText()
  const localResult=()=>({content:original,summary:'',textSource:'local-text',notice:'当前使用 PDF 中可提取的文字；图片、扫描页和版面公式可能未识别，需对照原文件核实。'})
  const remote=async():Promise<{content:string;summary:string;textSource:string;notice?:string}>=>{
  await ctx.progress('正在上传 PDF')
  // file_id expires after 24 hours. Keep original bytes until the final commit;
  // a resumed upload without a created parse task can then renew its file_id.
  const checkpoints=ctx.job.checkpoints
  const legacy=!!checkpoints['PDF-upload']&&!Object.keys(checkpoints).some(k=>k.startsWith('PDF-upload:v2:'))
  let generation=Math.max(0,...Object.keys(checkpoints).map(k=>/^PDF-upload:v2:(\d+)$/.exec(k)?.[1]).filter(Boolean).map(Number))
  const latest=checkpoints[`PDF-upload:v2:${generation}`]?.value as {createdAt:number}|undefined
  if(latest&&!checkpoints[`PDF-task:v2:${generation}`]&&Date.now()-latest.createdAt>=23*3600_000)generation++
  const uploadKey=legacy?'PDF-upload':`PDF-upload:v2:${generation}`
  const uploaded=await ctx.step<string|{fileId:string;createdAt:number}>(uploadKey,{hash:meta.hash},()=>withPermit(ctx.store.db,'pdf-upload-memory',1,ctx.signal,async signal=>{
    const [row]=await ctx.store.db.query<{base64:string}>('SELECT base64 FROM tp_material_uploads WHERE resource_id=$1',[resource.id]);if(!row)throw new ToolError('PDF_UPLOAD_MISSING',false)
    const form=new FormData();form.append('file',new Blob([Buffer.from(row.base64,'base64')],{type:'application/pdf'}),meta.fileName)
    const data=await api.json('/resources/v1/files',{form,signal});if(typeof data.file_id!=='string'||!data.file_id.trim())throw new ToolError('PDF_UPLOAD_INVALID');return {fileId:data.file_id as string,createdAt:Date.now()}
  },{queueTimeoutMs:10*60_000}))
  const fileId=typeof uploaded==='string'?uploaded:uploaded.fileId
  await ctx.progress('正在解析 PDF')
  const taskId=await ctx.step(legacy?'PDF-task':`PDF-task:v2:${generation}`,{fileId},async()=>{const data=await api.json('/api/v1/pdf-parse/tasks',{body:{file_id:fileId},key:`threadpeak-pdf-${resource.id}${legacy?'':`-v2-${generation}`}`,signal:ctx.signal});if(typeof data.task_id!=='string'||!data.task_id.trim())throw new ToolError('PDF_TASK_INVALID');return data.task_id as string})
  const parsed=await ctx.step(legacy?'PDF-content':`PDF-content:v2:${generation}`,{taskId},async()=>{
    const started=Date.now(),until=started+20*60_000
    while(Date.now()<until){
      ctx.signal.throwIfAborted();const state=await api.json(`/api/v1/pdf-parse/tasks/${encodeURIComponent(taskId)}`,{signal:ctx.signal})
      if(state.task_status==='failed')throw new ToolError('PDF_PARSE_FAILED',false)
      if(state.task_status==='succeeded'){
        if(typeof state.result?.url!=='string')throw new ToolError('PDF_RESULT_INVALID')
        const raw=await api.pdfResult(state.result.url,ctx.signal)
        if(!Array.isArray(raw.pages))throw new ToolError('PDF_RESULT_INVALID')
        const blocks:string[]=raw.pages.flatMap((p:any)=>Array.isArray(p.blocks)?p.blocks.map((b:any)=>typeof b.content==='string'?b.content:'').filter(Boolean):[])
        let content=blocks.join('\n\n'),textSource='zhihu'
        if(content.length>2_000_000)throw new ToolError('ATTACHMENT_TEXT_SIZE',false)
        // A non-empty remote result can still omit titles or entire text blocks.
        // Keep the PDF text layer intact, then retain remote OCR/math blocks
        // absent from it. Compare whitespace only; never erase math operators.
        await ctx.progress('正在核对 PDF 正文')
        if(original.trim()){
          const compact=original.replace(/\s+/g,''),extra=blocks.filter(block=>!compact.includes(block.replace(/\s+/g,'')))
          content=original+(extra.length?'\n\n## 版面识别补充\n\n'+extra.join('\n\n'):'')
          textSource=extra.length?'local-text+zhihu':'local-text'
        }
        const summary=typeof state.result.summary==='string'?state.result.summary.trim():''
        if(!content.trim()&&!summary)throw new ToolError('PDF_UNREADABLE',false)
        if(content.length>2_000_000)throw new ToolError('ATTACHMENT_TEXT_SIZE',false)
        return {content,summary,textSource}
      }
      if(!['pending','running'].includes(state.task_status))throw new ToolError('PDF_STATE_INVALID')
      if(original.trim().length>=80&&Date.now()-started>=90_000)return localResult()
      await ctx.progress(`正在解析 PDF${Number.isFinite(state.progress)?` · ${Math.round(Math.max(0,Math.min(1,state.progress))*100)}%`:''}`);await pause(ctx.signal)
    }
    throw new ToolError('PDF_STILL_PROCESSING')
  })
  return parsed
  }
  let parsed:{content:string;summary:string;textSource:string;notice?:string}
  try{parsed=await remote()}catch(error){
    ctx.signal.throwIfAborted()
    const code=error instanceof ToolError?error.code:''
    if(original.trim().length<80||!(/^(PDF_(PARSE_FAILED|RESULT_INVALID|STATE_INVALID|STILL_PROCESSING|RESULT_EXPIRED)|NETWORK_UNAVAILABLE|PROVIDER_TIMEOUT|ZHIHU_HTTP_5\d\d)$/.test(code)))throw error
    parsed=localResult()
  }
  await ctx.progress('正在整理 PDF 总结')
  const summary=parsed.summary||await boundedSummary(tools.llm,ctx,parsed.content,`${resource.id}:${meta.fileName}`,12000,ctx.job.input.depth??'fast',tools.window,undefined,tools.capabilities.llm)
  await ctx.flush();await ctx.store.commit(ctx.job,async(r,tx)=>{await tx.query('DELETE FROM tp_material_uploads WHERE resource_id=$1',[r.id]);return {...r.body,content:summary,rawContent:parsed.content,parseNotice:parsed.notice,status:'ready'}})
}
