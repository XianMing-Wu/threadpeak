import { COVER_IDS, coverSrcSet } from '../ui/covers'
import authors from '../learning-v2/author-hero-data.json'

const images = new Map<string, HTMLImageElement>()
function prepareImage(src: string, sizes?: string) {
  const key=src+(sizes??'')
  if(images.has(key))return
  const image=new Image();images.set(key,image)
  image.decoding='async'
  if(sizes){image.sizes=sizes;image.srcset=coverSrcSet(src)??''}
  image.src=src
  if(typeof image.decode==='function')void image.decode().catch(()=>images.delete(key))
  else image.onerror=()=>images.delete(key)
}
const modules = {
  knowledge: () => Promise.all([import('../pages/Collections'),import('../ui/shelf-scene'),import('../ui/shelf-reflections').then(m=>m.loadShelfReflections())]),
  paths: () => import('../pages/Collections'),
  authors: () => import('../learning-v2/Authors'),
}
const pending=new Map<string,Promise<unknown>>()
/** Only static assets and code: no model calls, private data, or hidden WebGL contexts. */
export function preloadPage(page:string) {
  if(!(page in modules)||pending.has(page))return
  pending.set(page,modules[page as keyof typeof modules]().catch(()=>pending.delete(page)))
  if(page==='authors')authors.forEach(a=>prepareImage(a.avatar))
  else COVER_IDS.forEach(id=>prepareImage(`${import.meta.env.BASE_URL}art/covers/${id}.webp`,page==='knowledge'?'(max-width: 560px) 132px, 168px':'(max-width: 760px) 90vw, 360px'))
}
export function preloadWorkspacePages() {
  let stopped=false,handle:number
  const pages=['paths','knowledge','authors']
  const next=()=>{
    if(stopped||!pages.length)return
    preloadPage(pages.shift()!)
    handle=window.setTimeout(schedule,300)
  }
  const schedule=()=>{
    if(stopped)return
    if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(next,{timeout:2000})
    else handle=window.setTimeout(next,200)
  }
  schedule()
  return()=>{stopped=true;clearTimeout(handle)}
}
