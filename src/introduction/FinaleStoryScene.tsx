import {useEffect,useRef,useState,type RefObject} from 'react';
import type {ScrollTransition} from './scroll-transition';
import {finaleAt,FINALE_START} from './finale-motion';
import {EntryLink} from './ShowcaseControls';
import {PaperIllustration,FavoritesIllustration,GoalIllustration} from './FinaleIllustrations';
import {GoalSearchIllustration,goalExamples} from './GoalSearchIllustration';
import heading from './assets/finale-heading.svg';
import {HomeLandscape} from '../ui/HomeLandscape';
import './finale.css';
export function FinaleStoryScene({transition}:{transition:RefObject<ScrollTransition>}){
 const host=useRef<HTMLElement>(null),[page,setPage]=useState(0),[collection,setCollection]=useState(0),[focused,setFocused]=useState(false),[example,setExample]=useState(0),[searchActive,setSearchActive]=useState(false);
 const searchVisible=useRef(false);
 useEffect(()=>{const el=host.current!,stage=el.querySelector<HTMLElement>('.finale-stage')!;let frame=0,w=0,h=0;const size=new ResizeObserver(()=>{w=el.clientWidth;h=el.clientHeight;});size.observe(el);
  const tick=()=>{const p=transition.current.progress,s=finaleAt(p),active=p>=FINALE_START;const visible=active&&s.search>.99;if(visible!==searchVisible.current){searchVisible.current=visible;setSearchActive(visible);}el.dataset.active=String(active);el.inert=!active||s.enter<.98;el.style.visibility=active?'visible':'hidden';el.setAttribute('aria-hidden',String(!active));el.style.opacity=String(s.enter);el.style.setProperty('--finale-enter',String(s.enter));if(active&&w&&h){const narrow=w<760,W=narrow?700:1400,H=narrow?1540:820,scale=Math.min((w-24)/W,(h-24)/H);stage.style.width=`${W}px`;stage.style.height=`${H}px`;stage.style.transform=`translate3d(${(w-W*scale)/2}px,${(h-H*scale)/2}px,0) scale(${scale})`;el.dataset.narrow=String(narrow);for(const name of ['paper','favorites','goal','search','heading','action'] as const){const n=el.querySelector<HTMLElement>(`[data-final-part=${name}]`)!;n.style.opacity=String(s[name]);n.style.transform=`translateY(${(1-s[name])*24}px)`;n.inert=s[name]<.99;}}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);size.disconnect();};
 },[transition]);
 return <section className="finale-scene" ref={host} aria-label="从一个目标、一篇论文或知乎收藏开始学习" data-active="false" aria-hidden="true" inert><div className="finale-stage">
  <svg className="finale-connecting-thread" viewBox="0 0 1400 820" fill="none" aria-hidden="true"><path d="M307 546C331 687 452 681 577 668M1092 546C1069 688 948 679 826 668" stroke="#e5edf7" strokeWidth="1.1"/><path className="finale-thread-light" d="M307 546C331 687 452 681 577 668M1092 546C1069 688 948 679 826 668" stroke="#a0c4ee" pathLength="100"/><path d="M636 293Q700 312 764 293" stroke="#e7eff8"/></svg>
  <button className="finale-island finale-paper" data-final-part="paper" data-page={page} onClick={()=>setPage(v=>1-v)} aria-label="翻阅 PDF 论文演示"><PaperIllustration page={page}/><span className="finale-island-caption"><strong>从一篇论文开始</strong><span>上传 PDF，结合目标拆解论文中的难点。</span><small>{page===0?'点击，翻到方法页':'点击，返回论文首页'} <b>↗</b></small></span></button>
  <button className="finale-island finale-favorites" data-final-part="favorites" data-collection={collection} onClick={()=>setCollection(v=>1-v)} aria-label="切换知乎收藏夹演示"><FavoritesIllustration collection={collection}/><span className="finale-island-caption"><strong>让收藏，用在自己的目标上</strong><span>授权选择知乎收藏，把阅读接进学习。</span><small>{collection===0?'点击，换一本收藏':'点击，回到 AI 收藏'} <b>↗</b></small></span></button>
  <button className="finale-island finale-goal" data-final-part="goal" aria-label="只显示目标所需的学习路线" aria-pressed={focused} onClick={()=>setFocused(v=>!v)}><GoalIllustration focused={focused}/><span className="finale-island-caption"><strong>只学，通往目标的那部分</strong><small>{focused?'阶段示意 · 点击还原全貌':'点击，看知识如何变成目标路线'} <b>↗</b></small></span></button>
  <button className="finale-island finale-search" data-final-part="search" onClick={()=>setExample(v=>(v+1)%goalExamples.length)} aria-label="换一个目标，演示如何开始学习"><GoalSearchIllustration key={example} example={example} active={searchActive}/><span className="finale-island-caption"><strong>只带一个目标，也能开始</strong><span>不用准备文件或收藏，<br/>说说你想做成什么。</span><small>点击，试试另一个目标 <b>↗</b></small></span></button>
  <header className="finale-heading" data-final-part="heading"><HomeLandscape/><span className="finale-eyebrow">问山 · ThreadPeak</span><h2><img src={heading} alt="想做什么，就学什么。"/></h2><p>从想法出发，聊清目标，选适合自己的 3D 学习路线。<br/>读资料、问 AI、问博主，让理解长成自己的知识脉络。</p></header>
  <div className="finale-action" data-final-part="action"><EntryLink className="finale-login">开始我的学习</EntryLink><span>从你的想法开始，把学习用在实现它的路上。</span></div>
  <span className="finale-signature">时间有限，把学习留给真正想做的事。</span>
 </div></section>;
}
