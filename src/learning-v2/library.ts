import { useEffect, useState } from 'react'
import { ensureSession, productRequest } from './client'
import { hydrateProductLibrary } from '../workspace/store'

export type { ProductLibrary, ServerHistory } from '@threadpeak/contracts/product-library'
import { ProductLibrarySchema, type ProductLibrary } from '@threadpeak/contracts/product-library'
let generation=0
let cache:ProductLibrary|undefined,loading:Promise<ProductLibrary>|undefined
const listeners=new Set<()=>void>()
if(typeof window!=='undefined')window.addEventListener('threadpeak:account-change',()=>clearProductLibrary())
export function clearProductLibrary(){generation++;cache=undefined;loading=undefined;listeners.forEach(fn=>fn())}
export function refreshProductLibrary(){
  if(loading)return loading
  const request=(async()=>{
    // Session establishment can change the account and invalidate the old cache.
    // Capture its generation only after that boundary has completed.
    await ensureSession()
    const epoch=generation
    const raw=await productRequest<unknown>('/api/v2/library')
    const data=ProductLibrarySchema.parse(raw)
    if(epoch!==generation)throw new Error('账号已改变，请重新读取。')
    hydrateProductLibrary(data);cache=data;listeners.forEach(fn=>fn());return data
  })().finally(()=>{if(loading===request)loading=undefined})
  loading=request;return request
}
export function useProductLibrary(){
  const [data,setData]=useState(cache),[error,setError]=useState('')
  useEffect(()=>{let active=true;const update=()=>setData(cache);listeners.add(update);void refreshProductLibrary().catch(e=>{if(active)setError(e.message)});return()=>{active=false;listeners.delete(update)}},[])
  return {data,error,reload:()=>refreshProductLibrary().then(()=>setError('')).catch(e=>setError(e.message))}
}
