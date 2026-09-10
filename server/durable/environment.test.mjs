import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

const run = promisify(execFile)
const bootstrap = new URL('./bootstrap.ts', import.meta.url).href
async function isolated(t, contents, code, extraEnv = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'threadpeak-env-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, '.env'), contents)
  const { stdout } = await run(process.execPath, ['--input-type=module', '-e', `import {serverEnvironment,startProductServer} from ${JSON.stringify(bootstrap)};\n${code}`], {
    cwd, env: { PATH: process.env.PATH, NODE_NO_WARNINGS: '1', ...extraEnv }, timeout: 60_000,
  })
  return JSON.parse(stdout.trim().split('\n').at(-1))
}

test('quick start with an unchanged environment example boots a real local API with optional defaults', async t => {
  const example = await readFile(new URL('../../.env.example', import.meta.url), 'utf8')
  const result = await isolated(t, example, `
    const env=serverEnvironment();
    const unset=['DATABASE_URL','THREADPEAK_PORT','THREADPEAK_HOST','THREADPEAK_DATA_DIR','DEEPSEEK_CONTEXT_TOKENS'].every(key=>env[key]===undefined);
    // Use an ephemeral test port; all other startup defaults are from the copied example.
    const {app}=await startProductServer({...env,THREADPEAK_PORT:'0'});
    try {
      const health=await app.inject({url:'/health'}),ready=await app.inject({url:'/api/ready'});
      console.log(JSON.stringify({unset,health:health.statusCode,ready:ready.statusCode}));
    } finally { await app.close() }
  `)
  assert.deepEqual(result, { unset: true, health: 200, ready: 503 })
})

test('nonempty process configuration wins, blank values fall through, and quoted values remain literal', async t => {
  const result = await isolated(t, 'THREADPEAK_PORT=4313\nTHREADPEAK_HOST="127.0.0.2"\nDEEPSEEK_CONTEXT_TOKENS=64000\nTHREADPEAK_DATA_DIR="  "\nZHIHU_ACCESS_SECRET="test-only-$literal"\n', `
    const env=serverEnvironment();
    console.log(JSON.stringify({port:env.THREADPEAK_PORT,host:env.THREADPEAK_HOST,window:env.DEEPSEEK_CONTEXT_TOKENS,unset:env.THREADPEAK_DATA_DIR===undefined,literal:env.ZHIHU_ACCESS_SECRET}));
  `, { THREADPEAK_PORT: '4314', THREADPEAK_HOST: '', DEEPSEEK_CONTEXT_TOKENS: '   ' })
  assert.deepEqual(result, { port: '4314', host: '127.0.0.2', window: '64000', unset: true, literal: 'test-only-$literal' })
})

test('bootstrap SIGTERM closes the worker before storage and makes the same checkpointed job immediately claimable',async t=>{
 const result=await isolated(t,'',`
   const {openDatabase}=await import(${JSON.stringify(new URL('./database.ts',import.meta.url).href)});
   const {DurableStore}=await import(${JSON.stringify(new URL('./store.ts',import.meta.url).href)});
   const directory=process.cwd()+'/handoff';
   const {app,store,worker}=await startProductServer({THREADPEAK_PORT:'0',THREADPEAK_DATA_DIR:directory});
   let ready;const entered=new Promise(resolve=>{ready=resolve});let original;
   worker.handler=async ctx=>{original=ctx.job;await store.checkpoint(ctx.job,'paid-provider','hash',{value:'retained'});ready();await new Promise((_,reject)=>ctx.signal.addEventListener('abort',()=>reject(ctx.signal.reason),{once:true}))};
   const resource=await store.create('owner','test','handoff',{});
   await store.enqueue('owner',resource.id,'test','bootstrap-shutdown',{});worker.wake();await entered;
   process.emit('SIGTERM');await app.close();
   const db=await openDatabase({directory});
   try{const next=await new DurableStore(db).claim();console.log(JSON.stringify({same:next.id===original.id,fenced:next.fence>original.fence,attempts:next.attempts,checkpoint:next.checkpoints['paid-provider'].value.value}))}finally{await db.close()}
 `)
 assert.deepEqual(result,{same:true,fenced:true,attempts:0,checkpoint:'retained'})
})
