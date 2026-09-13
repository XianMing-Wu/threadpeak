import {act,cleanup,render,screen} from '@testing-library/react'
import {afterEach,expect,test,vi} from 'vitest'
import {createCharacterView} from '../../src/introduction/characters/CharacterView.jsx'
import type {CharacterOptions,CharacterPlayer} from '../../src/introduction/characters/01-工程师-安全帽/index.js'
import {loadRiveBytes,loadRiveRuntime} from '../../src/introduction/rive-loader.js'

const runtimeFactory=vi.hoisted(()=>vi.fn(async(_options:{wasmBinary:Uint8Array})=>({runtime:true})))
vi.mock('../../src/vendor/introduction-rive/canvas_advanced.mjs',()=>({default:runtimeFactory}))
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks()})

function setup(){
 const attempts:{options:CharacterOptions;player:CharacterPlayer}[]=[]
 const mount=vi.fn((_host:HTMLElement|string,options:CharacterOptions={})=>{
  const player={destroy:vi.fn()} as unknown as CharacterPlayer
  attempts.push({options,player});return player
 })
 return {attempts,mount,Character:createCharacterView(mount,{id:'engineer',label:'工程师'},'/portrait.webp')}
}

test('failed live assets retain the real portrait and recover once without red error placeholders',async()=>{
 vi.useFakeTimers();const{Character,attempts,mount}=setup();render(<Character/> )
 const poster=screen.getByRole('img',{name:'工程师（静态展示）'})
 expect(poster.style.display).toBe('block')
 act(()=>attempts[0].options.onError?.(new Error('HTTP 503')))
 expect(screen.queryByRole('alert')).toBeNull();expect(poster.style.display).toBe('block')
 await act(()=>vi.advanceTimersByTimeAsync(1000))
 expect(mount).toHaveBeenCalledTimes(2);expect(attempts[0].player.destroy).toHaveBeenCalled()
 act(()=>attempts[1].options.onReady?.(attempts[1].player))
 expect(poster.style.display).toBe('none')
})

test('permanent failure has a finite recovery budget; replay mounts again and cancels stale work',async()=>{
 vi.useFakeTimers();const{Character,attempts,mount}=setup();const ready=vi.fn()
 const view=render(<Character key="first" onReady={ready}/> )
 act(()=>attempts[0].options.onError?.(new Error('bad riv')))
 await act(()=>vi.advanceTimersByTimeAsync(1000))
 act(()=>attempts[1].options.onError?.(new Error('bad riv')))
 await act(()=>vi.advanceTimersByTimeAsync(60000))
 expect(mount).toHaveBeenCalledTimes(2)
 view.rerender(<Character key="replay" onReady={ready}/> )
 expect(mount).toHaveBeenCalledTimes(3)
 act(()=>attempts[1].options.onReady?.(attempts[1].player))
 expect(ready).not.toHaveBeenCalled()
 act(()=>attempts[2].options.onError?.(new Error('offline')))
 view.unmount();await vi.advanceTimersByTimeAsync(1000)
 expect(mount).toHaveBeenCalledTimes(3);expect(attempts[2].player.destroy).toHaveBeenCalled()
})

test('resources reject HTML fallback pages and HTTP failure before decoding',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('<!doctype html>')).mockResolvedValueOnce(new Response('',{status:404})).mockResolvedValueOnce(new Response(new Uint8Array([82,73,86,69,1])))
 vi.stubGlobal('fetch',fetcher)
 await expect(loadRiveBytes('/wrong')).rejects.toThrow('Invalid character riv')
 await expect(loadRiveBytes('/missing')).rejects.toThrow('HTTP 404')
 expect(await loadRiveBytes('/valid')).toEqual(new Uint8Array([82,73,86,69,1]))
})

test('shared WASM initialization evicts failure and accepts valid bytes even with wrong MIME',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValue(new Response(new Uint8Array([0,97,115,109]),{headers:{'Content-Type':'application/octet-stream'}}))
 vi.stubGlobal('fetch',fetcher)
 await expect(loadRiveRuntime('/recovery.wasm')).rejects.toThrow('503')
 const a=loadRiveRuntime('/recovery.wasm'),b=loadRiveRuntime('/recovery.wasm')
 expect(a).toBe(b);await expect(a).resolves.toEqual({runtime:true})
 expect(fetcher).toHaveBeenCalledTimes(2);expect(runtimeFactory).toHaveBeenCalledTimes(1)
 expect(runtimeFactory.mock.calls[0][0]).toEqual({wasmBinary:new Uint8Array([0,97,115,109])})
})

test('hung transfers time out and caller unmount aborts only its own resource request',async()=>{
 vi.useFakeTimers()
 vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>{
  const signal=options.signal as AbortSignal
  if(signal.aborted)reject(signal.reason)
  else signal.addEventListener('abort',()=>reject(signal.reason),{once:true})
 })))
 const timed=expect(loadRiveBytes('/hung')).rejects.toMatchObject({name:'TimeoutError'})
 await vi.advanceTimersByTimeAsync(12000);await timed
 const owner=new AbortController(),other=new AbortController()
 const first=expect(loadRiveBytes('/first',owner.signal)).rejects.toMatchObject({name:'AbortError'})
 const second=expect(loadRiveBytes('/second',other.signal)).rejects.toMatchObject({name:'TimeoutError'})
 owner.abort();await first;expect(other.signal.aborted).toBe(false)
 await vi.advanceTimersByTimeAsync(12000);await second
})
