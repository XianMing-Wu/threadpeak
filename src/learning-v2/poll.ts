export const POLL_INTERVAL_MS=1000
export function delay(ms:number,signal?:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return}
    const done=()=>{signal?.removeEventListener('abort',abort);resolve()},timer=setTimeout(done,ms)
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason)}
    signal?.addEventListener('abort',abort,{once:true})
  })
}
/** One cancellable loop with bounded exponential reconnects. No task is cancelled. */
export async function pollResource(work:()=>Promise<boolean|void>,options:{signal:AbortSignal;onError?:(error:unknown,stopped:boolean)=>void;intervalMs?:number;wait?:typeof delay;maxFailures?:number}):Promise<void>{
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
    try{await wait(failures?Math.min(30_000,1000*2**(failures-1)):options.intervalMs??POLL_INTERVAL_MS,options.signal)}catch{return}
  }
}
