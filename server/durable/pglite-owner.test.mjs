import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {ownPGliteDirectory} from './pglite-owner.ts'
const moduleUrl=new URL('./pglite-owner.ts',import.meta.url).href
const fixture=async t=>{const root=await mkdtemp(join(tmpdir(),'tp-kernel-lock-')),dir=join(root,'pg');await mkdir(dir);t.after(()=>rm(root,{recursive:true,force:true}));return dir}
const contender=dir=>{
 const child=spawn(process.execPath,['--input-type=module','-e',`import {ownPGliteDirectory} from ${JSON.stringify(moduleUrl)};try{const release=await ownPGliteDirectory(process.argv[1]);process.send('held');process.on('message',async()=>{await release();process.exit(0)})}catch(e){process.send(e.message);process.exit(0)}`,dir],{stdio:['ignore','ignore','pipe','ipc']})
 const outcome=once(child,'message').then(([message])=>message);return {child,outcome}
}
test('kernel lock has one winner across processes and crash releases it without inspecting a PID',{timeout:15000},async t=>{
 const dir=await fixture(t),a=contender(dir),b=contender(dir)
 t.after(()=>{for(const {child} of [a,b])if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL')})
 const results=await Promise.all([a.outcome,b.outcome]);assert.deepEqual([...results].sort(),['PGLITE_DIRECTORY_IN_USE','held'].sort())
 const winner=results[0]==='held'?a.child:b.child
 await assert.rejects(ownPGliteDirectory(dir),/PGLITE_DIRECTORY_IN_USE/)
 const died=once(winner,'exit');winner.kill('SIGKILL');await died
 assert.match(await readFile(dir+'.threadpeak-owner','utf8'),/^v2:/)
 const release=await ownPGliteDirectory(dir);await release()
 const again=await ownPGliteDirectory(dir);await again()
})
test('legacy live PID is not stolen during migration; stale v2 markers do not lock out a new process',async t=>{
 const dir=await fixture(t),marker=dir+'.threadpeak-owner',old=`${process.pid}:legacy`
 await writeFile(marker,old);await assert.rejects(ownPGliteDirectory(dir),/PGLITE_DIRECTORY_IN_USE/);assert.equal(await readFile(marker,'utf8'),old)
 await writeFile(marker,'v2:00000000-0000-4000-8000-000000000000')
 const release=await ownPGliteDirectory(dir);await assert.rejects(ownPGliteDirectory(dir),/PGLITE_DIRECTORY_IN_USE/);await release()
})
