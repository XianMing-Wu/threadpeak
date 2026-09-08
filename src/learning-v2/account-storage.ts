import {useSyncExternalStore} from 'react'
const KEEP=new Set(['threadpeak-theme','threadpeak-authenticated'])
const ARCHIVE_PREFIX='threadpeak-account-archive:'
const WORKSPACE='tp-server-workspace'
const scoped=(key:string)=>(key.startsWith('threadpeak-')||key.startsWith('tp-'))&&!KEEP.has(key)&&!key.startsWith(ARCHIVE_PREFIX)&&key!==WORKSPACE
export type AccountBackup={local:Record<string,string>;session:Record<string,string>;pendingLocal:string[];pendingSession:string[]}
const capture=(storage:Storage)=>Object.fromEntries(Object.keys(storage).filter(scoped).map(key=>[key,storage.getItem(key)!]))
let recoveryOwner:string|undefined
let recoveryVersion=0
const recoveryListeners=new Set<()=>void>()
function setRecoveryOwner(owner:string|undefined){
  recoveryVersion++
  if(owner===recoveryOwner)return
  recoveryOwner=owner
  for(const notify of recoveryListeners)notify()
}
/** Discover persistent pending records even when session/library HTTP is offline. */
export async function refreshAccountRecovery(){
  const owner=localStorage.getItem(WORKSPACE),version=recoveryVersion
  let backup:AccountBackup|undefined
  try{backup=owner?await readAccountBackup(owner,true):undefined}catch{return}
  if(owner===localStorage.getItem(WORKSPACE)&&version===recoveryVersion)setRecoveryOwner(owner&&backup&&(backup.pendingLocal.length||backup.pendingSession.length)?owner:undefined)
}
const refreshRecovery=()=>{void refreshAccountRecovery()}
function subscribeRecovery(notify:()=>void){
  recoveryListeners.add(notify)
  if(recoveryListeners.size===1){window.addEventListener('storage',refreshRecovery);window.addEventListener('threadpeak:account-change',refreshRecovery)}
  refreshRecovery()
  return()=>{recoveryListeners.delete(notify);if(!recoveryListeners.size){window.removeEventListener('storage',refreshRecovery);window.removeEventListener('threadpeak:account-change',refreshRecovery)}}
}
export function useAccountRecovery(){return useSyncExternalStore(subscribeRecovery,accountRecoveryAvailable,()=>false)}
let switching=Promise.resolve()

async function archiveDatabase<T>(operation:(store:IDBObjectStore)=>IDBRequest<T>,write=false):Promise<T>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('threadpeak-account-backups',1)
    let settled=false
    request.onupgradeneeded=()=>request.result.createObjectStore('accounts')
    request.onerror=()=>{settled=true;reject(request.error)}
    request.onblocked=()=>{settled=true;reject(new Error('ACCOUNT_ARCHIVE_BLOCKED'))}
    request.onsuccess=()=>{
      const db=request.result;if(settled){db.close();return}
      const tx=db.transaction('accounts',write?'readwrite':'readonly')
      const result=operation(tx.objectStore('accounts'))
      tx.oncomplete=()=>{db.close();resolve(result.result)}
      tx.onabort=()=>{db.close();reject(tx.error??result.error)}
      tx.onerror=()=>{ /* onabort is the durable failure boundary */ }
    }
  })
}
export async function readAccountBackup(owner:string,requireReadable=false):Promise<AccountBackup|undefined>{
  let unavailable=false
  try {const saved=await archiveDatabase<AccountBackup|undefined>(store=>store.get(owner));if(saved)return saved}catch{unavailable=true}
  try {
    const raw=localStorage.getItem(ARCHIVE_PREFIX+owner);if(!raw){if(requireReadable&&unavailable)throw new Error('ACCOUNT_ARCHIVE_UNAVAILABLE');return}
    const saved=JSON.parse(raw),records=saved.local??saved
    const local=Object.fromEntries(Object.entries(records).filter(([key,value])=>scoped(key)&&typeof value==='string')) as Record<string,string>
    return {local,session:saved.session??{},pendingLocal:Object.keys(local),pendingSession:Object.keys(saved.session??{})}
  }catch(error){if(requireReadable)throw error;return undefined}
}
async function saveBackup(owner:string,backup:AccountBackup){
  try{await archiveDatabase(store=>store.put(backup,owner),true);return}catch{/* No deletion until one persistent archive has committed. */}
  try{localStorage.setItem(ARCHIVE_PREFIX+owner,JSON.stringify(backup))}catch{
    setRecoveryOwner(owner)
    throw new Error('浏览器的两处备份空间都无法写入。旧账号内容仍保留，请先导出本地备份或释放浏览器空间，再切换账号。')
  }
}
const pendingRecords=(records:Record<string,string>,pending:string[])=>Object.fromEntries(pending.filter(key=>scoped(key)&&typeof records[key]==='string').map(key=>[key,records[key]!]))
async function performSwitch(identity:string){
  const old=localStorage.getItem(WORKSPACE)
  if(old===identity){
    const previous=await readAccountBackup(identity)
    setRecoveryOwner(previous&&(previous.pendingLocal.length||previous.pendingSession.length)?identity:undefined)
    return
  }
  if(old){
    const previous=await readAccountBackup(old)
    const local={...(previous?pendingRecords(previous.local,previous.pendingLocal):{}),...capture(localStorage)}
    const session={...(previous?pendingRecords(previous.session,previous.pendingSession):{}),...capture(sessionStorage)}
    await saveBackup(old,{local,session,pendingLocal:Object.keys(local),pendingSession:Object.keys(session)})
    // IndexedDB commits before deleting any old-account bytes. localStorage quota
    // is now freed instead of requiring a second escaped copy in the same quota.
    for(const key of Object.keys(localStorage).filter(scoped))localStorage.removeItem(key)
    for(const key of Object.keys(sessionStorage).filter(scoped))sessionStorage.removeItem(key)
  }
  localStorage.setItem(WORKSPACE,identity)
  setRecoveryOwner(undefined)
  const previous=await readAccountBackup(identity)
  if(previous){
    const restore=(storage:Storage,records:Record<string,string>)=>Object.entries(records).filter(([key,value])=>{
      if(!scoped(key)||typeof value!=='string')return false
      try{storage.setItem(key,value);return false}catch{return true}
    }).map(([key])=>key)
    previous.pendingLocal=restore(localStorage,previous.local);previous.pendingSession=restore(sessionStorage,previous.session)
    if(previous.pendingLocal.length||previous.pendingSession.length)setRecoveryOwner(identity)
    // Restoring a large archive can exceed today's quota. Login still succeeds;
    // missing drafts remain in the archive and the UI offers a complete export.
    try{await saveBackup(identity,previous)}catch{setRecoveryOwner(identity)}
  }
  if(old)window.dispatchEvent(new Event('threadpeak:account-change'))
}
/** Serializes account changes, preserving drafts before clearing either key prefix. */
export function switchWorkspace(identity:string){
  const next=switching.then(()=>performSwitch(identity));switching=next.catch(()=>{});return next
}
export const accountRecoveryAvailable=()=>recoveryOwner===localStorage.getItem(WORKSPACE)
export async function accountStorageForExport(){
  const owner=localStorage.getItem(WORKSPACE),backup=owner?await readAccountBackup(owner):undefined
  return {local:{...backup?.local,...capture(localStorage)},session:{...backup?.session,...capture(sessionStorage)}}
}
