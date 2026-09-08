import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {openDatabase,migrate} from '../server/durable/database.ts'
import {DurableStore} from '../server/durable/store.ts'
import {DurableWorker} from '../server/durable/worker.ts'
import {createProductApp} from '../server/durable/http.ts'
import {verifyIdentityToken} from '../server/durable/auth.ts'
import {validateTree} from '@threadpeak/contracts/learning-v2'

const config={production:true,origin:'https://threadpeak.test',jwtSecret:'test-only-secret-with-at-least-32-characters',issuer:'test-issuer',audience:'threadpeak'}
function token(sub,extra={}){const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({sub,iss:config.issuer,aud:config.audience,exp:Date.now()/1000+600,...extra})).toString('base64url');return `${h}.${p}.${createHmac('sha256',config.jwtSecret).update(`${h}.${p}`).digest('base64url')}`}
const fixture=async t=>{const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{});const app=await createProductApp({store,worker,providersReady:true,identity:config});t.after(async()=>{await app.close();await db.close()});return {db,store,app}}

test('production HTTP: signed login cookie, owner isolation, CSRF, expiry and logout compose with real storage',async t=>{
 const {app,store}=await fixture(t)
 assert.equal((await app.inject({url:'/api/v2/library'})).statusCode,401)
 for(const jwt of [token('alice',{exp:0}),token('alice',{aud:'wrong'}),token('alice')+'bad'])assert.equal((await app.inject({url:'/api/v2/session',headers:{authorization:`Bearer ${jwt}`}})).statusCode,401)
 const jwt=token('alice'),session=await app.inject({url:'/api/v2/session',headers:{authorization:`Bearer ${jwt}`,origin:config.origin}})
 assert.equal(session.statusCode,200);assert.match(session.headers['set-cookie'],/HttpOnly; Secure; SameSite=Lax/)
 const cookie=session.headers['set-cookie'].split(';')[0],owner=verifyIdentityToken(jwt,config),r=await store.create(owner,'test','test',{retained:'content'})
 assert.equal((await app.inject({url:`/api/v2/resources/${r.id}`,headers:{cookie}})).json().data.retained,'content')
 assert.equal((await app.inject({url:`/api/v2/resources/${r.id}`,headers:{authorization:`Bearer ${token('bob')}`}})).statusCode,404)
 assert.equal((await app.inject({method:'POST',url:`/api/v2/resources/${r.id}/cancel`,headers:{cookie,origin:'https://evil.test'},payload:{}})).statusCode,403)
 assert.equal((await app.inject({method:'POST',url:'/api/auth/logout',headers:{cookie,origin:config.origin},payload:{}})).statusCode,200)
 assert.equal((await app.inject({url:'/api/v2/library',headers:{cookie}})).statusCode,401)
})
test('production HTTP enforces small unauthenticated bodies, security headers, and request limits',async t=>{
 const {app}=await fixture(t)
 assert.equal((await app.inject({url:'/health'})).headers['x-content-type-options'],'nosniff')
 assert.equal((await app.inject({method:'POST',url:'/api/v2/learning/enter',payload:{junk:'x'.repeat(1_000_010)}})).statusCode,401)
 const large=await app.inject({method:'POST',url:'/api/v2/learning/enter',headers:{authorization:`Bearer ${token('alice')}`},payload:{junk:'x'.repeat(1_000_010)}})
 assert.equal(large.statusCode,413)
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{}),limited=await createProductApp({store,worker,providersReady:true,identity:config,requestLimit:2});t.after(async()=>{await limited.close();await db.close()})
 await limited.inject({url:'/api/auth/config'});await limited.inject({url:'/api/auth/config'});const response=await limited.inject({url:'/api/auth/config'});assert.equal(response.statusCode,429);assert.ok(response.headers['retry-after'])
})
test('single-parent cards reject merges and wrong basis bindings',()=>{
 const root={id:'root',type:'root',parents:[],sources:[],title:'concept',text:''},article={id:'a',type:'article',parents:['root'],sources:['a'],title:'article',text:'source'}
 validateTree([root,article])
 assert.throws(()=>validateTree([root,article,{...article,id:'b',type:'answer',parents:['a','root']}] ))
 assert.throws(()=>validateTree([root,article,{...article,id:'b',type:'answer',parents:['a'],basisId:'root'}]))
})

test('trusted proxy distinguishes clients and accounts, while untrusted forwarded headers cannot rotate buckets',async t=>{
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{})
 const app=await createProductApp({store,worker,identity:config,providersReady:true,requestLimit:2,trustedProxies:['172.30.84.2/32']})
 t.after(async()=>{await app.close();await db.close()})
 const request=(ip,sub,remoteAddress='172.30.84.2')=>app.inject({url:sub?'/api/v2/library':'/api/auth/config',remoteAddress,headers:{'x-forwarded-for':ip,...(sub?{authorization:`Bearer ${token(sub)}`}:{})}})
 for(let n=0;n<2;n++)assert.equal((await request('203.0.113.1','alice')).statusCode,200)
 assert.equal((await request('203.0.113.1','alice')).statusCode,429)
 assert.equal((await request('203.0.113.2','alice')).statusCode,200)
 assert.equal((await request('203.0.113.1','bob')).statusCode,200)
 for(let n=0;n<2;n++)assert.equal((await request('203.0.113.10')).statusCode,200)
 assert.equal((await request('203.0.113.10')).statusCode,429)
 assert.equal((await request('203.0.113.11')).statusCode,200)
 for(let n=1;n<=3;n++)assert.equal((await request(`198.51.100.${n}`,undefined,'192.0.2.99')).statusCode,n<3?200:429)
 // Failed credentials also consume the anonymous IP bucket.
 for(let n=1;n<=3;n++)assert.equal((await app.inject({url:'/api/v2/library',remoteAddress:'192.0.2.100'})).statusCode,n<3?401:429)
})

test('login is limited before creating session records and cannot rotate anonymous buckets',async t=>{
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{})
 const app=await createProductApp({store,worker,identity:config,providersReady:true,requestLimit:2})
 t.after(async()=>{await app.close();await db.close()})
 for(let n=1;n<=3;n++)assert.equal((await app.inject({url:'/api/v2/session',remoteAddress:'192.0.2.201',headers:{authorization:`Bearer ${token('user-'+n)}`}})).statusCode,n<=2?200:429)
 assert.equal((await db.query('SELECT * FROM tp_sessions')).length,2)
})
