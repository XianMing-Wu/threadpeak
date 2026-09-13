import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto'
import type { Sql } from './database.ts'
import { CommandError,digest } from './store.ts'
import type { ZhihuGate } from './zhihu-gate.ts'
import type { Fetcher } from './zhihu-data.ts'
import { ZhihuOAuthMock, isMockZhihuOwner, MOCK_ZHIHU_OWNER_PREFIX } from './zhihu-oauth-mock.ts'

export type ZhihuLoginConfig={mode?:'real'|'mock';appId:string;appKey:string;redirectUri:string;origin:string;tokenSecret:string;userInfoUrl:string;userIdPath:string;userNamePath?:string;userAvatarPath?:string;production:boolean}
// Official contract: https://www.zhihu.com/ring/moltbook/api/oauth/user_info
export const ZHIHU_USERINFO_URL='https://openapi.zhihu.com/user'
const processDemoSecret=randomBytes(32).toString('hex')
const validFieldPath=(path:string)=>/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(path)&&!path.split('.').some(key=>['__proto__','prototype','constructor'].includes(key))
const validToken=(token:unknown):token is string=>typeof token==='string'&&token.length>0&&token.length<=16384&&!/\s/.test(token)
export function loginConfig(env:Record<string,string|undefined>):ZhihuLoginConfig|undefined{
  const mode=env.ZHIHU_OAUTH_MODE?.trim()||'real'
  if(!['real','mock'].includes(mode))throw new Error('OAUTH_MODE_INVALID')
  if(mode==='mock'){
    if(env.NODE_ENV==='production'||process.env.NODE_ENV==='production')throw new Error('OAUTH_MOCK_FORBIDDEN_IN_PRODUCTION')
    const origin=new URL(env.THREADPEAK_PUBLIC_ORIGIN||'http://127.0.0.1:4304').origin
    const uri=new URL(env.ZHIHU_OAUTH_REDIRECT_URI||'/api/auth/zhihu/callback',origin)
    if(uri.origin!==origin||uri.pathname!=='/api/auth/zhihu/callback'||uri.search||uri.hash||uri.username||uri.password||!['http:','https:'].includes(uri.protocol))throw new Error('OAUTH_REDIRECT_INVALID')
    if(uri.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(uri.hostname))throw new Error('OAUTH_REDIRECT_INVALID')
    const tokenSecret=env.THREADPEAK_TOKEN_SECRET?.trim()||processDemoSecret
    if(tokenSecret.length<32)throw new Error('OAUTH_MOCK_KEY_INVALID')
    return {mode:'mock',appId:'threadpeak-local-demo',appKey:'',origin,redirectUri:uri.href,tokenSecret,userInfoUrl:'',userIdPath:'id',production:false}
  }
  const officialProfile=!env.ZHIHU_OAUTH_USERINFO_URL?.trim()||env.ZHIHU_OAUTH_USERINFO_URL.trim()===ZHIHU_USERINFO_URL
  const values=[env.ZHIHU_OAUTH_APP_ID,env.ZHIHU_OAUTH_APP_KEY,env.ZHIHU_OAUTH_REDIRECT_URI,env.ZHIHU_OAUTH_USERINFO_URL?.trim()||ZHIHU_USERINFO_URL,env.ZHIHU_OAUTH_USER_ID_PATH?.trim()||(officialProfile?'uid':undefined),env.THREADPEAK_TOKEN_SECRET||env.THREADPEAK_IDENTITY_SECRET]
  if(values.some(v=>!v?.trim()))return
  const [appId,appKey,redirectUri,userInfoUrl,userIdPath,tokenSecret]=values.map(value=>value!.trim())
  try{
    const uri=new URL(redirectUri!),info=new URL(userInfoUrl!),origin=new URL(env.THREADPEAK_PUBLIC_ORIGIN??uri.origin).origin
    if(uri.origin!==origin||uri.pathname!=='/api/auth/zhihu/callback'||uri.search||uri.hash||uri.username||uri.password||tokenSecret!.length<32)return
    if(uri.protocol!=='https:'&&!(uri.protocol==='http:'&&env.NODE_ENV!=='production'&&['localhost','127.0.0.1','[::1]'].includes(uri.hostname)))return
    // This endpoint and field mapping must come from the app's official user-info contract.
    if(info.origin!=='https://openapi.zhihu.com'||info.username||info.password||info.hash||info.search)return
    if(!validFieldPath(userIdPath!)||[env.ZHIHU_OAUTH_USER_NAME_PATH,env.ZHIHU_OAUTH_USER_AVATAR_PATH].some(path=>path&&!validFieldPath(path)))return
    return {mode:'real',appId:appId!,appKey:appKey!,redirectUri:redirectUri!,origin,tokenSecret:tokenSecret!,userInfoUrl:userInfoUrl!,userIdPath:userIdPath!,userNamePath:env.ZHIHU_OAUTH_USER_NAME_PATH||(officialProfile?'fullname':undefined),userAvatarPath:env.ZHIHU_OAUTH_USER_AVATAR_PATH||(officialProfile?'avatar_path':undefined),production:env.NODE_ENV==='production'}
  }catch{return}
}
const field=(object:any,path:string|undefined):unknown=>path?.split('.').reduce((value:any,key)=>value&&Object.hasOwn(value,key)?value[key]:undefined,object)
export const workspaceCookie=(token:string,seconds:number,secure:boolean)=>`tp_workspace=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`
export const oauthCookie=(binding:string,seconds:number,secure:boolean)=>`tp_zhihu_oauth=${binding}; Path=/api/auth/zhihu; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`
function publicAvatar(value:unknown){
  if(typeof value!=='string')return null
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.endsWith('.zhimg.com')&&!url.username&&!url.password&&!url.port?url.href:null}catch{return null}
}
export function sealToken(value:string,secret:string){
  const iv=randomBytes(12),key=createHash('sha256').update(secret).digest(),cipher=createCipheriv('aes-256-gcm',key,iv)
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()])
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`
}
export function unsealToken(value:string,secret:string){try{const [iv,data,tag]=value.split('.'),cipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(secret).digest(),Buffer.from(iv!,'base64url'));cipher.setAuthTag(Buffer.from(tag!,'base64url'));return Buffer.concat([cipher.update(Buffer.from(data!,'base64url')),cipher.final()]).toString('utf8')}catch{throw new CommandError('ZHIHU_REAUTHORIZE',401)}}
export class ZhihuLogin {
  readonly db:Sql;readonly config:ZhihuLoginConfig;readonly fetcher:Fetcher
  readonly gate?:ZhihuGate
  readonly mock?:ZhihuOAuthMock
  constructor(db:Sql,config:ZhihuLoginConfig,fetcher:Fetcher=fetch,gate?:ZhihuGate){this.gate=gate;this.db=db;this.config={...config,mode:config.mode??'real'};this.fetcher=fetcher;if(config.mode==='mock')this.mock=new ZhihuOAuthMock(config.tokenSecret,config.production)}
  async start(existingOwner?:string){
    // existingOwner is supplied only by the HTTP identity resolver, never query/body input.
    let subject:string|undefined
    if(this.mock&&existingOwner&&isMockZhihuOwner(existingOwner)){
      const [account]=await this.db.query<{token_cipher:string;profile:{demo?:boolean}}>('SELECT token_cipher,profile FROM tp_zhihu_accounts WHERE owner_id=$1',[existingOwner])
      if(!account?.profile.demo)throw new CommandError('ZHIHU_REAUTHORIZE',401)
      subject=this.mock.subjectForRenewal(unsealToken(account.token_cipher,this.config.tokenSecret))
      if(existingOwner!==`${MOCK_ZHIHU_OWNER_PREFIX}${digest({app:this.config.appId,id:subject})}`)throw new CommandError('ZHIHU_REAUTHORIZE',401)
    }
    const state=randomBytes(32).toString('hex'),binding=randomBytes(32).toString('hex')
    await this.db.query('DELETE FROM tp_oauth_attempts WHERE expires_at<$1',[Date.now()])
    await this.db.query('INSERT INTO tp_oauth_attempts(state_hash,binding_hash,expires_at) VALUES($1,$2,$3)',[digest(state),digest(binding),Date.now()+600_000])
    const url=new URL(this.mock?this.config.redirectUri:'https://openapi.zhihu.com/authorize')
    if(this.mock)url.searchParams.set('authorization_code',this.mock.authorize(state,subject))
    else {url.searchParams.set('app_id',this.config.appId);url.searchParams.set('redirect_uri',this.config.redirectUri);url.searchParams.set('response_type','code')}
    url.searchParams.set('state',state)
    return {authorizeUrl:url.href,cookie:oauthCookie(binding,600,this.config.redirectUri.startsWith('https:'))}
  }
  async discardAttempt(binding:string){
    if(/^[a-f0-9]{64}$/.test(binding))await this.db.query('DELETE FROM tp_oauth_attempts WHERE binding_hash=$1',[digest(binding)])
  }
  async callback(code:string,state:string,binding:string){
    if(!code||code.length>4096||!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(binding))throw new CommandError('OAUTH_STATE_INVALID',400)
    const rows=await this.db.query('DELETE FROM tp_oauth_attempts WHERE state_hash=$1 AND binding_hash=$2 AND expires_at>$3 RETURNING state_hash',[digest(state),digest(binding),Date.now()]);if(rows.length!==1)throw new CommandError('OAUTH_STATE_INVALID',400)
    const token=this.mock?this.mock.exchange(code,state):await this.exchangeRealCode(code)
    const profile=this.mock?this.mock.profile(token.access_token):await this.realProfile(token.access_token)
    const id=this.mock?field(profile,'id'):field(profile,this.config.userIdPath)
    if((typeof id!=='string'&&typeof id!=='number')||typeof id==='number'&&(!Number.isSafeInteger(id)||id<=0)||!String(id).trim()||String(id)!==String(id).trim()||String(id).length>240)throw new CommandError('OAUTH_PROFILE_FAILED',502)
    const name=field(profile,this.mock?'name':this.config.userNamePath),avatar=field(profile,this.config.userAvatarPath),owner=`${this.mock?MOCK_ZHIHU_OWNER_PREFIX:'account:zhihu:'}${digest({app:this.config.appId,id:String(id)})}`,expires=Date.now()+token.expires_in*1000
    const publicProfile={name:typeof name==='string'&&name.trim()?name.slice(0,200):'知乎用户',avatar:publicAvatar(avatar),demo:!!this.mock,mode:this.config.mode}
    const session=randomBytes(32).toString('hex')
    await this.db.transaction(async tx=>{
      await tx.query('INSERT INTO tp_zhihu_accounts(owner_id,token_cipher,token_expires_at,profile) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(owner_id) DO UPDATE SET token_cipher=EXCLUDED.token_cipher,token_expires_at=EXCLUDED.token_expires_at,profile=EXCLUDED.profile',[owner,sealToken(token.access_token,this.config.tokenSecret),expires,JSON.stringify(publicProfile)])
      await tx.query('INSERT INTO tp_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,$3)',[digest(session),owner,Date.now()+30*86400_000])
    })
    return workspaceCookie(session,30*86400,this.config.redirectUri.startsWith('https:'))
  }
  private async exchangeRealCode(code:string){
    // Never exchange a local demo token/code with a real provider after a mode change.
    if(code.startsWith('tp-demo.'))throw new CommandError('OAUTH_STATE_INVALID',400)
    const token=await this.requestJson('https://openapi.zhihu.com/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({app_id:this.config.appId,app_key:this.config.appKey,grant_type:'authorization_code',redirect_uri:this.config.redirectUri,code}),redirect:'error',signal:AbortSignal.timeout(20000)},'OAUTH_EXCHANGE_FAILED')
    if(!validToken(token.access_token)||!Number.isSafeInteger(token.expires_in)||token.expires_in<=0||!Number.isSafeInteger(Date.now()+token.expires_in*1000)||token.token_type!==undefined&&String(token.token_type).toLowerCase()!=='bearer')throw new CommandError('OAUTH_EXCHANGE_FAILED',502)
    return token as {access_token:string;expires_in:number}
  }
  private async realProfile(token:string){
    return this.requestJson(this.config.userInfoUrl,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(20000)},'OAUTH_PROFILE_FAILED')
  }
  private async requestJson(url:string,init:RequestInit,code:string){
    const work=async(signal:AbortSignal)=>{
      try{
        const response=await this.fetcher(url,{...init,signal})
        await this.gate?.observe(response)
        if(!response.ok){await response.body?.cancel();throw new CommandError(code,response.status===429?429:502)}
        const reader=response.body?.getReader();if(!reader)throw new CommandError(code,502)
        const chunks:Uint8Array[]=[];let size=0
        try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144)throw new CommandError(code,502);chunks.push(value)}}finally{await reader.cancel()}
        // Zhihu UIDs can exceed JavaScript's safe integer range. Node >=24
        // exposes the original JSON number so adjacent accounts never get rounded
        // into the same identity. Token expiry/error codes still require numbers.
        const result=JSON.parse(Buffer.concat(chunks).toString('utf8'),(_key,value,context?:{source?:string})=>
          typeof value==='number'&&!Number.isSafeInteger(value)&&context?.source&&/^[1-9]\d*$/.test(context.source)?context.source:value)
        // Zhihu can report business success as code=20000; require the actual
        // token/profile fields as well, and never interpret an error body as identity.
        if(!result||typeof result!=='object'||Array.isArray(result)||result.code!==undefined&&![0,20000].includes(result.code))throw new CommandError(code,502)
        return result
      }catch(error){if(error instanceof CommandError)throw error;throw new CommandError(code,502)}
    }
    try{return await (this.gate?this.gate.run(init.signal??undefined,work):work(init.signal??new AbortController().signal))}catch(error){if(error instanceof CommandError)throw error;throw new CommandError(code,502)}
  }
  async userToken(owner:string){
    if(owner.startsWith('local:')||owner.startsWith('guest:'))throw new CommandError('ZHIHU_LOGIN_REQUIRED',401)
    if(isMockZhihuOwner(owner)!==!!this.mock)throw new CommandError('ZHIHU_REAUTHORIZE',401)
    const [row]=await this.db.query<{token_cipher:string;token_expires_at:number}>('SELECT token_cipher,token_expires_at FROM tp_zhihu_accounts WHERE owner_id=$1',[owner])
    if(!row||row.token_expires_at<=Date.now())throw new CommandError('ZHIHU_REAUTHORIZE',401)
    const token=unsealToken(row.token_cipher,this.config.tokenSecret)
    if(this.mock)this.mock.profile(token)
    else if(!validToken(token)||token.startsWith('tp-demo.'))throw new CommandError('ZHIHU_REAUTHORIZE',401)
    return token
  }
}
