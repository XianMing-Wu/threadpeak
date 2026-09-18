import { PRELUDE_CASE,PRELUDE_INTRO,wallRaw } from "./story-clock.ts";
export type Chapter = {
    id: string;
    label: string;
    raw: number;
    step: string;
    topExtra?: number;
};
export const CHAPTERS: Chapter[] = [
    { id: 'cover', label: '跳到封面', raw: 0, step: 'cover' },
    { id: 'intro', label: '跳到引入', raw: PRELUDE_INTRO, step: 'intro' },
    { id: 'case', label: '跳到今天的案例', raw: PRELUDE_CASE + .03, step: 'case-study' },
    { id: 'goals', label: '跳到输入目标', raw: wallRaw(0), step: 'orbit', topExtra: 14 },
    { id: 'destinations', label: '跳到不同终点', raw: wallRaw(1.1), step: 'goals' },
    { id: 'interview', label: '跳到目标访谈', raw: wallRaw(1.555), step: 'interview' },
    { id: 'route', label: '跳到学习路线', raw: wallRaw(2.56), step: 'route-concepts-1' },
    { id: 'research', label: '跳到资料研究', raw: wallRaw(8.70), step: 'research-taught' },
    { id: 'learning', label: '跳到知识脉络学习', raw: wallRaw(13), step: 'answer-one' },
    { id: 'authors', label: '跳到博主网络', raw: wallRaw(33.80), step: 'author-identity' },
    { id: 'ask-authors', label: '跳到进一步请教', raw: wallRaw(40.4), step: 'author-discovery' },
    { id: 'begin', label: '跳到能力说明', raw: wallRaw(61.2), step: 'begin' },
    { id: 'commerce', label: '跳到商业价值', raw: wallRaw(62.35), step: 'commerce' },
    { id: 'thanks', label: '跳到致谢', raw: wallRaw(63.5), step: 'thanks' },
];
export const CHAPTER_STEPS = Object.fromEntries(CHAPTERS.map(chapter => [chapter.id, chapter.step]));
