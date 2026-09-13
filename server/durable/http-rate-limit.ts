import type {Sql} from './database.ts'
import {CommandError,digest} from './store.ts'

type Result={current:number;ttl:number}
type Callback=(error:Error|null,result?:Result)=>void
/** Fixed windows use database time and an atomic UPSERT across all API replicas. */
export function sharedHttpRateLimitStore(db:Sql){
  return class SharedHttpRateLimitStore {
    child(){return new SharedHttpRateLimitStore()}
    incr(key:string,callback:Callback,timeWindow:number){
      const bucket=digest({namespace:'http-v1',key,timeWindow})
      let settled=false
      const finish:Callback=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);callback(error,result)}
      // A broken database connection must not hang readiness or hold incoming
      // request bodies while the driver reconnects. Late results cannot admit
      // an already rejected request or invoke Fastify's callback twice.
      const timer=setTimeout(()=>finish(new CommandError('HTTP_LIMIT_UNAVAILABLE',503)),2500)
      void db.query<Result>(`INSERT INTO tp_http_limits AS bucket (key,hits,expires_at)
        VALUES($1,1,(extract(epoch FROM clock_timestamp())*1000)::bigint+$2)
        ON CONFLICT(key) DO UPDATE SET
          hits=CASE WHEN bucket.expires_at<=EXCLUDED.expires_at-$2 THEN 1 ELSE LEAST(bucket.hits+1,2147483647) END,
          expires_at=CASE WHEN bucket.expires_at<=EXCLUDED.expires_at-$2 THEN EXCLUDED.expires_at ELSE bucket.expires_at END
        RETURNING hits AS current,GREATEST(0,expires_at-(extract(epoch FROM clock_timestamp())*1000)::bigint) AS ttl`,[bucket,timeWindow])
        .then(rows=>finish(null,rows[0]!)).catch(()=>finish(new CommandError('HTTP_LIMIT_UNAVAILABLE',503)))
    }
  }
}
