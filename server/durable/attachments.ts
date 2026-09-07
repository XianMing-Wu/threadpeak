import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { CommandError } from './store.ts'

const run=promisify(execFile)
export async function extractAttachment(fileName:string,base64:string):Promise<{content:string;mimeType:string;bytes:number}>{
  const extension=fileName.toLowerCase().match(/\.(pdf|md|txt)$/)?.[1]
  if(!extension||!base64||!/^[A-Za-z\d+/]*={0,2}$/.test(base64))throw new CommandError('ATTACHMENT_INVALID',400)
  const bytes=Buffer.from(base64,'base64')
  if(!bytes.length||bytes.length>10*1024*1024)throw new CommandError('ATTACHMENT_SIZE',400)
  let content:string
  if(extension==='pdf'){
    if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new CommandError('ATTACHMENT_INVALID',400)
    const directory=await mkdtemp(join(tmpdir(),'threadpeak-pdf-'))
    try{
      const input=join(directory,'input.pdf'),output=join(directory,'output.txt')
      await writeFile(input,bytes,{mode:0o600})
      // A fixed executable and argument vector: uploaded file names never become shell code.
      await run('pdftotext',['-enc','UTF-8','-layout',input,output],{timeout:30_000,maxBuffer:1024*1024})
      content=await readFile(output,'utf8')
    }catch{throw new CommandError('PDF_UNREADABLE',422)}
    finally{await rm(directory,{recursive:true,force:true})}
  }else{
    try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new CommandError('TEXT_ENCODING',422)}
  }
  if(!content.trim())throw new CommandError('ATTACHMENT_EMPTY',422)
  if(content.length>2_000_000)throw new CommandError('ATTACHMENT_TEXT_SIZE',422)
  return {content,mimeType:extension==='pdf'?'application/pdf':extension==='md'?'text/markdown':'text/plain',bytes:bytes.length}
}
