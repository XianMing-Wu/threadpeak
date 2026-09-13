import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {goalTypingAt} from './goal-typing';

export const goalExamples=[
 {goal:'做一个能回答资料问题的助手',steps:['调用模型','接入资料','检查回答']},
 {goal:'用 Python 自动整理每周报表',steps:['读取表格','整理数据','生成报表']},
 {goal:'读懂并复现一篇注意力论文',steps:['理解公式','运行基线','对照结果']},
] as const;

/** Complete characters, a measured caret and the route use the same clock. */
export function GoalSearchIllustration({example,active=true}:{example:number;active?:boolean}){
 const item=goalExamples[example],letters=Array.from(item.goal);
 const host=useRef<SVGSVGElement>(null),text=useRef<SVGTextElement>(null),caret=useRef<SVGPathElement>(null),[count,setCount]=useState(0);
 useEffect(()=>{
  if(!active){setCount(0);return;}
  const el=host.current!,motion=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,time=0,last=0,painted=-1;
  const draw=(now:number)=>{
   if(document.hidden){last=0;return;}
   if(last)time+=Math.min(.05,(now-last)/1000);last=now;
   const s=goalTypingAt(time,letters.length,motion.matches);
   if(s.count!==painted){painted=s.count;setCount(s.count);}
   el.dataset.typingPhase=s.phase;el.style.setProperty('--goal-results',String(s.results*s.fade));el.style.setProperty('--goal-wire',String((1-s.results)*100));el.style.setProperty('--goal-fade',String(s.fade));el.style.setProperty('--goal-press',String(1-s.press*.12));
   if(caret.current)caret.current.style.opacity=s.caret?'1':'0';
   if(!motion.matches)frame=requestAnimationFrame(draw);
  };
  const resume=()=>{cancelAnimationFrame(frame);last=0;if(!document.hidden)frame=requestAnimationFrame(draw);};
  frame=requestAnimationFrame(draw);document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);motion.removeEventListener('change',resume);};
 },[active,example,letters.length]);
 useLayoutEffect(()=>{let alive=true;const measure=()=>{if(alive&&text.current&&caret.current){const width=text.current.getComputedTextLength?.()??0;caret.current.setAttribute('transform',`translate(${Math.min(298,width+2)} 0)`)}};measure();void document.fonts?.ready.then(measure);return()=>{alive=false}},[count,active]);
 return <svg ref={host} className="finale-drawing goal-search-drawing" data-typed-count={count} viewBox="0 0 370 260" fill="none" role="img" aria-label={`输入目标：${item.goal}，整理出${item.steps.join('、')}三个学习方向`}>
  <ellipse cx="185" cy="241" rx="131" ry="10" fill="#f6f9fc"/>
  <path d="M27 61 342 52 349 151 33 160Z" fill="#f5f9ff" stroke="#e0ebfa"/>
  <rect x="16" y="37" width="336" height="112" rx="15" fill="white" stroke="#b9d3f5" strokeWidth="1.3"/>
  <circle cx="36" cy="59" r="3.5" fill="#3a80ef"/>
  <text x="48" y="63" fontSize="11" fill="#7e98b7">我想实现</text>
  <text className="goal-search-text" ref={text} x="33" y="100" fontSize="15" fill="#365676">{letters.slice(0,count).join('')}</text>
  <path ref={caret} className="goal-search-caret" d="M33 84v19" stroke="#357deb" strokeWidth="1.7"/>
  <text x="33" y="131" fontSize="10" fill="#8fa5bb">一个目标，就是起点</text>
  <g className="goal-search-submit"><rect x="302" y="114" width="30" height="24" rx="7" fill="#edf5ff" stroke="#9fc3f1"/><path d="M310 126h13m-5-5 5 5-5 5" stroke="#427ce0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></g>
  <g className="goal-search-results">
   <path className="goal-search-connection" d="M185 150v21M64 209v-18q0-12 12-12h218q12 0 12 12v18M185 172v37" stroke="#9bbfed" pathLength="100"/>
   {item.steps.map((step,i)=><g className="goal-search-result" key={step}>
    <circle cx={64+i*121} cy="208" r="13" fill={i===2?'#edf8f4':'#f2f7ff'} stroke={i===2?'#8fc5b3':'#a8c6ef'}/>
    <text x={64+i*121} y="212" textAnchor="middle" fill={i===2?'#438d76':'#5486ce'} fontSize="11">{i+1}</text>
    <text x={64+i*121} y="237" textAnchor="middle" fontSize="12" fill="#647e9b">{step}</text>
   </g>)}
  </g>
 </svg>;
}
