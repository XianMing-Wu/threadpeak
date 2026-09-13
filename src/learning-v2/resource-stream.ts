/** SSE is an acceleration channel; the existing durable poll recovers missed events. */
export function observeResource(id:string,options:{signal:AbortSignal;afterData?:number;onSnapshot?:(value:unknown)=>void;onChange?:()=>void}){
  if(typeof EventSource==='undefined')return {close:()=>{},connected:()=>false}
  let online=false,closed=false
  const params=new URLSearchParams(options.onSnapshot?{afterData:String(options.afterData??0)}:{mode:'signal'})
  const source=new EventSource(`/api/v2/resources/${encodeURIComponent(id)}/stream?${params}`)
  source.onopen=()=>{online=true}
  source.onerror=()=>{online=false}
  source.onmessage=event=>{
    if(closed||options.signal.aborted)return
    try{const value=JSON.parse(event.data);options.onSnapshot?.(value);options.onChange?.()}catch{/* The next durable poll recovers a malformed or incomplete event. */}
  }
  const close=()=>{if(closed)return;closed=true;online=false;source.close();options.signal.removeEventListener('abort',close)}
  if(options.signal.aborted)close();else options.signal.addEventListener('abort',close,{once:true})
  return {close,connected:()=>online}
}
