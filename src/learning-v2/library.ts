import { useEffect, useState } from 'react'
import { productRequest } from './client'
import { hydrateProductLibrary } from '../workspace/store'

export type ServerHistory={id:string;resourceId:string;kind:'path'|'chat'|'learning';title:string;query:string;updatedAt:number;routeId?:string;conceptId?:string}
export type ProductLibrary={paths:any[];knowledge:{id:string;routeId:string;conceptId:string;title:string}[];conversations:ServerHistory[]}
let cache:ProductLibrary|undefined,loading:Promise<ProductLibrary>|undefined
const listeners=new Set<()=>void>()
export function clearProductLibrary(){cache=undefined;loading=undefined;listeners.forEach(fn=>fn())}
export function refreshProductLibrary(){
  return loading??=productRequest<ProductLibrary>('/api/v2/library').then(data=>{
    hydrateProductLibrary(data);cache=data;listeners.forEach(fn=>fn());return data
  }).finally(()=>{loading=undefined})
}
export function useProductLibrary(){
  const [data,setData]=useState(cache),[error,setError]=useState('')
  useEffect(()=>{let active=true;const update=()=>setData(cache);listeners.add(update);void refreshProductLibrary().catch(e=>{if(active)setError(e.message)});return()=>{active=false;listeners.delete(update)}},[])
  return {data,error,reload:()=>refreshProductLibrary().then(()=>setError('')).catch(e=>setError(e.message))}
}
