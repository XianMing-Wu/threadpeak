import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {openDatabase,migrate} from './database.ts'
import {DurableStore,digest} from './store.ts'
import {DurableWorker} from './worker.ts'
import {createProductApp} from './http.ts'

async function fixture(t,production=false,requestLimit=600){
 const db=await openDatabase();await migrate(db);const store=new DurableStore(db),worker=new DurableWorker(store,async()=>{},1,()=>{})
 const app=await createProductApp({store,worker,identity:{production,origin:'https://threadpeak.test'},providersReady:true,requestLimit})
 t.after(async()=>{await app.close();await db.close()});return {db,store,app}
}
const cookies=r=>r.headers['set-cookie'].map(c=>c.split(';')[0])
for(const production of [false,true])test(`guest entry is explicit, isolated and restorable (production=${production})`,async t=>{
 const {app,store,db}=await fixture(t,production)
 assert.equal((await app.inject({url:'/api/v2/session'})).statusCode,401)
 assert.equal((await db.query('SELECT * FROM tp_sessions')).length,0)
 const login=await app.inject({method:'POST',url:'/api/auth/guest'});assert.equal(login.statusCode,200)
 assert.equal(login.json().kind,'guest');assert.deepEqual(login.json().capabilities,{zhihuMaterials:false})
 const [active,recovery]=cookies(login),headers={cookie:[active,recovery].join('; ')}
 for(const c of login.headers['set-cookie']){assert.match(c,/HttpOnly/);assert.equal(c.includes('Secure'),production)}
 const snapshot=(await app.inject({url:'/api/v2/session',headers})).json()
 assert.equal(snapshot.kind,'guest');assert.equal(snapshot.provider,null);assert.equal(snapshot.capabilities.zhihuMaterials,false)
 const upload=await app.inject({method:'POST',url:'/api/v2/materials/upload?name=notes.md',headers:{...headers,'content-type':'application/octet-stream','idempotency-key':'guest-upload-file'},payload:Buffer.from('# 我的学习资料\n完整保留')})
 assert.equal(upload.statusCode,200,upload.body)
 assert.equal((await app.inject({url:'/api/v2/zhihu/folders',headers})).json().code,'ZHIHU_LOGIN_REQUIRED')
 for(const kind of ['collection','creation','recent'])assert.equal((await app.inject({method:'POST',url:'/api/v2/materials/zhihu',headers,payload:{kind,folderId:'55'}})).json().code,'ZHIHU_LOGIN_REQUIRED')
 const forged=await app.inject({method:'POST',url:'/api/path-runs',headers:{...headers,'idempotency-key':'guest-forged-scope'},payload:{goal:'学会这些知识',searchScope:{kind:'collections',folderIds:['55']}}});assert.equal(forged.json().code,'ZHIHU_LOGIN_REQUIRED')
 const second=await app.inject({method:'POST',url:'/api/auth/guest'}),otherHeaders={cookie:cookies(second).join('; ')}
 assert.equal((await app.inject({url:`/api/v2/materials/${upload.json().sourceId}`,headers:otherHeaders})).statusCode,404)
 const logout=await app.inject({method:'POST',url:'/api/auth/logout',headers});assert.equal(logout.statusCode,200)
 assert.equal((await app.inject({url:'/api/v2/session',headers})).statusCode,401)
 // The recovery token is not an active session, including if copied to the workspace cookie.
 assert.equal((await app.inject({url:'/api/v2/session',headers:{cookie:recovery}})).statusCode,401)
 assert.equal((await app.inject({url:'/api/v2/session',headers:{cookie:recovery.replace('tp_guest=','tp_workspace=')}})).statusCode,401)
 const again=await app.inject({method:'POST',url:'/api/auth/guest',headers:{cookie:recovery}}),restored={cookie:cookies(again).join('; ')}
 assert.equal((await app.inject({url:'/api/v2/session',headers:restored})).json().workspaceId,snapshot.workspaceId)
 assert.equal((await app.inject({url:'/api/v2/materials',headers:restored})).json().items[0].sourceId,upload.json().sourceId)
 const [guest]=await db.query('SELECT owner_id FROM tp_sessions WHERE token_hash=$1',[digest(cookies(again)[0].split('=')[1])]);assert.equal((await store.list(guest.owner_id,'attachment')).length,1)
})
test('legacy local logout preserves its workspace before revoking the session',async t=>{
 const {app,db,store}=await fixture(t),token=randomBytes(32).toString('hex'),owner='local:existing'
 await db.query('INSERT INTO tp_sessions VALUES($1,$2,$3)',[digest(token),owner,Date.now()+60000])
 const saved=await store.create(owner,'attachment','old-note',{fileName:'old.txt',content:'保留旧资料',origin:'upload',status:'ready'})
 const logout=await app.inject({method:'POST',url:'/api/auth/logout',headers:{cookie:`tp_workspace=${token}`}})
 const recovery=cookies(logout).find(c=>c.startsWith('tp_guest='));assert.ok(recovery)
 const login=await app.inject({method:'POST',url:'/api/auth/guest',headers:{cookie:recovery}})
 assert.equal((await app.inject({url:`/api/v2/materials/${saved.id}`,headers:{cookie:cookies(login).join('; ')}})).statusCode,200)
})
test('guest cannot adopt an account; expired restore cannot resurrect an identity',async t=>{
 const {app,db}=await fixture(t),accountToken=randomBytes(32).toString('hex')
 await db.query('INSERT INTO tp_sessions VALUES($1,$2,$3)',[digest(accountToken),'account:zhihu:someone',Date.now()+60000])
 const login=await app.inject({method:'POST',url:'/api/auth/guest',headers:{cookie:`tp_workspace=${accountToken}`}})
 const [session]=await db.query('SELECT owner_id FROM tp_sessions WHERE token_hash=$1',[digest(cookies(login)[0].split('=')[1])]);assert.match(session.owner_id,/^guest:/)
 await db.query('UPDATE tp_sessions SET expires_at=0 WHERE owner_id=$1',[session.owner_id])
 const fresh=await app.inject({method:'POST',url:'/api/auth/guest',headers:{cookie:cookies(login).join('; ')}})
 const [next]=await db.query('SELECT owner_id FROM tp_sessions WHERE token_hash=$1',[digest(cookies(fresh)[0].split('=')[1])]);assert.notEqual(next.owner_id,session.owner_id)
})
test('cross-site guest login is rejected and IP limits precede session writes',async t=>{
 const {app,db}=await fixture(t,true,4)
 for(const headers of [{'sec-fetch-site':'cross-site'},{origin:'https://evil.test'}])assert.equal((await app.inject({method:'POST',url:'/api/auth/guest',headers})).statusCode,403)
 assert.equal((await db.query('SELECT * FROM tp_sessions')).length,0)
 for(let i=0;i<3;i++)assert.equal((await app.inject({method:'POST',url:'/api/auth/guest'})).statusCode,i<2?200:429)
 assert.equal((await db.query('SELECT * FROM tp_sessions')).length,4)
})
