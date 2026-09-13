import {Readable} from 'node:stream'
import type {FastifyInstance,FastifyRequest} from 'fastify'
import {CommandError,type DurableStore} from './store.ts'

/** Bounded live transport. Durable snapshots remain the recovery authority. */
export function registerResourceStream(app:FastifyInstance,store:DurableStore,owner:(r:FastifyRequest)=>string){
  const counts=new Map<string,number>(),closers=new Set<()=>void>()
  app.addHook('preClose',async()=>{for(const close of closers)close()})
  app.get('/api/v2/resources/:id/stream',async(request,reply)=>{
    const own=owner(request),id=(request.params as {id:string}).id
    await store.resource(own,id)
    if((counts.get(own)??0)>=4||closers.size>=400)throw new CommandError('STREAM_LIMIT',429)
    counts.set(own,(counts.get(own)??0)+1)
    const query=request.query as {mode?:string;afterData?:string},signalOnly=query.mode==='signal'
    let dataRevision=query.afterData===undefined?undefined:Number(query.afterData)||0,closed=false,pending=false,reading=false,blocked=false
    let timer:ReturnType<typeof setTimeout>|undefined
    const stream=new Readable({highWaterMark:64*1024,read(){blocked=false;if(pending)schedule()}})
    const write=(value:string)=>{if(!closed)blocked=!stream.push(value)}
    const refresh=async()=>{
      timer=undefined
      if(closed||blocked||reading)return
      pending=false;reading=true
      try{
        if(signalOnly)write('data: {}\n\n')
        else {
          const snapshot=await store.snapshot(own,id,dataRevision)
          if(closed)return
          dataRevision=snapshot.dataRevision
          write(`data: ${JSON.stringify(snapshot)}\n\n`)
        }
      }catch{close()}
      finally{reading=false;if(pending)schedule()}
    }
    function schedule(){pending=true;if(!closed&&!blocked&&!reading&&!timer)timer=setTimeout(()=>void refresh(),100)}
    const unsubscribe=store.onChange((changedOwner,changedId)=>{if(changedOwner===own&&changedId===id)schedule()})
    const heartbeat=setInterval(()=>{if(!blocked)write(': keepalive\n\n')},15000)
    // Reconnect periodically to revalidate the authenticated session.
    const lifetime=setTimeout(()=>close(),60000)
    function close(){if(closed)return;closed=true;clearTimeout(timer);clearTimeout(lifetime);clearInterval(heartbeat);unsubscribe();closers.delete(close);const left=(counts.get(own)??1)-1;if(left)counts.set(own,left);else counts.delete(own);stream.push(null)}
    closers.add(close);stream.once('close',close);reply.raw.once('close',close)
    reply.header('Content-Type','text/event-stream').header('Cache-Control','no-store').header('X-Accel-Buffering','no')
    write(': connected\n\n');schedule()
    return reply.send(stream)
  })
}
