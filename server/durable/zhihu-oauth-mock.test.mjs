import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, migrate } from './database.ts'
import { DurableStore, digest } from './store.ts'
import { DurableWorker } from './worker.ts'
import { createProductApp } from './http.ts'
import { ZhihuLogin, loginConfig, sealToken } from './zhihu-oauth.ts'
import { ZhihuDataClient } from './zhihu-data.ts'
import { createZhihuUserServices, startProductServer } from './bootstrap.ts'
import { ZhihuOAuthMock, isMockZhihuOwner, isMockZhihuUrl, readOrCreateMockSecret } from './zhihu-oauth-mock.ts'

const secret='test-demo-secret-not-an-actual-credential-123456789'
const env={NODE_ENV:'test',ZHIHU_OAUTH_MODE:'mock',THREADPEAK_PUBLIC_ORIGIN:'http://localhost',THREADPEAK_TOKEN_SECRET:secret}
const fakeRealConfig={mode:'real',appId:'test-real',appKey:'test-key',redirectUri:'http://localhost/api/auth/zhihu/callback',origin:'http://localhost',tokenSecret:secret,userInfoUrl:'https://openapi.zhihu.com/test-only-profile-contract',userIdPath:'id',production:false}
const unreachable=async()=>{throw new Error('Demo authorization must never call an external provider')}
const bindingOf=start=>start.cookie.split(';')[0].slice('tp_zhihu_oauth='.length)
async function fixture(t){
  const db=await openDatabase();await migrate(db)
  const login=new ZhihuLogin(db,loginConfig(env),unreachable),data=new ZhihuDataClient('',unreachable,undefined,login.mock),store=new DurableStore(db)
  const worker=new DurableWorker(store,async()=>{throw new Error('No LLM worker expected')},1,()=>{})
  const app=await createProductApp({store,worker,identity:{production:false,origin:'http://localhost'},providersReady:false,zhihuData:data,zhihuLogin:login})
  t.after(async()=>{await app.close();await db.close()})
  const authorize=async()=>{
    const start=await login.start(),url=new URL(start.authorizeUrl),cookie=await login.callback(url.searchParams.get('authorization_code'),url.searchParams.get('state'),bindingOf(start))
    const session=cookie.split(';')[0],hash=digest(session.slice('tp_workspace='.length))
    const [row]=await db.query('SELECT owner_id FROM tp_sessions WHERE token_hash=$1',[hash])
    return {owner:row.owner_id,cookie:session,token:await login.userToken(row.owner_id)}
  }
  return {db,login,data,store,app,authorize}
}
test('demo is explicit, needs no app credentials, rejects production and invalid modes before boot',async()=>{
  assert.equal(loginConfig({}),undefined)
  assert.equal(loginConfig(env).mode,'mock')
  assert.equal(loginConfig(env).appKey,'')
  assert.throws(()=>loginConfig({...env,ZHIHU_OAUTH_MODE:'auto'}),/OAUTH_MODE_INVALID/)
  assert.throws(()=>loginConfig({...env,NODE_ENV:'production'}),/OAUTH_MOCK_FORBIDDEN_IN_PRODUCTION/)
  await assert.rejects(startProductServer({...env,NODE_ENV:'production'}),/OAUTH_MOCK_FORBIDDEN_IN_PRODUCTION/)
  assert.throws(()=>new ZhihuOAuthMock(secret,true),/OAUTH_MOCK_FORBIDDEN_IN_PRODUCTION/)
  assert.throws(()=>loginConfig({...env,ZHIHU_OAUTH_REDIRECT_URI:'https://evil.test/api/auth/zhihu/callback'}),/OAUTH_REDIRECT_INVALID/)
})
test('same start/callback/session endpoints complete an explicitly marked isolated demo session',async t=>{
  const {app,db}=await fixture(t)
  const start=await app.inject({url:'/api/auth/zhihu/start'})
  assert.equal(start.statusCode,200);assert.equal(start.json().kind,'redirect')
  const redirect=new URL(start.json().authorizeUrl);assert.equal(redirect.origin,'http://localhost');assert.equal(redirect.pathname,'/api/auth/zhihu/callback')
  const result=await app.inject({url:redirect.pathname+redirect.search,headers:{cookie:String(start.headers['set-cookie']).split(';')[0]}})
  assert.equal(result.statusCode,302);assert.equal(result.headers.location,'/?oauth=success#home')
  const cookie=result.headers['set-cookie'].find(v=>v.startsWith('tp_workspace=')).split(';')[0]
  const session=await app.inject({url:'/api/v2/session',headers:{cookie}})
  assert.equal(session.json().kind,'authenticated');assert.equal(session.json().provider,'zhihu');assert.equal(session.json().profile.demo,true);assert.equal(session.json().profile.mode,'mock')
  assert.match(session.json().profile.name,/演示/);assert.doesNotMatch(session.body,/tp-demo\.|token_cipher|access_token/)
  const [account]=await db.query('SELECT * FROM tp_zhihu_accounts');assert.ok(isMockZhihuOwner(account.owner_id));assert.doesNotMatch(account.token_cipher,/tp-demo\./)
  const folders=await app.inject({url:'/api/v2/zhihu/folders',headers:{cookie}});assert.equal(folders.statusCode,200,folders.body)
  assert.match(folders.body,/演示/)
  await app.inject({method:'POST',url:'/api/auth/logout',headers:{cookie}})
  assert.equal((await app.inject({url:'/api/v2/zhihu/folders',headers:{cookie}})).statusCode,401)
})
test('browser binding, state/code pairing, expiration and replay remain enforced in mock',async t=>{
  const {login}=await fixture(t),a=await login.start(),b=await login.start(),url=new URL(a.authorizeUrl),other=new URL(b.authorizeUrl)
  await assert.rejects(login.callback(url.searchParams.get('authorization_code'),url.searchParams.get('state'),bindingOf(b)),e=>e.code==='OAUTH_STATE_INVALID')
  await login.callback(url.searchParams.get('authorization_code'),url.searchParams.get('state'),bindingOf(a))
  await assert.rejects(login.callback(url.searchParams.get('authorization_code'),url.searchParams.get('state'),bindingOf(a)),e=>e.code==='OAUTH_STATE_INVALID')
  await assert.rejects(login.callback(url.searchParams.get('authorization_code'),other.searchParams.get('state'),bindingOf(b)),e=>e.code==='OAUTH_STATE_INVALID')
  let now=1_000;const mock=new ZhihuOAuthMock(secret,false,()=>now),code=mock.authorize('state');now+=600_001
  assert.throws(()=>mock.exchange(code,'state'),e=>e.code==='ZHIHU_REAUTHORIZE')
  now=1_000;const token=mock.exchange(mock.authorize('state'),'state').access_token;now+=3600_001
  assert.equal(mock.user('favlists',token,{}).Code,20001)
})
test('two demo accounts cannot read each other workspace or folders; demo and real tokens never mix',async t=>{
  const {authorize,store,app,data,login,db}=await fixture(t),a=await authorize(),b=await authorize()
  assert.notEqual(a.owner,b.owner)
  const resource=await store.create(a.owner,'attachment','test-demo-owned',{fileName:'mine.txt',mimeType:'text/plain',status:'ready',content:'private demo note',origin:'upload'})
  assert.equal((await app.inject({url:`/api/v2/materials/${resource.id}`,headers:{cookie:b.cookie}})).statusCode,404)
  const aFolders=await data.user('favlists',a.token,{}),bFolders=await data.user('favlists',b.token,{})
  assert.notEqual(aFolders.Items[0].UrlToken,bFolders.Items[0].UrlToken)
  await assert.rejects(data.user('favlist_contents',b.token,{FavlistUrlToken:aFolders.Items[0].UrlToken}),e=>e.code==='ZHIHU_CODE_10001')
  const real=new ZhihuLogin(db,fakeRealConfig,unreachable)
  await assert.rejects(real.userToken(a.owner),e=>e.code==='ZHIHU_REAUTHORIZE')
  await assert.rejects(login.userToken('account:zhihu:real-account'),e=>e.code==='ZHIHU_REAUTHORIZE')
  await assert.rejects(data.user('favlists','real-user-token',{}),e=>e.code==='ZHIHU_CODE_20001')
})
test('a local workspace needs login, while an expired connected account needs reauthorization',async t=>{
  const {db,login,app,authorize}=await fixture(t)
  const real=new ZhihuLogin(db,fakeRealConfig,unreachable)
  for(const provider of [login,real])await assert.rejects(provider.userToken('local:never-authorized'),e=>e.code==='ZHIHU_LOGIN_REQUIRED'&&e.status===401)
  const session=await app.inject({method:'POST',url:'/api/auth/guest'}),cookie=String(session.headers['set-cookie']).split(';')[0]
  const folders=await app.inject({url:'/api/v2/zhihu/folders',headers:{cookie}})
  assert.equal(folders.statusCode,401);assert.equal(folders.json().code,'ZHIHU_LOGIN_REQUIRED')
  const account=await authorize();await db.query('UPDATE tp_zhihu_accounts SET token_expires_at=0 WHERE owner_id=$1',[account.owner])
  await assert.rejects(login.userToken(account.owner),e=>e.code==='ZHIHU_REAUTHORIZE'&&e.status===401)
})
test('all four user APIs preserve official envelopes, pagination, sort and optional author semantics',async t=>{
  const {authorize,data,login}=await fixture(t),{token}=await authorize(),raw=login.mock.user('favlists',token,{})
  assert.deepEqual(Object.keys(raw).sort(),['Code','Data','Message'])
  assert.equal(raw.Code,0);assert.equal(raw.Message,'success')
  const folders=raw.Data.Items;assert.equal(folders.length,4);assert.equal(raw.Data.Paging,undefined)
  folders.forEach(f=>{assert.equal(typeof f.UrlToken,'number');assert.equal(typeof f.IsPublic,'boolean');assert.ok(isMockZhihuUrl(f.Url));assert.match(f.Title,/演示/)})
  const entries=[];let offset=0
  do{
    const page=await data.user('favlist_contents',token,{FavlistUrlToken:folders[0].UrlToken,Limit:1,Offset:offset})
    assert.equal(page.Items.length,1);entries.push(...page.Items)
    if(page.Paging.IsEnd){assert.equal(page.Paging.NextOffset,undefined);assert.equal(page.Paging.Totals,entries.length);break}
    assert.equal(typeof page.Paging.NextOffset,'string');offset=Number(page.Paging.NextOffset)
  }while(offset<100)
  assert.equal(entries.length,4)
  entries.forEach(item=>{for(const field of ['Url','Title','Summary','ContentType'])assert.equal(typeof item[field],'string');for(const field of ['CreatedAt','LikeCount','CommentCount','FavoriteCount','FavTime'])assert.equal(typeof item[field],'number');assert.ok(isMockZhihuUrl(item.Author.Url));assert.match(item.Author.UrlToken,/^threadpeak-demo-/)})
  const empty=await data.user('favlist_contents',token,{FavlistUrlToken:folders[3].UrlToken});assert.deepEqual(empty,{Items:[],Paging:{IsEnd:true,Totals:0}})
  const recent=await data.user('collections',token,{Limit:20});assert.equal(recent.Paging,undefined);assert.ok(recent.Items.some(i=>!Object.hasOwn(i,'Author')))
  const creations=await data.user('contents',token,{ContentType:'all',Limit:100,SortField:'like_count',SortOrder:'asc'})
  assert.ok(creations.Items.every(i=>!Object.hasOwn(i,'Author')&&!Object.hasOwn(i,'FavTime')&&!Object.hasOwn(i,'Favlists')))
  assert.deepEqual(creations.Items.map(i=>i.LikeCount),creations.Items.map(i=>i.LikeCount).sort((a,b)=>a-b))
  const filtered=await data.user('contents',token,{ContentType:'answer',SortField:'ts',SortOrder:'desc'});assert.ok(filtered.Items.every(i=>i.ContentType==='answer'))
  await assert.rejects(data.user('contents',token,{}),e=>e.code==='ZHIHU_CODE_10001')
  await assert.rejects(data.user('contents',token,{ContentType:'all',SortOrder:'random'}),e=>e.code==='ZHIHU_CODE_10001')
})
test('rich demo relations retain shared articles, one author across concepts, and distinct same-name authors',async t=>{
  const {authorize,data}=await fixture(t),{token}=await authorize(),{Items}=await data.user('collections',token,{Limit:20})
  assert.ok(Items.some(item=>item.Favlists.length>1))
  const counts=new Map();for(const item of Items)if(item.Author)counts.set(item.Author.UrlToken,(counts.get(item.Author.UrlToken)??0)+1)
  assert.ok([...counts.values()].some(count=>count>=2))
  const names=new Map();for(const item of Items)if(item.Author)names.set(item.Author.Name,new Set([...(names.get(item.Author.Name)??[]),item.Author.UrlToken]))
  assert.ok([...names.values()].some(ids=>ids.size>1))
  assert.ok(Items.every(item=>isMockZhihuUrl(item.Url)&&item.Summary.includes('示例资料')))
  assert.equal(isMockZhihuUrl('https://zhihu-demo.invalid.evil.test/answer/1'),false)
  assert.equal(isMockZhihuUrl('https://evil@zhihu-demo.invalid/answer/1'),false)
  assert.equal(isMockZhihuUrl('https://www.zhihu.com/answer/1'),false)
})
test('user-only mock cannot intercept search, direct, PDF or leak demo tokens upstream',async()=>{
  const mock=new ZhihuOAuthMock(secret),token=mock.exchange(mock.authorize('state'),'state').access_token,calls=[]
  const transport=async(url,init)=>{calls.push({url:String(url),init});return new Response(JSON.stringify({Code:0,Message:'success',Data:{from:'actual-transport'}}))}
  const data=new ZhihuDataClient('test-platform-secret',transport,undefined,mock)
  assert.equal(data.userMode,'mock');await data.user('favlists',token,{});assert.equal(calls.length,0)
  for(const path of ['/api/v1/content/zhihu_search','/api/v1/content/global_search','/api/v1/zhida','/api/v1/pdf-parse/tasks'])assert.equal((await data.json(path)).from,'actual-transport')
  assert.equal(calls.length,4);assert.ok(calls.every(c=>c.init.headers.Authorization==='Bearer test-platform-secret'))
  await assert.rejects(data.json('/api/v1/content/zhihu_search',{token}),e=>e.code==='ZHIHU_DEMO_TOKEN_OUT_OF_SCOPE')
  await assert.rejects(data.user('../content/zhihu_search',token,{}),e=>e.code==='ZHIHU_USER_REQUEST_INVALID')
  await assert.rejects(new ZhihuDataClient('test',transport).user('favlists',token,{}),e=>e.code==='ZHIHU_DEMO_TOKEN_OUT_OF_SCOPE')
  assert.equal(calls.length,4)
  await assert.rejects(new ZhihuDataClient('',transport,undefined,mock).json('/api/v1/pdf-parse/tasks'),e=>e.code==='ZHIHU_CONFIG_REQUIRED')
})
test('mock key and signed user token remain usable after reconstructing services',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'threadpeak-oauth-demo-'));t.after(()=>rmSync(directory,{recursive:true,force:true}))
  assert.equal(readOrCreateMockSecret(directory),readOrCreateMockSecret(directory))
  assert.equal(statSync(join(directory,'zhihu-oauth-demo.key')).mode&0o777,0o600)
  const db=await openDatabase();await migrate(db);t.after(()=>db.close())
  const options={...env,THREADPEAK_TOKEN_SECRET:'',THREADPEAK_DATA_DIR:directory}
  const first=createZhihuUserServices(db,options),a=await first.zhihuLogin.start(),u=new URL(a.authorizeUrl)
  await first.zhihuLogin.callback(u.searchParams.get('authorization_code'),u.searchParams.get('state'),bindingOf(a))
  const [account]=await db.query('SELECT owner_id FROM tp_zhihu_accounts'),second=createZhihuUserServices(db,options)
  const token=await second.zhihuLogin.userToken(account.owner_id)
  assert.equal((await second.zhihuData.user('favlists',token,{})).Items.length,4)
  assert.equal(createZhihuUserServices(db,{...options,ZHIHU_OAUTH_MODE:'real'}).zhihuLogin,undefined)
})
test('renewing an expired demo token preserves the verified account, workspace and folder IDs',async t=>{
  const {db,login,data,authorize,store,app}=await fixture(t),account=await authorize()
  const originalFolders=await data.user('favlists',account.token,{}),subject=login.mock.profile(account.token).id
  const saved=await store.create(account.owner,'attachment','before-renewal',{content:'保留我的工作区'})
  const expiredIssuer=new ZhihuOAuthMock(secret,false,()=>Date.now()-7200_000)
  const expired=expiredIssuer.exchange(expiredIssuer.authorize('past',subject),'past').access_token
  await db.query('UPDATE tp_zhihu_accounts SET token_cipher=$1,token_expires_at=0 WHERE owner_id=$2',[sealToken(expired,secret),account.owner])
  await assert.rejects(login.userToken(account.owner),e=>e.code==='ZHIHU_REAUTHORIZE')
  await assert.rejects(data.user('favlists',expired,{}),e=>e.code==='ZHIHU_CODE_20001')
  // Only the server-resolved cookie owner is passed to start; a query owner cannot select an account.
  const response=await app.inject({url:'/api/auth/zhihu/start?owner=account:zhihu:mock:forged',headers:{cookie:account.cookie}})
  assert.equal(response.statusCode,200,response.body)
  const start={...response.json(),cookie:response.headers['set-cookie']},u=new URL(start.authorizeUrl)
  const freshCookie=await login.callback(u.searchParams.get('authorization_code'),u.searchParams.get('state'),bindingOf(start))
  const freshHash=digest(freshCookie.split(';')[0].slice('tp_workspace='.length)),[session]=await db.query('SELECT owner_id FROM tp_sessions WHERE token_hash=$1',[freshHash])
  assert.equal(session.owner_id,account.owner)
  const renewed=await login.userToken(account.owner);assert.notEqual(renewed,expired)
  assert.deepEqual(await data.user('favlists',renewed,{}),originalFolders)
  assert.equal((await store.resource(account.owner,saved.id)).body.content,'保留我的工作区')
  assert.equal((await db.query('SELECT * FROM tp_zhihu_accounts')).length,1)
  await assert.rejects(login.start('account:zhihu:mock:unverified'),e=>e.code==='ZHIHU_REAUTHORIZE')
})
