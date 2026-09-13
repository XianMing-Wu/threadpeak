import {useRef} from 'react'
import {act,cleanup,fireEvent,render} from '@testing-library/react'
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {requestStoryStep,useScrollTransition} from '../../src/introduction/scroll-transition'
import {SCROLL_SCREENS} from '../../src/introduction/scroll-pacing'

let now=0,next=0,y=0;
const frames=new Map<number,FrameRequestCallback>();
function advance(ms:number){act(()=>{for(let elapsed=0;elapsed<ms;elapsed+=16){now+=16;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now))}})}
function Story(){const root=useRef<HTMLElement>(null);useScrollTransition(root);return <main ref={root}/>}

beforeEach(()=>{
 history.replaceState(null,'','/introduction.html');now=0;next=0;y=0;frames.clear();
 vi.spyOn(performance,'now').mockImplementation(()=>now);
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++next,fn);return next});
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockImplementation(()=>Math.round((SCROLL_SCREENS+1)*window.innerHeight));
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({top:-y,left:0,width:800,height:(SCROLL_SCREENS+1)*window.innerHeight,right:800,bottom:(SCROLL_SCREENS+1)*window.innerHeight-y,x:0,y:-y,toJSON:()=>({})}));
 vi.spyOn(window,'scrollTo').mockImplementation((options)=>{y=Math.round((options as ScrollToOptions).top??0);window.dispatchEvent(new Event('scroll'))});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});

test('each click advances once and stays there; native wheel remains interruptible',()=>{
 const {container}=render(<Story/>);const root=container.querySelector('main')!;
 advance(4000);expect(root.dataset.storyStep).toBe('orbit');expect(y).toBe(0);
 act(()=>requestStoryStep());advance(1500);
 expect(root.dataset.storyStep).toBe('goals');expect(root.dataset.storyState).toBe('settled');
 advance(5000);expect(root.dataset.storyStep).toBe('goals');
 const wheel=new WheelEvent('wheel',{deltaY:120,cancelable:true});fireEvent(window,wheel);
 expect(wheel.defaultPrevented).toBe(false);
 act(()=>{y+=window.innerHeight*.65;window.dispatchEvent(new Event('scroll'))});
 advance(1600);expect(root.dataset.storyState).toBe('settled');expect(root.dataset.storyStep).toBe('interview');
});

test('another click advances another pose and unmount cancels its animation frame',()=>{
 const view=render(<Story/>);act(()=>requestStoryStep());advance(1500);
 act(()=>requestStoryStep());advance(1500);const root=view.container.querySelector('main')!;
 expect(root.dataset.storyStep).toBe('interview');advance(6000);expect(root.dataset.storyStep).toBe('interview');
 view.unmount();expect(frames.size).toBe(0);
});
