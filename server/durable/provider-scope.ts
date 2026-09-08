import { AsyncLocalStorage } from 'node:async_hooks'

/** Only server-owned task identity; never take cache ownership from model output. */
export type ProviderScope = { ownerId:string; jobId:string; step:string; queueMs?:number; queue?:(detail?:string)=>Promise<void> }
export const providerScope = new AsyncLocalStorage<ProviderScope>()
