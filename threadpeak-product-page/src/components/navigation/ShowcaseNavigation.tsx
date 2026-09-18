import { useEffect,useRef,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { requestStoryStep } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { THANKS_START } from "../../scenes/finale/finale-motion.ts";
import "../../styles/finale.css";
import { NavigationOrnaments,ScrollChevrons,ScrollMouse } from "./ShowcaseControls.tsx";
export function ShowcaseNavigation({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => { let frame = 0; const tick = () => { const nav = ref.current!, p = legacyRaw(transition.current.progress), hide = p >= THANKS_START - .02; nav.style.opacity = hide ? '0' : '1'; nav.style.transform = ''; nav.inert = hide; nav.style.visibility = hide ? 'hidden' : 'visible'; nav.setAttribute('aria-hidden', String(hide)); nav.style.setProperty('--journey-progress', String(Math.min(1, Math.max(0, p / THANKS_START)))); frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [transition]);
    return <nav className="showcase-navigation" aria-label="产品导航" ref={ref}>
  <NavigationOrnaments />
  <button className="showcase-scroll" onClick={() => requestStoryStep()} aria-label="点击这里，向下浏览一步"><ScrollMouse /><span className="scroll-copy"><strong>滚轮向下</strong><span>点击这里，向下看一步</span></span><ScrollChevrons /></button>
 </nav>;
}
