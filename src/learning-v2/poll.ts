export const POLL_INTERVAL_MS=1000
export function taskPollInterval(status?:string){return typeof document!=='undefined'&&document.hidden?30_000:status==='queued'||status==='running'?1000:5000}
/** Resume promptly on focus or a local command, without cancelling durable work. */
export function foregroundDelay(ms:number,signal?:AbortSignal):Promise<void>{
  if(typeof window==='undefined')return delay(ms,signal)
  return new Promise((resolve,reject)=>{
    let timer:ReturnType<typeof setTimeout>
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',visible);window.removeEventListener('threadpeak:resource-change',wake);signal?.removeEventListener('abort',abort)}
    const wake=()=>{cleanup();resolve()},visible=()=>{if(!document.hidden)wake()},abort=()=>{cleanup();reject(signal?.reason)}
    timer=setTimeout(wake,ms)
    if(signal?.aborted){abort();return}
    window.addEventListener('focus',wake);document.addEventListener('visibilitychange',visible);window.addEventListener('threadpeak:resource-change',wake);signal?.addEventListener('abort',abort,{once:true})
  })
}
export function delay(ms:number,signal?:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return}
    const done=()=>{signal?.removeEventListener('abort',abort);resolve()},timer=setTimeout(done,ms)
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason)}
    signal?.addEventListener('abort',abort,{once:true})
  })
}
/** One cancellable loop with bounded exponential reconnects. No task is cancelled. */
export async function pollResource(work:()=>Promise<boolean|void>,options:{signal:AbortSignal;onError?:(error:unknown,stopped:boolean)=>void;intervalMs?:number|(()=>number);wait?:typeof delay;maxFailures?:number}):Promise<void>{
  const wait=options.wait??delay;let failures=0
  while(!options.signal.aborted){
    try {if(await work()===false)return;failures=0}
    catch(error){
      if(options.signal.aborted)return
      failures++
      const status=(error as {status?:number})?.status
      const stopped=failures>=(options.maxFailures??6)||status===401||status===403||status===404
      options.onError?.(error,stopped)
      if(stopped)return
    }
    const interval=typeof options.intervalMs==='function'?options.intervalMs():options.intervalMs??POLL_INTERVAL_MS
    try{await wait(failures?Math.min(30_000,1000*2**(failures-1)):interval,options.signal)}catch{return}
  }
}
