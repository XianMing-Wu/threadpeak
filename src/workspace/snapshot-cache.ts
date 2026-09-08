import {accountRecoveryAvailable,accountStorageForExport} from '../learning-v2/account-storage'
import { z } from 'zod'
import { LibraryDocumentSchema } from '@threadpeak/contracts/product-library'
import type { WorkspaceSnapshot } from './types'

export const LEGACY_WORKSPACE_KEY='threadpeak-workspace-v1'
export const PROJECTION_KEY='threadpeak-projection-v2'
const graph=z.object({nodes:z.array(z.object({id:z.string(),title:z.string(),accent:z.string(),role:z.enum(['flow','parallel']),turns:z.array(z.object({question:z.string(),replyKind:z.enum(['full','summary']),paragraphs:z.array(z.string())}).passthrough())}).passthrough()),edges:z.array(z.object({id:z.string(),from:z.string(),to:z.string(),kind:z.enum(['flow','parallel']),reason:z.string()}).passthrough())}).passthrough()
const schema=z.object({version:z.literal(1),routes:z.array(z.object({id:z.string(),owner:z.enum(['mine','example']),title:z.string(),summary:z.string(),outcome:z.string(),duration:z.string(),tags:z.array(z.string()),icon:z.enum(['function','brain','layers','route','book']),document:LibraryDocumentSchema,conversationIds:z.array(z.string()),knowledgeId:z.string().nullable(),createdAt:z.number()}).passthrough()),knowledge:z.array(z.object({id:z.string(),routeId:z.string(),owner:z.enum(['mine','example']),title:z.string(),description:z.string(),icon:z.enum(['function','brain','layers','route','book']),sources:z.number(),type:z.string(),createdAt:z.number(),updatedAt:z.number(),seedConceptId:z.string(),graph,graphs:z.record(graph).optional()}).passthrough()),conversations:z.array(z.object({id:z.string(),kind:z.enum(['home-answer','home-route','route-followup','learning']),title:z.string(),query:z.string(),experience:z.enum(['answer','route']),turns:z.array(z.object({role:z.enum(['user','assistant']),text:z.string()}).passthrough()),value:z.string(),quote:z.string(),mode:z.string().transform(value=>value==='route'?'route' as const:'' as const),updatedAt:z.number()}).passthrough()),lessons:z.record(z.object({heading:z.string(),paragraphs:z.array(z.string()),placeholder:z.string()}).passthrough())})
const empty=():WorkspaceSnapshot=>({version:1,routes:[],knowledge:[],conversations:[],lessons:{}})
const cache=new Map<string,{raw:string|null;snapshot:WorkspaceSnapshot;invalid:boolean}>()
export function readSnapshot(key:string):WorkspaceSnapshot {
  const raw=localStorage.getItem(key),old=cache.get(key)
  if(old?.raw===raw)return old.snapshot
  let snapshot=empty(),invalid=false
  try {if(raw){const parsed=schema.safeParse(JSON.parse(raw));if(parsed.success)snapshot=parsed.data as unknown as WorkspaceSnapshot;else invalid=true}}catch{invalid=true}
  cache.set(key,{raw,snapshot,invalid});return snapshot
}
export function writeProjection(snapshot:WorkspaceSnapshot) {
  readSnapshot(PROJECTION_KEY)
  const old=cache.get(PROJECTION_KEY)!
  // Never overwrite the only surviving copy of damaged cache/drafts. If the
  // recovery copy cannot be saved (quota), fail this write and keep the original.
  if(old.invalid&&old.raw)localStorage.setItem(`${PROJECTION_KEY}:recovery:${Date.now()}`,old.raw)
  localStorage.setItem(PROJECTION_KEY,JSON.stringify(snapshot));cache.delete(PROJECTION_KEY)
}
let merged:{archive:WorkspaceSnapshot;projection:WorkspaceSnapshot;value:WorkspaceSnapshot}|undefined
export function readMergedSnapshot():WorkspaceSnapshot {
  const archive=readSnapshot(LEGACY_WORKSPACE_KEY),projection=readSnapshot(PROJECTION_KEY)
  if(merged?.archive===archive&&merged.projection===projection)return merged.value
  const merge=<T extends {id:string}>(current:T[],old:T[])=>[...current,...old.filter(item=>!current.some(next=>next.id===item.id))]
  const value={...projection,routes:merge(projection.routes,archive.routes),knowledge:archive.knowledge,conversations:merge(projection.conversations,archive.conversations),lessons:archive.lessons}
  merged={archive,projection,value};return value
}
export const projectionDraft=()=>structuredClone(readSnapshot(PROJECTION_KEY))
export const archivedWorkspace=()=>readSnapshot(LEGACY_WORKSPACE_KEY)

export function localRecoveryAvailable(){
  readSnapshot(LEGACY_WORKSPACE_KEY);readSnapshot(PROJECTION_KEY)
  return accountRecoveryAvailable()||[...cache.values()].some(entry=>entry.invalid)||Object.keys(localStorage).some(key=>key.startsWith(`${PROJECTION_KEY}:recovery:`))
}
export async function exportLocalArchive(){
  const backup=await accountStorageForExport()
  const data={...backup.local,sessionDrafts:backup.session}
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download='threadpeak-local-archive.json';a.click();URL.revokeObjectURL(url)
}
