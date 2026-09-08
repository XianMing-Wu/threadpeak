import {IDBFactory} from 'fake-indexeddb'
import {beforeEach,vi} from 'vitest'
Object.defineProperty(globalThis,'localStorage',{value:window.localStorage,configurable:true})
Object.defineProperty(globalThis,'sessionStorage',{value:window.sessionStorage,configurable:true})
Object.defineProperty(HTMLElement.prototype,'scrollTo',{value:()=>{},configurable:true})
Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{value:()=>{},configurable:true})
class ResizeObserverStub {observe(){} unobserve(){} disconnect(){}}
Object.defineProperty(globalThis,'ResizeObserver',{value:ResizeObserverStub,configurable:true})
class IntersectionObserverStub {observe(){} unobserve(){} disconnect(){}}
Object.defineProperty(globalThis,'IntersectionObserver',{value:IntersectionObserverStub,configurable:true})
Object.defineProperty(window,'matchMedia',{value:()=>({matches:false,addEventListener(){},removeEventListener(){}}),configurable:true})
beforeEach(()=>{vi.unstubAllGlobals();vi.stubGlobal('indexedDB',new IDBFactory())})
