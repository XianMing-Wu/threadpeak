import {lazy,Suspense,useEffect,useState,type RefObject} from 'react';
import lettering from './assets/interview-lettering.svg';
import {interviewTurns,type StoryState} from './interview';
import type {ScrollTransition} from './scroll-transition';
import './interview.css';
const ScrollRouteScene=lazy(()=>import('./ScrollRouteScene'));

export function InterviewScene({story,beat,transition}:{story:StoryState;beat:number;transition:RefObject<ScrollTransition>}){
 const turn=interviewTurns[beat];
 const [warmed,setWarmed]=useState(false);
 useEffect(()=>{if(story.warm)setWarmed(true);},[story.warm]);
 return <section className="interview-scene" aria-label="通过访谈明确目标，再规划学习路线" aria-hidden={!story.visible} inert={!story.visible}>
  <header className="interview-heading"><h2><span>把目标聊清楚，</span><img src={lettering} alt="走自己的路。"/></h2></header>
  <div className="interview-dialogue" aria-label="刘看山访谈示例">
   <div className="interview-chapter"><span className="chapter-count">0{beat+1}<i> / 03</i></span><span>{turn.label}</span><div className="interview-measure" aria-hidden="true">{interviewTurns.map((t,i)=><i key={t.id} data-active={beat>=i}/>)}</div></div>
   <div className="kanshan-question"><p>{turn.question}</p><svg viewBox="0 0 270 126" preserveAspectRatio="none" aria-hidden="true"><path d="M21 8Q3 10 5 32L7 87Q8 102 26 103L123 103Q137 102 145 119Q139 100 163 102L244 100Q263 98 263 77L261 29Q260 7 241 7Q132 3 21 8Z"/></svg>
   <img className="kanshan-interviewer" src={`${import.meta.env.BASE_URL}introduction/interview/kanshan-ink.png`} alt="刘看山面向学习者，抬手交流" width="1254" height="1254"/></div>
   <div className="interview-intent" data-beat={beat}>
    {beat===0?<p>为求职，做一个<br/><em>懂资料的文档助手。</em></p>:beat===1?<p>带着已有的基础，<br/><em>从第一次调用出发。</em></p>:<p>把应用做好，<br/><em>也把思路讲清楚。</em></p>}
    <span>{beat===0?'让想法，落到一件具体的作品。':beat===1?'Python · HTTP · 下一步': '每周六小时，先完成可验证的小步骤。'}</span>
   </div>
  </div>
  {warmed&&<Suspense fallback={null}><ScrollRouteScene transition={transition}/></Suspense>}
  <p className="interview-example">访谈片段 · 确认目标、基础、时间与限制</p>
 </section>;
}
