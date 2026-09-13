import {guideSegments,guideStart,guideEnd,guideLength} from './route-guide';

export type StoryStep={id:string;raw:number;duration:number};
const step=(id:string,raw:number,duration=1100):StoryStep=>({id,raw,duration:Math.max(420,Math.round(duration*.62))});
const tour=guideSegments.filter(s=>s.carrier!==null).map(s=>step(`route-concepts-${s.carrier}`,guideStart+(guideEnd-guideStart)*(s.start+(s.end-s.start)*.54)/guideLength,2300));
export const LEARNING_STOPS=[.12,.365,.46,.63,.733,.785,.825,.97,1.025,1.08,1.13,1.33,1.415,1.555,1.58,1.63,1.66,1.698,1.88,2.04];
const learningNames=['learning-start','zhihu-articles','article-reading','ai-explanation','ai-card-selected','ai-input-ready','ai-question-ready','ai-replies','reply-selected','author-input-ready','author-question-ready','author-results','author-reading','card-tools','card-palette','card-colored','card-add-ready','card-add-menu','custom-card','learning-overview'];
const learningDurations=[1600,2800,1000,2700,1050,1000,1500,2800,1000,1100,1700,3200,1050,1100,650,800,600,650,2600,1500];
export const SCAN_STOPS=[46.2,46.49,46.78,47.07,47.36,47.65];
// Only complete poses belong here. Typing, unfolding and camera travel happen
// between the longer reading intervals in the continuous scroll mapping.
export const STORY_STEPS:StoryStep[]=[
 step('orbit',0),step('goals',1.1,1800),step('interview',1.74,1400),
 ...tour,step('route-expanded',6.18,1800),
 step('route-first-arrival',6.51,1400),step('route-concept-arrival',6.83,1300),
 ...LEARNING_STOPS.map((p,i)=>step(learningNames[i],7.4+p*10,learningDurations[i])),
 step('author-cards',30.1,1700),step('author-identity',32.94,1700),
 step('footprint-source',34.15,1700),step('footprint-concept',35.53,1200),
 step('footprint-question',36.92,1500),step('footprint-card',38.45,1500),
 step('author-network',40.1,2400),step('author-discovery',43.8,2100),
 step('author-search-focused',43.99,700),step('author-search-question',45.6,2000),
 ...SCAN_STOPS.map((p,i)=>step(`inspect-author-${i+1}`,p,i===0?900:800)),
 step('author-selected',49.5,1500),step('author-evidence',50.8,2400),
 step('author-sources',51.5,800),step('author-footprints',52.6,900),step('author-source-reading',53.65,1000),
 step('author-evidence-return',54.7,900),step('consultation-draft',58.15,3600),step('begin',61.2,1900),
];
export const CHAPTER_STEPS:Record<string,string>={goals:'goals',interview:'interview',route:'route-concepts-1',learning:'learning-start',authors:'author-cards','ask-authors':'author-discovery',begin:'begin'};
export const stepAtOrAfter=(raw:number)=>(()=>{const i=STORY_STEPS.findIndex(s=>s.raw>=raw-1e-6);return i<0?STORY_STEPS.length-1:i;})();
export const nearestStep=(raw:number)=>STORY_STEPS.reduce((best,s,i)=>Math.abs(s.raw-raw)<Math.abs(STORY_STEPS[best].raw-raw)?i:best,0);
export const easeStep=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
/** Direction matters: stop scrolling upward completes the previous readable pose. */
export function settleIndex(raw:number,direction:number){
 const near=nearestStep(raw);if(Math.abs(STORY_STEPS[near].raw-raw)<1e-6)return near;
 const next=stepAtOrAfter(raw);return direction<0?Math.max(0,next-1):next;
}
