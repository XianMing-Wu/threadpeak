import { consultDisplay } from "../scenes/consultation/consultation-times.ts";
import { guideEnd,guideLength,guideSegments,guideStart } from "../scenes/route/route-guide.ts";
import { interviewPose } from "../scenes/route/route-choreography.ts";
import { PRELUDE_CASE,PRELUDE_INTRO,wallRaw } from "./story-clock.ts";
export type StoryStep = {
    id: string;
    raw: number;
    duration: number;
};
const step = (id: string, raw: number, duration = 1100): StoryStep => ({ id, raw, duration: Math.max(420, Math.round(duration * .62)) });
const tour = guideSegments.filter(s => s.carrier !== null).map(s => step(`route-concepts-${s.carrier}`, guideStart + (guideEnd - guideStart) * (s.start + (s.end - s.start) * .54) / guideLength, 2300));
export const LEARNING_STOPS = [.56, .72, .735, .821, .97, 1.025, 1.122, 1.33, 1.415, 1.575, 1.62, 1.69, 1.88, 2.04];
const learningNames = ['answer-one', 'answer-two', 'ai-card-selected', 'ai-prompt', 'ai-replies', 'reply-selected', 'author-prompt', 'author-results', 'author-reading', 'color-palette', 'color-applied', 'add-menu', 'custom-card', 'learning-overview'];
const learningDurations = [4000, 4000, 2200, 2400, 4000, 2200, 2400, 3600, 2000, 2200, 2000, 2200, 3600, 3200];
export const SCAN_STOPS = [46.2, 46.49, 46.78, 47.07, 47.36, 47.65];
// Only complete poses belong here. Typing, unfolding and camera travel happen
// between the longer reading intervals in the continuous scroll mapping.
const later = (id: string, legacy: number, duration?: number) => step(id, wallRaw(legacy), duration);
export const STORY_STEPS: StoryStep[] = [
    step('cover', 0, 900), step('intro', PRELUDE_INTRO, 900), step('case-study', PRELUDE_CASE + .03, 900),
    later('orbit', 0),
    later('goals', 1.1, 3200),
    later('interview', interviewPose(0, 'ask'), 2200), later('interview-options', interviewPose(0, 'options'), 2000), later('interview-chosen', interviewPose(0, 'pick'), 1800),
    later('interview-starting-ask', interviewPose(1, 'ask'), 2200), later('interview-starting-options', interviewPose(1, 'options'), 2000), later('interview-starting', interviewPose(1, 'pick'), 1800),
    later('interview-understanding-ask', interviewPose(2, 'ask'), 2200), later('interview-understanding-options', interviewPose(2, 'options'), 2000), later('interview-understanding', interviewPose(2, 'pick'), 1800),
    later('interview-nongoal-ask', interviewPose(3, 'ask'), 2200), later('interview-nongoal-options', interviewPose(3, 'options'), 2000), later('interview-nongoal', interviewPose(3, 'pick'), 1800),
    ...tour.map(item => ({ ...item, raw: wallRaw(item.raw) })),
    later('route-expanded', 6.18, 1800),
    later('route-subject-card', 6.30, 1600), later('route-first-arrival', 6.58, 1400),
    later('route-concept-card', 6.72, 1800),
    later('research-stream', 7.90, 2200), later('research-taught', 8.70, 28000),
    later('research-graph', 9.52, 2800),
    ...LEARNING_STOPS.map((p, i) => later(learningNames[i], 7.4 + p * 10, learningDurations[i])),
    later('graph-document', 28.25, 2400), later('graph-doc-read', 28.80, 8000), later('graph-canvas', 29.15, 2200),
    later('network-cards', 31.10, 7000),
    later('author-identity', 33.80, 10000),
    later('footprint-source', 34.80, 2200), later('footprint-concept', 35.95, 1800),
    later('footprint-question', 37.25, 1800), later('footprint-card', 38.40, 2000),
    later('author-network', 40.1, 3600), later('author-discovery', 43.8, 2100),
    later('author-search-question', 45.6, 2000),
    later('author-background-open', 45.90, 1800),
    later('author-background-situation', 46.38, 2000),
    later('author-background-tried', 46.84, 2000),
    later('author-background-help', 47.22, 2200),
    later('author-background-done', 47.62, 1600),
    later('author-selected', consultDisplay(49.5), 9000), later('author-evidence', consultDisplay(50.8), 2400),
    later('author-sources', consultDisplay(51.5), 800), later('author-footprints', consultDisplay(52.6), 900), later('author-source-reading', consultDisplay(53.65), 1000),
    later('author-evidence-return', consultDisplay(54.7), 900), later('consultation-draft', consultDisplay(58.15), 3600), later('begin', 61.2, 900), later('commerce', 62.35, 900), later('thanks', 63.5, 900),
];
export { CHAPTER_STEPS } from "./chapters.ts";
export const stepAtOrAfter = (raw: number) => (() => { const i = STORY_STEPS.findIndex(s => s.raw >= raw - 1e-6); return i < 0 ? STORY_STEPS.length - 1 : i; })();
export const nearestStep = (raw: number) => STORY_STEPS.reduce((best, s, i) => Math.abs(s.raw - raw) < Math.abs(STORY_STEPS[best].raw - raw) ? i : best, 0);
export const easeStep = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
/** Direction matters: stop scrolling upward completes the previous readable pose. */
export function settleIndex(raw: number, direction: number) {
    const near = nearestStep(raw);
    if (Math.abs(STORY_STEPS[near].raw - raw) < 1e-6)
        return near;
    const next = stepAtOrAfter(raw);
    return direction < 0 ? Math.max(0, next - 1) : next;
}
