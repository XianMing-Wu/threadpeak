import assert from 'node:assert/strict'
import test from 'node:test'
import { openDatabase, migrate } from './database.ts'
import { DurableStore } from './store.ts'
import { DurableWorker } from './worker.ts'
import { createProductApp } from './http.ts'
import { ZhihuLogin, loginConfig, unsealToken } from './zhihu-oauth.ts'
import { ZhihuDataClient } from './zhihu-data.ts'
import { createZhihuGate } from './zhihu-gate.ts'

const secret='test-only-oauth-encryption-key-32-characters'
const env={ZHIHU_OAUTH_APP_ID:'test-app',ZHIHU_OAUTH_APP_KEY:'test-app-key',ZHIHU_OAUTH_REDIRECT_URI:'https://threadpeak.test/api/auth/zhihu/callback',THREADPEAK_PUBLIC_ORIGIN:'https://threadpeak.test',THREADPEAK_TOKEN_SECRET:secret,NODE_ENV:'production'}
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
const cookieOf=(response,name)=>[response.headers['set-cookie']].flat().find(value=>value?.startsWith(`${name}=`))?.split(';')[0]

async function fixture(t,options={}){
  const db=await openDatabase();await migrate(db)
  const calls=[],gate=createZhihuGate(db,0),store=new DurableStore(db)
  const fetcher=async(url,init)=>{
    calls.push({url:String(url),init})
    if(String(url).endsWith('/access_token'))return options.exchange?options.exchange(init):json({code:20000,access_token:`user-token-${init.body.get('code')}`,token_type:'bearer',expires_in:3600})
    if(String(url)==='https://openapi.zhihu.com/user')return options.profile?options.profile(init):json({uid:init.headers.Authorization.endsWith('-b')?1002:1001,fullname:'同名用户',avatar_path:'https://picx.zhimg.com/avatar.jpg',phone_no:'test-phone-private',email:'test-private@example.test'})
    return options.data?options.data(init):json({Code:0,Data:{Items:[{UrlToken:123,Title:'我的公开收藏',IsPublic:true,Url:'https://www.zhihu.com/collection/123'}]}})
  }
  const login=new ZhihuLogin(db,loginConfig(env),fetcher,gate),data=new ZhihuDataClient('test-platform-key',fetcher,undefined,undefined,gate)
  const worker=new DurableWorker(store,async()=>{},1,()=>{}),app=await createProductApp({store,worker,identity:{production:true,origin:env.THREADPEAK_PUBLIC_ORIGIN},providersReady:true,zhihuLogin:login,zhihuData:data})
  t.after(async()=>{await app.close();await db.close()})
  async function start(){
    const response=await app.inject({url:'/api/auth/zhihu/start'});assert.equal(response.statusCode,200)
    const url=new URL(response.json().authorizeUrl)
    return {state:url.searchParams.get('state'),cookie:cookieOf(response,'tp_zhihu_oauth'),response,url}
  }
  async function complete(attempt,code='a',codeKey='authorization_code'){
    return app.inject({url:`/api/auth/zhihu/callback?${new URLSearchParams({[codeKey]:code,state:attempt.state})}`,headers:{cookie:attempt.cookie}})
  }
  return {db,app,store,login,calls,start,complete}
}

test('real configuration uses the documented user endpoint and stable uid; malformed destinations fail closed',()=>{
  const config=loginConfig(env)
  assert.equal(config.userInfoUrl,'https://openapi.zhihu.com/user');assert.equal(config.userIdPath,'uid')
  assert.equal(config.userNamePath,'fullname');assert.equal(config.userAvatarPath,'avatar_path')
  assert.equal(config.mode,'real')
  for(const change of [
    {ZHIHU_OAUTH_APP_KEY:''},{THREADPEAK_TOKEN_SECRET:'short'},
    {ZHIHU_OAUTH_REDIRECT_URI:'http://threadpeak.test/api/auth/zhihu/callback'},
    {ZHIHU_OAUTH_REDIRECT_URI:'https://evil.test/api/auth/zhihu/callback'},
    {ZHIHU_OAUTH_REDIRECT_URI:env.ZHIHU_OAUTH_REDIRECT_URI+'?next=evil'},
    {ZHIHU_OAUTH_USERINFO_URL:'https://openapi.zhihu.com:9443/user'},
    {ZHIHU_OAUTH_USERINFO_URL:'https://openapi.zhihu.com.evil.test/user'},
    {ZHIHU_OAUTH_USER_ID_PATH:'__proto__.uid'},
    {ZHIHU_OAUTH_USER_NAME_PATH:'user..name'},
  ])assert.equal(loginConfig({...env,...change}),undefined)
  assert.equal(loginConfig({...env,NODE_ENV:'test',THREADPEAK_PUBLIC_ORIGIN:'ftp://localhost',ZHIHU_OAUTH_REDIRECT_URI:'ftp://localhost/api/auth/zhihu/callback'}),undefined)
  assert.equal(loginConfig({...env,NODE_ENV:'test',THREADPEAK_PUBLIC_ORIGIN:'http://127.0.0.1:4301',ZHIHU_OAUTH_REDIRECT_URI:'http://127.0.0.1:4301/api/auth/zhihu/callback'}).mode,'real')
})

test('real HTTP login exchanges form code, stores encrypted tokens and restores the same uid workspace',async t=>{
  const f=await fixture(t),a=await f.start()
  assert.equal(a.url.origin,'https://openapi.zhihu.com');assert.equal(a.url.searchParams.get('redirect_uri'),env.ZHIHU_OAUTH_REDIRECT_URI)
  assert.doesNotMatch(a.response.body,/test-app-key|token_cipher/)
  const result=await f.complete(a),cookie=cookieOf(result,'tp_workspace'),headers={cookie}
  assert.equal(result.headers.location,'/?oauth=success#home')
  assert.equal(result.headers['referrer-policy'],'no-referrer');assert.equal(result.headers['cache-control'],'no-store')
  for(const value of result.headers['set-cookie']){assert.match(value,/HttpOnly/);assert.match(value,/Secure/);assert.match(value,/SameSite=Lax/)}
  const form=f.calls[0].init.body
  assert.deepEqual(Object.fromEntries(form),{app_id:'test-app',app_key:'test-app-key',grant_type:'authorization_code',redirect_uri:env.ZHIHU_OAUTH_REDIRECT_URI,code:'a'})
  assert.equal(f.calls[0].init.redirect,'error');assert.equal(f.calls[1].init.headers.Authorization,'Bearer user-token-a')
  const session=(await f.app.inject({url:'/api/v2/session',headers})).json()
  assert.equal(session.provider,'zhihu');assert.equal(session.authorization.status,'active')
  assert.equal(session.profile.name,'同名用户');assert.equal(session.profile.avatar,'https://picx.zhimg.com/avatar.jpg');assert.equal(session.demo,false)
  assert.doesNotMatch(JSON.stringify(session),/user-token|test-phone|test-private|uid|token_cipher/)
  const [account]=await f.db.query('SELECT * FROM tp_zhihu_accounts')
  assert.equal(unsealToken(account.token_cipher,secret),'user-token-a');assert.doesNotMatch(JSON.stringify(account),/test-phone|test-private|user-token/)
  const saved=await f.store.create(account.owner_id,'attachment','oauth-owned-note',{content:'我的学习记录'})
  await f.db.query('UPDATE tp_zhihu_accounts SET token_expires_at=0')
  assert.equal((await f.app.inject({url:'/api/v2/session',headers})).json().authorization.status,'expired')
  assert.equal((await f.app.inject({url:'/api/v2/zhihu/folders',headers})).json().code,'ZHIHU_REAUTHORIZE')
  const renewed=await f.complete(await f.start(),'a2','code'),newHeaders={cookie:cookieOf(renewed,'tp_workspace')}
  assert.equal((await f.app.inject({url:'/api/v2/session',headers:newHeaders})).json().workspaceId,session.workspaceId)
  assert.equal((await f.store.resource(account.owner_id,saved.id)).body.content,'我的学习记录')
  const other=await f.complete(await f.start(),'b'),otherHeaders={cookie:cookieOf(other,'tp_workspace')}
  assert.equal((await f.app.inject({url:`/api/v2/resources/${saved.id}`,headers:otherHeaders})).statusCode,404)
  assert.equal((await f.db.query('SELECT * FROM tp_zhihu_accounts')).length,2)
  await f.app.inject({method:'POST',url:'/api/auth/logout',headers:newHeaders})
  assert.equal((await f.app.inject({url:'/api/v2/session',headers:newHeaders})).statusCode,401)
  assert.equal((await f.app.inject({url:'/api/v2/session',headers:otherHeaders})).statusCode,200)
})

test('callbacks reject missing/mismatched state, wrong browser, duplicate fields, expired attempts and replay before provider calls',async t=>{
  const f=await fixture(t)
  for(const kind of ['missing-state','wrong-state','wrong-cookie','duplicate-code','missing-code','expired']){
    const a=await f.start(),q=new URLSearchParams({authorization_code:'a',state:a.state})
    let cookie=a.cookie
    if(kind==='missing-state')q.delete('state')
    if(kind==='wrong-state')q.set('state','f'.repeat(64))
    if(kind==='wrong-cookie')cookie='tp_zhihu_oauth='+'f'.repeat(64)
    if(kind==='duplicate-code')q.append('authorization_code','b')
    if(kind==='missing-code')q.delete('authorization_code')
    if(kind==='expired')await f.db.query('UPDATE tp_oauth_attempts SET expires_at=0')
    const result=await f.app.inject({url:'/api/auth/zhihu/callback?'+q,headers:{cookie}})
    assert.equal(result.headers.location,'/?oauth=failed#home',kind)
    assert.match(result.headers['set-cookie'],/Max-Age=0/)
    assert.equal(cookieOf(result,'tp_workspace'),undefined)
  }
  assert.equal(f.calls.length,0)
  const a=await f.start(),responses=await Promise.all([f.complete(a),f.complete(a)])
  assert.equal(responses.filter(r=>r.headers.location.includes('success')).length,1)
  assert.equal(f.calls.length,2)
  const denied=await f.start(),result=await f.app.inject({url:`/api/auth/zhihu/callback?error=access_denied&state=${denied.state}&error_description=private-provider-text`,headers:{cookie:denied.cookie}})
  assert.equal(result.headers.location,'/?oauth=cancelled#home');assert.doesNotMatch(result.body,/private-provider-text/)
  assert.equal((await f.complete(denied)).headers.location,'/?oauth=failed#home')
})

test('large numeric uid stays lossless, isolates adjacent IDs and matches its string representation',async t=>{
  const f=await fixture(t,{profile:init=>{
    const variant=init.headers.Authorization.slice(7)
    // Raw provider bytes are intentional: JSON.stringify would round these first.
    const uid=variant.endsWith('-b')?'9007199254740993':variant.endsWith('-string')?'"9007199254740992"':'9007199254740992'
    return new Response(`{"uid":${uid},"fullname":"同名用户"}`,{headers:{'content-type':'application/json'}})
  }})
  const sessions=[]
  for(const code of ['a','b','string']){
    const result=await f.complete(await f.start(),code)
    assert.equal(result.headers.location,'/?oauth=success#home')
    sessions.push((await f.app.inject({url:'/api/v2/session',headers:{cookie:cookieOf(result,'tp_workspace')}})).json())
  }
  assert.notEqual(sessions[0].workspaceId,sessions[1].workspaceId)
  assert.equal(sessions[0].workspaceId,sessions[2].workspaceId)
  assert.equal((await f.db.query('SELECT * FROM tp_zhihu_accounts')).length,2)
})

test('callback uses authorization_code ahead of its compatibility alias and refuses cross-site start',async t=>{
  const f=await fixture(t)
  for(const headers of [{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'}])assert.equal((await f.app.inject({url:'/api/auth/zhihu/start',headers})).statusCode,403)
  assert.equal((await f.db.query('SELECT * FROM tp_oauth_attempts')).length,0)
  const a=await f.start()
  const result=await f.app.inject({url:`/api/auth/zhihu/callback?authorization_code=a&code=b&state=${a.state}`,headers:{cookie:a.cookie}})
  assert.equal(result.headers.location,'/?oauth=success#home');assert.equal(f.calls[0].init.body.get('code'),'a')
})

test('invalid token/profile/transport responses never publish a session or raw provider error',async t=>{
  const f=await fixture(t,{exchange:init=>{
    const mode=init.body.get('code')
    if(mode==='throw')throw new Error('private-provider-body')
    if(mode==='html')return new Response('<html>private-provider-body</html>')
    if(mode==='huge')return new Response('x'.repeat(262145))
    if(mode==='expires')return json({access_token:'fake-user-token',expires_in:Number.MAX_SAFE_INTEGER})
    if(mode==='header')return json({access_token:'token\r\nX-Injected: value',expires_in:3600})
    if(mode==='error')return json({code:401,access_token:'fake-user-token',expires_in:3600})
    return json({access_token:mode,expires_in:3600})
  },profile:init=>{
    const mode=init.headers.Authorization.slice(7)
    if(mode==='invalid-id')return json({uid:-1})
    if(mode==='fractional-id')return json({uid:1.5})
    if(mode==='no-id')return json({fullname:'只有名字'})
    return json({code:404,data:"User don't exist"})
  }})
  for(const code of ['throw','html','huge','expires','header','error','invalid-id','fractional-id','no-id','missing-user']){
    const result=await f.complete(await f.start(),code)
    assert.equal(result.headers.location,'/?oauth=failed#home',code)
    assert.doesNotMatch(result.body,/private-provider-body|fake-user-token|X-Injected/)
  }
  assert.equal((await f.db.query('SELECT * FROM tp_sessions')).length,0)
  assert.equal((await f.db.query('SELECT * FROM tp_zhihu_accounts')).length,0)
  assert.equal((await f.db.query('SELECT * FROM tp_oauth_attempts')).length,0)
})

test('OAuth throttling observes shared cooldown and returns a retry notice without exchanging a code twice',async t=>{
  const f=await fixture(t,{exchange:()=>new Response('private-provider-body',{status:429,headers:{'retry-after':'2'}})})
  const a=await f.start(),result=await f.complete(a)
  assert.equal(result.headers.location,'/?oauth=busy#home');assert.equal(f.calls.length,1)
  const [cooldown]=await f.db.query("SELECT until_at FROM tp_provider_cooldowns WHERE pool='zhihu'")
  assert.ok(Number(cooldown.until_at)>Date.now())
  assert.equal((await f.complete(a)).headers.location,'/?oauth=failed#home');assert.equal(f.calls.length,1)
})

test('authorized data uses both credentials; a revoked user token cannot fall back to developer-owned data',async t=>{
  let denied=false
  const f=await fixture(t,{data:init=>{
    assert.equal(init.headers.Authorization,'Bearer test-platform-key')
    assert.equal(init.headers['X-OAuth-Token'],'user-token-a')
    assert.match(init.headers['X-Request-Timestamp'],/^\d{10}$/)
    return json(denied?{Code:20001,Message:'private-provider-body'}:{Code:0,Data:{Items:[]}})
  }})
  const login=await f.complete(await f.start()),headers={cookie:cookieOf(login,'tp_workspace')}
  assert.equal((await f.app.inject({url:'/api/v2/zhihu/folders',headers})).statusCode,200)
  denied=true
  const response=await f.app.inject({url:'/api/v2/zhihu/folders',headers})
  assert.equal(response.statusCode,401);assert.equal(response.json().code,'ZHIHU_AUTH_FAILED')
  assert.match(response.json().message,/重新连接/);assert.doesNotMatch(response.body,/private-provider-body|user-token/)
  assert.equal(f.calls.filter(call=>call.url.includes('/api/v1/user/')).length,2)
})
