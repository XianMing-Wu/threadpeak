import { resolveHistoryReopen, type HistoryReopenResolution } from './resolve-history-reopen'

/** Isolated draft cache. Product sidebar reopen must not compose this into committed history success. */

export type HistoryExperience = 'answer' | 'route' | 'visual' | 'learning'

export type ChatHistoryEntry = {
  id:string
  title:string
  query:string
  experience:HistoryExperience
  updatedAt:number
  routeId?:string
  conceptId?:string
}

export const CHAT_LAUNCH_KEY='threadpeak-chat-launch'
export const ACTIVE_HISTORY_KEY='threadpeak-active-history'
export const HISTORY_CHANGE_EVENT='threadpeak:history-change'
export const HISTORY_OPEN_EVENT='threadpeak:history-open'
const HISTORY_KEY='threadpeak-chat-history'

function validEntry(value:unknown):value is ChatHistoryEntry {
  if(!value||typeof value!=='object')return false
  const entry=value as Partial<ChatHistoryEntry>
  return typeof entry.id==='string'&&typeof entry.title==='string'&&typeof entry.query==='string'&&
    (entry.experience==='answer'||entry.experience==='route'||entry.experience==='visual'||entry.experience==='learning')&&typeof entry.updatedAt==='number'
}

export function readChatHistory():ChatHistoryEntry[] {
  try {
    const raw=localStorage.getItem(HISTORY_KEY)
    if(raw===null)return []
    const parsed=JSON.parse(raw) as unknown
    return Array.isArray(parsed)?parsed.filter(validEntry).sort((a,b)=>b.updatedAt-a.updatedAt):[]
  } catch {
    return []
  }
}

function writeChatHistory(entries:ChatHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY,JSON.stringify(entries))
  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT))
}

export function addChatHistory(query:string,experience:HistoryExperience,extra?:{id?:string;routeId?:string;conceptId?:string;title?:string}):ChatHistoryEntry {
  const normalized=query.trim()
  const entries=readChatHistory()
  const existing=extra?.id
    ? entries.find((entry)=>entry.id===extra.id)
    : entries.find((entry)=>entry.query===normalized&&entry.experience===experience)
  const title=extra?.title?.trim()||(normalized.length>28?`${normalized.slice(0,28)}…`:normalized)
  const entry:ChatHistoryEntry={
    id:existing?.id??extra?.id??`chat-${Date.now().toString(36)}`,
    title,
    query:normalized,
    experience,
    routeId:extra?.routeId??existing?.routeId,
    conceptId:extra?.conceptId??existing?.conceptId,
    updatedAt:Date.now(),
  }
  sessionStorage.setItem(ACTIVE_HISTORY_KEY,entry.id)
  writeChatHistory([entry,...entries.filter((item)=>item.id!==entry.id)].slice(0,20))
  return entry
}

export function openChatHistory(entry:ChatHistoryEntry, conversation?: Parameters<typeof resolveHistoryReopen>[1]):HistoryReopenResolution {
  return resolveHistoryReopen(entry, conversation)
}

export function clearActiveHistory() {
  sessionStorage.removeItem(ACTIVE_HISTORY_KEY)
  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT))
}

export function clearChatHistory() {
  localStorage.setItem(HISTORY_KEY,'[]')
  sessionStorage.removeItem(ACTIVE_HISTORY_KEY)
  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT))
}
