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
function cookie(request:FastifyRequest,name='tp_workspace'){return request.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1)}
export const isGuestOwner=(owner:string)=>owner.startsWith('guest:')||owner.startsWith('local:')
export function createIdentity(store:DurableStore,config:IdentityConfig){
  if(config.origin)config={...config,origin:new URL(config.origin).origin}
  function checkOrigin(request:FastifyRequest){
    if(request.headers.origin&&config.origin&&request.headers.origin!==config.origin||request.headers['sec-fetch-site']==='cross-site')throw new CommandError('ORIGIN_DENIED',403)
  }
  const cookieValue=(name:string,token:string,days:number)=>`${name}=${token}; Path=/; HttpOnly;${config.production?' Secure;':''} SameSite=Lax; Max-Age=${days*86400}`
  async function lookup(token:string|undefined,recovery=false){
    if(!token||!/^[a-f0-9]{64}$/.test(token))return undefined
    const [session]=await store.db.query<{owner_id:string}>('SELECT owner_id FROM tp_sessions WHERE token_hash=$1 AND expires_at>$2',[digest(recovery?`guest-recovery:${token}`:token),Date.now()])
    return session?.owner_id
  }
  return {
    async logout(request:FastifyRequest,reply:FastifyReply,owner:string){
      const cookies=[cookieValue('tp_workspace','',0)]
      // Upgrade an existing local workspace before revoking its only active token.
      if(isGuestOwner(owner)&&await lookup(cookie(request,'tp_guest'),true)!==owner){
        const restore=randomBytes(32).toString('hex')
        await store.db.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[digest(`guest-recovery:${restore}`),owner,Date.now()+90*86400_000])
        cookies.push(cookieValue('tp_guest',restore,90))
      }
      const token=cookie(request)
      if(token)await store.db.query('DELETE FROM tp_sessions WHERE token_hash=$1',[digest(token)])
      reply.header('Set-Cookie',cookies)
      return {kind:'anonymous'}
    },
    async startGuest(request:FastifyRequest,reply:FastifyReply){
      checkOrigin(request)
      const active=await lookup(cookie(request)),recoveryToken=cookie(request,'tp_guest'),recovered=await lookup(recoveryToken,true)
      // Keep legacy local workspaces and guest drafts; never adopt a Zhihu account.
      const owner=active&&isGuestOwner(active)?active:recovered&&isGuestOwner(recovered)?recovered:`guest:${randomUUID()}`
      const fresh=randomBytes(32).toString('hex'),restore=recovered===owner?recoveryToken!:randomBytes(32).toString('hex')
      await store.db.transaction(async tx=>{
        await tx.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[digest(fresh),owner,Date.now()+30*86400_000])
        await tx.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3) ON CONFLICT(token_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at',[digest(`guest-recovery:${restore}`),owner,Date.now()+90*86400_000])
        if(active&&isGuestOwner(active))await tx.query('DELETE FROM tp_sessions WHERE token_hash=$1',[digest(cookie(request))])
      })
      reply.header('Set-Cookie',[cookieValue('tp_workspace',fresh,30),cookieValue('tp_guest',restore,90)])
      return {kind:'guest',provider:null,capabilities:{zhihuMaterials:false}}
    },
    async resolve(request:FastifyRequest,reply:FastifyReply):Promise<string>{
      checkOrigin(request)
      if(config.production){
        const token=request.headers.authorization?.replace(/^Bearer /,'')
        const stored=cookie(request)
        if(!token&&stored){const owner=await lookup(stored);if(owner&&(owner.startsWith('account:')||owner.startsWith('guest:')))return owner}
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
      throw new CommandError('UNAUTHENTICATED',401)
    },
  }
}
