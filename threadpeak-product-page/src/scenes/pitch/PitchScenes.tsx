import { useEffect,useRef,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { pitchAt } from "../../core/story-clock.ts";
import poster from "../../../assets/images/illustrations/pitch-poster.jpg";
import { IntroMark,StepMark } from "./PitchCardMarks.tsx";
import { caseStudy,introBeats,team } from "./pitch-content.ts";
import "./pitch.css";
export function PitchScenes({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = host.current!;
        let frame = 0;
        const tick = () => {
            const pitch = pitchAt(transition.current.target);
            if (el.dataset.pitch !== pitch)
                el.dataset.pitch = pitch;
            el.style.opacity = pitch === 'story' ? '0' : '1';
            el.style.visibility = pitch === 'story' ? 'hidden' : 'visible';
            el.inert = pitch === 'story';
            if (pitch === 'cover') {
                const box = el.querySelector<HTMLElement>('.pitch-cover');
                const frame = el.querySelector<HTMLElement>('.pitch-cover-frame');
                if (box && frame) {
                    const cw = box.clientWidth, ch = box.clientHeight, ratio = 16 / 9;
                    const width = Math.min(cw, ch * ratio), height = width / ratio;
                    frame.style.width = `${Math.max(0, width)}px`;
                    frame.style.height = `${Math.max(0, height)}px`;
                }
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [transition]);
    return <div className="pitch-layer" ref={host} data-pitch="cover" aria-live="polite">
  <section className="pitch-panel pitch-cover" aria-label="问山路演封面">
   <div className="pitch-cover-frame">
    <img className="pitch-cover-art" src={poster} alt="问山 ThreadPeak：从一个目标出发，走出适合你的路线"/>
    <div className="pitch-cover-plate">
     <p>知乎黑客松</p>
     <dl>
      <div><dt>队伍</dt><dd>{team.name}</dd></div>
      <div><dt>成员</dt><dd>{team.members}</dd></div>
      <div><dt>演讲</dt><dd>{team.speaker}</dd></div>
     </dl>
    </div>
   </div>
  </section>
  <section className="pitch-panel pitch-intro" aria-label="为什么做问山">
   <div className="pitch-intro-grid">
    <header>
     <h2>学习断在功能之间，<br/>不在内容不够。</h2>
     <p>只做路线，很好解释。只做画布，也足以成为工具。可我把自己的学习重新走了一遍，发现问题总是出在缝隙里。</p>
    </header>
    <ol className="pitch-intro-beats">
     {introBeats.map(beat => <li key={beat.tone} data-tone={beat.tone}><strong>{beat.title}</strong><span>{beat.body}</span><IntroMark tone={beat.tone}/></li>)}
    </ol>
    <p className="pitch-intro-close">问山把访谈、路线、检索、无限画布、问 AI、问博主和作者网络放在一起，因为它们都在接住同一次学习里的断裂，并且围绕同一个目标工作。</p>
   </div>
  </section>
  <section className="pitch-panel pitch-case" aria-label="今天用一次真实目标走完">
   <div className="pitch-case-grid">
    <header>
     <h2>{caseStudy.title}</h2>
     <p className="pitch-case-goal">{caseStudy.goal}</p>
     <p>{caseStudy.lead}</p>
    </header>
    <ol className="pitch-case-steps">
     {caseStudy.steps.map(step => <li key={step.no}><b>{step.no}</b><strong>{step.title}</strong><span>{step.body}</span><StepMark no={step.no}/></li>)}
    </ol>
   </div>
  </section>
 </div>;
}
