import { useRef,useState } from 'react';
import { ShowcaseNavigation } from "../components/navigation/ShowcaseNavigation.tsx";
import { CHAPTERS } from "../core/chapters.ts";
import { SCROLL_SCREENS,scrollScreensAt } from "../core/scroll-pacing.ts";
import { seekStory,useScrollTransition,type GoalId } from "../core/scroll-transition.ts";
import { STORY_STEPS } from "../core/story-steps.ts";
import { ConsultationStoryScene } from "../scenes/consultation/ConsultationStoryScene.tsx";
import { CommerceStoryScene } from "../scenes/finale/CommerceStoryScene.tsx";
import { FinaleStoryScene } from "../scenes/finale/FinaleStoryScene.tsx";
import { ThanksStoryScene } from "../scenes/finale/ThanksStoryScene.tsx";
import { GoalPanel } from "../scenes/goals/GoalPanel.tsx";
import { InterviewScene } from "../scenes/interview/InterviewScene.tsx";
import { initialStory } from "../scenes/interview/interview.ts";
import { LearningStoryScene } from "../scenes/learning/LearningStoryScene.tsx";
import { AuthorNetworkStoryScene } from "../scenes/network/AuthorNetworkStoryScene.tsx";
import { KnowledgeTicker } from "../scenes/orbit/KnowledgeTicker.tsx";
import { OrbitScene } from "../scenes/orbit/OrbitScene.tsx";
import { PitchScenes } from "../scenes/pitch/PitchScenes.tsx";
export function App() {
    const story = useRef<HTMLElement>(null);
    const frame = useRef<HTMLDivElement>(null);
    const transition = useScrollTransition(story);
    const [goal, setGoal] = useState<GoalId>('application');
    const [storyState, setStoryState] = useState(initialStory);
    const beat = storyState.beat;
    return <main className="scroll-story" ref={story} style={{ height: `${(SCROLL_SCREENS + 1) * 100}svh` }}>
  <ShowcaseNavigation transition={transition}/>
  <nav className="chapter-shortcuts" aria-label="章节跳转" onClick={e => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                return;
            const link = (e.target as Element).closest('a');
            if (link?.hash !== location.hash)
                return;
            const chapter = CHAPTERS.find(item => item.id === link.hash.slice(1));
            const step = chapter && STORY_STEPS.find(s => s.id === chapter.step);
            if (step) {
                e.preventDefault();
                seekStory(step.raw);
            }
        }}>{CHAPTERS.map(chapter => <a href={`#${chapter.id}`} key={chapter.id}>{chapter.label}</a>)}</nav>
  {CHAPTERS.map(chapter => <span className="chapter-anchor" id={chapter.id} key={chapter.id} style={{ top: `${scrollScreensAt(chapter.raw) * 100 + (chapter.topExtra ?? 0)}svh` }} aria-hidden="true"/>)}
  <div className="combined-page" ref={frame} data-pitch="cover">
  <PitchScenes transition={transition}/>
  <OrbitScene transition={transition} frame={frame} activeGoal={goal} onGoal={setGoal} onStory={setStoryState} beat={beat}/>
  <KnowledgeTicker /><GoalPanel active={goal} onSelect={setGoal}/>
  <InterviewScene story={storyState} beat={beat} transition={transition}/>
  <LearningStoryScene transition={transition}/>
  <AuthorNetworkStoryScene transition={transition}/>
  <ConsultationStoryScene transition={transition}/>
  <FinaleStoryScene transition={transition}/>
  <CommerceStoryScene transition={transition}/>
  <ThanksStoryScene transition={transition}/>
 </div></main>;
}
