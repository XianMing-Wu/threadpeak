import { useEffect,useRef,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { commerce } from "../pitch/pitch-content.ts";
import { COMMERCE_START,THANKS_START } from "./finale-motion.ts";
import "../../styles/finale.css";
export function CommerceStoryScene({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLElement>(null);
    useEffect(() => {
        const el = host.current!;
        let frame = 0;
        const tick = () => {
            const p = legacyRaw(transition.current.target);
            const active = p >= COMMERCE_START && p < THANKS_START;
            el.dataset.active = String(active);
            el.inert = !active;
            el.style.visibility = active ? 'visible' : 'hidden';
            el.setAttribute('aria-hidden', String(!active));
            el.style.opacity = active ? '1' : '0';
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [transition]);
    return <section className="finale-scene commerce-deck" ref={host} aria-label="问山接到知乎之后的商业价值" data-active="false" aria-hidden="true" inert>
  <div className="commerce-body">
   <header>
    <h2>三种角色，三种持续发生的价值。</h2>
    <p>一次路线很快结束。真正留下来的，是画布上的持续学习、旧文章被再次读到，以及高质量知识库被直接用上。</p>
   </header>
   <ol className="commerce-value">
    {commerce.map(item => <li key={item.who}><small>{item.who}</small><h3>{item.title}</h3><ul>{item.points.map(point => <li key={point}>{point}</li>)}</ul></li>)}
   </ol>
   <p className="commerce-note">这些是需要验证的商业路径，不是已经上线的收费能力。当前先确认：目标、路线、画布和作者网络，用户愿不愿意走完。</p>
  </div>
 </section>;
}
