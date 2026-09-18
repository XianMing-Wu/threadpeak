import { Suspense,useEffect,useState,type RefObject } from 'react';
import interviewer from "../../../assets/images/illustrations/kanshan-ink.png";
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import "./interview.css";
import { interviewTurns,type StoryState } from "./interview.ts";
import ScrollRouteScene from "../route/ScrollRouteScene.tsx";

export function InterviewScene({ story, beat, transition }: {
    story: StoryState;
    beat: number;
    transition: RefObject<ScrollTransition>;
}) {
    const turn = interviewTurns[beat];
    const [warmed, setWarmed] = useState(false);
    const phase = story.phase;
    useEffect(() => { if (story.warm)
        setWarmed(true); }, [story.warm]);
    return <section className="interview-scene" data-route={story.routeVisible ? 'ready' : 'pending'} aria-label="知乎上同一目标有很多条学习路线，访谈用来收清会什么、要什么" aria-hidden={!story.visible} inert={!story.visible}>
  <header className="interview-heading">
   <h2>知乎上学习路线很多，<br />先问清你该选哪条。</h2>
   <div className="interview-chapter"><span className="chapter-count">0{beat + 1}<i> / 04</i></span><span>{turn.label}</span><div className="interview-measure" aria-hidden="true">{interviewTurns.map((t, i) => <i key={t.id} data-active={beat >= i}/>)}</div></div>
  </header>
  <div className="interview-dialogue" data-phase={phase} aria-label="刘看山访谈示例">
   <div className="kanshan-question"><p>{turn.question}</p><svg viewBox="0 0 270 126" preserveAspectRatio="none" aria-hidden="true"><path d="M21 8Q3 10 5 32L7 87Q8 102 26 103L123 103Q137 102 145 119Q139 100 163 102L244 100Q263 98 263 77L261 29Q260 7 241 7Q132 3 21 8Z"/></svg>
   <img className="kanshan-interviewer" src={interviewer} alt="刘看山面向学习者，抬手交流" width="1254" height="1254"/></div>
   <div className="interview-choice-cluster" aria-label={`${turn.reason} 演示里选中第一项。`}>
    {turn.options.map((option, index) => <div key={option} className="interview-choice-bubble" style={{ '--i': index } as never} data-index={index} data-chosen={phase === 'pick' && index === turn.chosen}>
     <svg viewBox="0 0 168 108" preserveAspectRatio="none" aria-hidden="true"><path d={index === 0 ? 'M18 10Q6 12 7 28L8 68Q9 82 24 83L86 83Q102 99 110 83L144 82Q160 80 160 64L159 26Q158 9 142 9Q78 6 18 10Z' : index === 2 ? 'M18 10Q6 12 7 28L8 68Q9 82 24 83L48 83Q56 99 66 83L144 82Q160 80 160 64L159 26Q158 9 142 9Q78 6 18 10Z' : 'M18 10Q6 12 7 28L8 68Q9 82 24 83L70 83Q78 99 86 83L144 82Q160 80 160 64L159 26Q158 9 142 9Q78 6 18 10Z'}/></svg>
     <p>{turn.optionLines[index].join('\n')}</p>
     <span className="sr-only">{option}</span>
    </div>)}
   </div>
   <div className="interview-intent" data-beat={beat}>
    <p>{turn.intent.lead}<br /><em>{turn.intent.emphasis}</em></p>
    <span>{turn.intent.note}</span>
   </div>
  </div>
  <div className="interview-route-pending" role="status" aria-hidden={story.routeVisible}>
    <div className="loader" aria-hidden="true"/>
    <p>正在按你的回答，从知乎上的多种学法里收一条学习路线</p>
  </div>
  {warmed && <Suspense fallback={null}><ScrollRouteScene transition={transition}/></Suspense>}
 </section>;
}
