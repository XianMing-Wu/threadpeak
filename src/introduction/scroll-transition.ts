import {STORY_STEPS,CHAPTER_STEPS,easeStep,settleIndex,nearestStep} from './story-steps';
import {useEffect,useRef,type RefObject} from 'react';
import {progressForScroll,scrollScreensAt,SCROLL_SCREENS} from './scroll-pacing';
import {clamp} from './orbit';

export const mix=(a:number,b:number,p:number)=>a+(b-a)*p;
export const smooth=(value:number)=>{const p=clamp(value,0,1);return p*p*(3-2*p);};
export const segment=(p:number,start:number,end:number)=>smooth((p-start)/(end-start));
export type ScrollTransition={target:number;progress:number;locked:boolean;slots:number[]};

const STEP_EVENT='threadpeak:story-step';
const SEEK_EVENT='threadpeak:story-seek';
export const requestStoryStep=(direction=1)=>window.dispatchEvent(new CustomEvent(STEP_EVENT,{detail:direction}));
export const seekStory=(raw:number)=>window.dispatchEvent(new CustomEvent(SEEK_EVENT,{detail:raw}));

export function useScrollTransition(root:RefObject<HTMLElement|null>){
 const state=useRef<ScrollTransition>({target:0,progress:0,locked:false,slots:[0,1,2,3,4,5]});
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const diagnostic=location.pathname.startsWith('/qa/'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,last=0,lastInput=-Infinity,lastY=window.scrollY,syntheticY:number|null=null,direction=1,resizeFrame=0;
  let snap:{from:number;to:number;fromY:number;toY:number;start:number;duration:number}|null=null;
  const top=()=>el.getBoundingClientRect().top+window.scrollY;
  const travel=()=>Math.max(1,el.offsetHeight-window.innerHeight);
  const rawAtScroll=()=>progressForScroll(SCROLL_SCREENS*(window.scrollY-top())/travel());
  const yAtRaw=(raw:number)=>top()+scrollScreensAt(raw)/SCROLL_SCREENS*travel();
  const placeScroll=(y:number)=>{syntheticY=y;lastY=y;window.scrollTo({top:y,behavior:'instant'});};
  const report=()=>{
   const nearest=nearestStep(state.current.progress),exact=Math.abs(STORY_STEPS[nearest].raw-state.current.progress)<.00001;
   el.dataset.storyProgress=state.current.progress.toFixed(6);el.dataset.storyTarget=state.current.target.toFixed(6);
   el.dataset.storyCount=String(STORY_STEPS.length);el.dataset.storyMode=diagnostic?'diagnostic':'continuous';
   el.dataset.storyIndex=String(nearest);el.dataset.storyStep=STORY_STEPS[nearest].id;
   el.dataset.storyState=snap?'settling':exact?'settled':'scrolling';
  };
  const seek=(raw:number,instant=false)=>{
   const to=STORY_STEPS[settleIndex(raw,direction)].raw;
   state.current.target=to;
   if(instant||reduced.matches){snap=null;state.current.progress=to;placeScroll(yAtRaw(to));report();return;}
   const from=state.current.progress,next=nearestStep(to),other=Math.max(0,Math.min(STORY_STEPS.length-1,next+(from>to?1:-1)));
   const fraction=Math.min(1,Math.abs(to-from)/Math.max(.01,Math.abs(to-STORY_STEPS[other].raw)));
   snap={from,to,fromY:window.scrollY,toY:yAtRaw(to),start:performance.now(),duration:Math.max(240,Math.min(850,STORY_STEPS[next].duration*fraction))};report();
  };
  const onScroll=()=>{
   const y=window.scrollY;
   if(syntheticY!==null&&Math.abs(y-syntheticY)<2)return;
   syntheticY=null;direction=Math.sign(y-lastY)||direction;lastY=y;lastInput=performance.now();snap=null;
   state.current.target=rawAtScroll();
  };
  // Passive observation only. The browser owns wheel, momentum, touch and keys.
  // A fresh gesture immediately interrupts automatic settling in either direction.
  const intent=(e:Event)=>{
   if(e.defaultPrevented)return;
   if(e instanceof WheelEvent&&(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX)))return;
   if(e instanceof KeyboardEvent&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))return;
   if(snap){snap=null;syntheticY=null;state.current.target=rawAtScroll();}lastInput=performance.now();
  };
  const onStep=(e:Event)=>{direction=Math.sign((e as CustomEvent<number>).detail)||1;const current=settleIndex(state.current.target,direction);seek(STORY_STEPS[Math.max(0,Math.min(STORY_STEPS.length-1,current+(Math.abs(STORY_STEPS[current].raw-state.current.target)<.00001?direction:0)))].raw);};
  const onSeek=(e:Event)=>{const raw=STORY_STEPS[nearestStep((e as CustomEvent<number>).detail)].raw;direction=Math.sign(raw-state.current.progress)||1;seek(raw,true);};
  const hash=()=>{const id=CHAPTER_STEPS[location.hash.slice(1)],raw=STORY_STEPS.find(s=>s.id===id)?.raw??0;seek(raw,true);};
  const resize=()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(diagnostic){state.current.target=rawAtScroll();return;}snap=null;const raw=STORY_STEPS[settleIndex(state.current.target,direction)].raw;seek(raw,true);});};
  const visibility=()=>{if(document.hidden&&!diagnostic)seek(state.current.target,true);};
  const tick=(now:number)=>{
   const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
   if(diagnostic){state.current.progress=state.current.target;}
   else if(snap){
    const t=Math.min(1,(now-snap.start)/snap.duration),ease=easeStep(t);
    state.current.progress=mix(snap.from,snap.to,ease);placeScroll(mix(snap.fromY,snap.toY,ease));
    if(t===1){state.current.progress=snap.to;snap=null;}
   }else{
    state.current.progress=reduced.matches?state.current.target:mix(state.current.progress,state.current.target,1-Math.exp(-dt*24));
    if(Math.abs(state.current.progress-state.current.target)<.00001)state.current.progress=state.current.target;
    if(now-lastInput>140){const settled=STORY_STEPS[settleIndex(state.current.target,direction)].raw;if(Math.abs(settled-state.current.target)>.000001)seek(settled);}
   }
   report();frame=requestAnimationFrame(tick);
  };
  const observer=new ResizeObserver(resize);observer.observe(el);
  const restoration=history.scrollRestoration;history.scrollRestoration='manual';
  if(diagnostic)state.current.target=rawAtScroll();else hash();
  window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',resize);
  if(!diagnostic){window.addEventListener('wheel',intent,{passive:true});window.addEventListener('touchmove',intent,{passive:true});window.addEventListener('keydown',intent);window.addEventListener(STEP_EVENT,onStep);window.addEventListener(SEEK_EVENT,onSeek);window.addEventListener('hashchange',hash);}
  document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(resizeFrame);observer.disconnect();history.scrollRestoration=restoration;
   window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',resize);window.removeEventListener('wheel',intent);window.removeEventListener('touchmove',intent);window.removeEventListener('keydown',intent);window.removeEventListener(STEP_EVENT,onStep);window.removeEventListener(SEEK_EVENT,onSeek);window.removeEventListener('hashchange',hash);document.removeEventListener('visibilitychange',visibility);
  };
 },[root]);
 return state;
}

export function columnLayout(width:number,height:number){
 const narrow=width<620;
 const compact=width<=940;
 const top=narrow&&height<510?108:Math.max(narrow?126:118,Math.min(152,height*.22));
 const bottom=height-38;
 const step=(bottom-top)/6;
 const size=Math.min(narrow?62:86,step*.79);
 const x=width*(narrow?.095:compact?.11:.32);
 return {x,top,step,size,labelX:x+size/2+(narrow?9:14),
  answerSize:Math.min(narrow?14:compact?16:Math.min(21,Math.max(16,width*.0145)),Math.max(11,(step-6)/3)),
  centerX:width*.12,centerY:height*.55,
  goalX:width*(narrow?.55:compact?.55:.655),goalTop:top,goalBottom:bottom};
}

export const goals=[
 {id:'application',title:'做出一个应用',subtitle:'让自己的资料，变成能用的问答助手。',compactSubtitle:'让资料变成自己的问答助手。',steps:'调用模型 → 接入资料 → 检查回答',tag:'把它用起来'},
 {id:'principles',title:'真正理解原理',subtitle:'讲清注意力如何计算，模型如何学习。',compactSubtitle:'讲清模型如何计算、学习。',steps:'必要基础 → 核心机制 → 自己讲清',tag:'弄懂为什么'},
 {id:'research',title:'复现一篇论文',subtitle:'理解具体方法，在实验中核对结果。',compactSubtitle:'复现方法，再核对实验结果。',steps:'读懂方法 → 运行基线 → 对比实验',tag:'亲手验证它'},
] as const;
export type GoalId=typeof goals[number]['id'];
export const characterGoals:GoalId[]=['application','principles','principles','application','principles','research'];
