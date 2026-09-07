import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { CommandError, digest, type DurableStore } from './store.ts'

export type IdentityConfig = { production:boolean; origin?:string; jwtSecret?:string; issuer?:string; audience?:string; loginUrl?:string }
export function verifyIdentityToken(token:string,config:IdentityConfig,now=Date.now()):string {
  if(!config.jwtSecret||config.jwtSecret.length<32||!config.issuer||!config.audience)throw new CommandError('AUTH_NOT_CONFIGURED',503)
  try {
    const [h,p,s,...rest]=token.split('.')
    if(!h||!p||!s||rest.length)throw new Error()
    const header=JSON.parse(Buffer.from(h,'base64url').toString()),payload=JSON.parse(Buffer.from(p,'base64url').toString())
    if(header.alg!=='HS256'||header.typ!=='JWT')throw new Error()
    const actual=Buffer.from(s,'base64url'),expected=createHmac('sha256',config.jwtSecret).update(`${h}.${p}`).digest()
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error()
    if(payload.iss!==config.issuer||payload.aud!==config.audience||typeof payload.sub!=='string'||!payload.sub.trim()||payload.sub.length>200||!Number.isFinite(payload.exp)||payload.exp*1000<=now)throw new Error()
    if(payload.nbf!==undefined&&(!Number.isFinite(payload.nbf)||payload.nbf*1000>now+30_000))throw new Error()
    return `account:${digest({issuer:config.issuer,subject:payload.sub})}`
  }catch{throw new CommandError('UNAUTHENTICATED',401)}
}
function cookie(request:FastifyRequest){return request.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('tp_workspace='))?.slice(13)}
export function createIdentity(store:DurableStore,config:IdentityConfig){
  return {
    async resolve(request:FastifyRequest,reply:FastifyReply):Promise<string>{
      const origin=request.headers.origin
      if(origin && config.origin && origin!==config.origin)throw new CommandError('ORIGIN_DENIED',403)
      if(request.headers['sec-fetch-site']==='cross-site')throw new CommandError('ORIGIN_DENIED',403)
      if(config.production){
        const token=request.headers.authorization?.replace(/^Bearer /,'')
        const stored=cookie(request)
        if(!token&&stored&&/^[a-f0-9]{64}$/.test(stored)){const [session]=await store.db.query<{owner_id:string}>('SELECT owner_id FROM tp_sessions WHERE token_hash=$1 AND expires_at>$2',[digest(stored),Date.now()]);if(session?.owner_id.startsWith('account:'))return session.owner_id}
        if(!token)throw new CommandError('UNAUTHENTICATED',401)
        const owner=verifyIdentityToken(token,config)
        // A trusted login callback or gateway presents the signed token. Browser JS never stores it.
        if(request.url.split('?')[0]==='/api/v2/session'){
          const fresh=randomBytes(32).toString('hex')
          await store.db.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[digest(fresh),owner,Math.min(Date.now()+3_600_000,JSON.parse(Buffer.from(token.split('.')[1]!,'base64url').toString()).exp*1000)])
          reply.header('Set-Cookie',`tp_workspace=${fresh}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`)
        }
        return owner
      }
      const token=cookie(request)
      if(token&&/^[a-f0-9]{64}$/.test(token)){
        const [session]=await store.db.query<{owner_id:string}>('SELECT owner_id FROM tp_sessions WHERE token_hash=$1 AND expires_at>$2',[digest(token),Date.now()])
        if(session)return session.owner_id
      }
      if(!['/api/v2/session','/api/auth/session'].includes(request.url.split('?')[0]!))throw new CommandError('UNAUTHENTICATED',401)
      const fresh=randomBytes(32).toString('hex'),owner=`local:${randomUUID()}`,expires=Date.now()+30*86400_000
      await store.db.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[digest(fresh),owner,expires])
      reply.header('Set-Cookie',`tp_workspace=${fresh}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`)
      return owner
    },
  }
}
