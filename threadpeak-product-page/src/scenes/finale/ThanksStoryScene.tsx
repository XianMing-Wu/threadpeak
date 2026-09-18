import { useEffect,useRef,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { team } from "../pitch/pitch-content.ts";
import { THANKS_START } from "./finale-motion.ts";
import "../../styles/finale.css";
export function ThanksStoryScene({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLElement>(null);
    useEffect(() => {
        const el = host.current!;
        let frame = 0;
        const tick = () => {
            const p = legacyRaw(transition.current.target);
            const active = p >= THANKS_START - .02;
            const enter = active ? 1 : 0;
            el.dataset.active = String(active);
            el.inert = !active || enter < .98;
            el.style.visibility = active ? 'visible' : 'hidden';
            el.setAttribute('aria-hidden', String(!active));
            el.style.opacity = String(enter);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [transition]);
    return <section className="finale-scene thanks-deck" ref={host} aria-label="感谢评委老师" data-active="false" aria-hidden="true" inert>
  <div className="thanks-copy">
   <p>问山 · ThreadPeak</p>
   <h2>感谢各位评委老师的聆听。</h2>
   <p className="thanks-line">从真实目标出发，走出属于自己的知识脉络。</p>
   <dl>
    <div><dt>队伍</dt><dd>{team.name}</dd></div>
    <div><dt>成员</dt><dd>{team.members}</dd></div>
    <div><dt>演讲</dt><dd>{team.speaker}</dd></div>
   </dl>
  </div>
 </section>;
}
