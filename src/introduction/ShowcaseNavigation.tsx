import {useEffect,useRef,type RefObject} from 'react';
import type {ScrollTransition} from './scroll-transition';
import {requestStoryStep} from './scroll-transition';
import {part} from './learning-motion';
import {GITHUB_URL} from './showcase-links';
import {EntryLink,ScrollMouse,ScrollChevrons,NavigationOrnaments} from './ShowcaseControls';
import './finale.css';
export function ShowcaseNavigation({transition}:{transition:RefObject<ScrollTransition>}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{let frame=0;const tick=()=>{const nav=ref.current!,p=transition.current.progress,fade=1-part(p,58.8,59.9);nav.style.opacity=String(fade);nav.style.transform=`translateY(${(1-fade)*-12}px)`;nav.inert=fade<.1;nav.style.visibility=fade<.001?'hidden':'visible';nav.setAttribute('aria-hidden',String(fade<.001));nav.style.setProperty('--journey-progress',String(Math.min(1,p/61.2)));frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[transition]);
 return <nav className="showcase-navigation" aria-label="产品导航" ref={ref}>
  <NavigationOrnaments/>
  <a className="showcase-github" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 查看 ThreadPeak 源码"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.21.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.54 2.35 1.1 2.93.84.09-.65.35-1.1.64-1.35-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.67-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.69 1.03 1.58 1.03 2.67 0 3.85-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg><span>GitHub</span><svg className="github-outbound" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 14L14 6M6 6H14V14"/></svg></a>
  <button className="showcase-scroll" onClick={()=>requestStoryStep()} aria-label="点击这里，向下浏览一步"><ScrollMouse/><span className="scroll-copy"><strong>滚轮向下</strong><span>点击这里，向下看一步</span></span><ScrollChevrons/></button>
  <EntryLink className="showcase-login">登录问山</EntryLink>
 </nav>;
}
