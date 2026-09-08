import {open,readFile,unlink,realpath} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
/** A kernel-held descriptor lock survives PID reuse and releases on process death. */
export async function ownPGliteDirectory(directory:string):Promise<()=>Promise<void>>{
 const base=await realpath(directory),path=`${base}.threadpeak-owner`,token=`v2:${randomUUID()}`
 const {tryLock,unlock}=await import('fs-native-extensions')
 // Never unlink the advisory lock file: all contenders must lock the same inode.
 const lock=await open(`${base}.threadpeak-lock`,'a+',0o600)
 let held=false,closed=false
 const close=async()=>{if(closed)return;closed=true;try{if(held)unlock(lock.fd)}finally{await lock.close()}}
 try{
  held=tryLock(lock.fd)
  if(!held)throw Error('PGLITE_DIRECTORY_IN_USE')
  for(let attempt=0;attempt<2;attempt++){
   try{
    const file=await open(path,'wx',0o600)
    try{await file.writeFile(token)}finally{await file.close()}
    return async()=>{try{if(await readFile(path,'utf8').catch(()=>undefined)===token)await unlink(path)}finally{await close()}}
   }catch(error){
    if((error as {code?:string}).code!=='EEXIST')throw error
    const old=await readFile(path,'utf8')
    // A v2 marker without a held descriptor is stale, irrespective of any PID.
    // Legacy runtimes do not take the kernel lock, so migration stays conservative.
    if(!/^v2:[a-f0-9-]{36}$/.test(old)){
     const pid=Number(old.split(':')[0])
     if(!Number.isInteger(pid)||pid<=0)throw Error('PGLITE_DIRECTORY_IN_USE')
     try{process.kill(pid,0);throw Error('PGLITE_DIRECTORY_IN_USE')}catch(e){
      if((e as {code?:string}).code!=='ESRCH')throw Error('PGLITE_DIRECTORY_IN_USE')
     }
    }
    if(await readFile(path,'utf8')===old)await unlink(path)
   }
  }
  throw Error('PGLITE_DIRECTORY_IN_USE')
 }catch(error){await close();throw error}
}
