import { execFile } from 'node:child_process'
import { ToolError } from './worker.ts'

/** Bounded text extraction when the remote parser omits a PDF's text layer. */
export function pdfText(bytes:Buffer,signal:AbortSignal):Promise<string> {
  signal.throwIfAborted()
  return new Promise((resolve,reject)=>{
    const child=execFile('pdftotext',['-q','-enc','UTF-8','-','-'],{
      signal,timeout:45_000,killSignal:'SIGKILL',maxBuffer:8*1024*1024,encoding:'utf8',
    },(error,stdout)=>{
      if(signal.aborted){reject(signal.reason);return}
      if(error){
        if(error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'){reject(new ToolError('ATTACHMENT_TEXT_SIZE',false));return}
        // No text layer, unsupported/encrypted PDF, or an unavailable local
        // extractor is not a successful parse. The caller keeps the safe error.
        resolve('');return
      }
      const text=stdout.replace(/\f/g,'\n\n').trim()
      if(text.length>2_000_000){reject(new ToolError('ATTACHMENT_TEXT_SIZE',false));return}
      resolve(text)
    })
    // A malformed file can make the extractor close stdin before all bytes
    // arrive. The process callback, not an unhandled EPIPE, owns the outcome.
    child.stdin?.on('error',()=>{})
    child.stdin?.end(bytes)
  })
}
