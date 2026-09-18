import { clamp01,ease,lerp,part } from "../../core/motion.ts";
import { LEARNING_END,LEARNING_START,learningProgress,rawAtLearning } from "../../core/timeline.ts";
import { LEARNING_STOPS } from "../../core/story-steps.ts";
import { askFromAnswer as lessonAsk,featuredLessonAnswers } from "../lesson-cards.ts";
/** The product actions share one reversible scroll clock and one immutable tree layout. */
export { clamp01,ease,lerp,part,LEARNING_END,LEARNING_START,learningProgress,rawAtLearning };
export const chapterStops = LEARNING_STOPS;
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export const CARD = { w: 520, h: 440 } as const;
const GAP = 80;
const PITCH = CARD.h + GAP;
const card = (x: number, y: number): Box => ({ x, y, ...CARD });
export const midY = (b: Box) => b.y + b.h / 2;
export const midX = (b: Box) => b.x + b.w / 2;
function stackAround(parent: Box, count: number, x: number): Box[] {
    const span = count * CARD.h + Math.max(0, count - 1) * GAP;
    const startY = midY(parent) - span / 2;
    return Array.from({ length: count }, (_, i) => card(x, startY + i * PITCH));
}
const SOURCE_X = 860, ANSWER_X = 1620, REPLY_X = 2380, AUTHOR_X = 3140;
const SOURCE_PITCH = PITCH * 2;
const firstSourceY = CARD.h / 2 + GAP / 2;
export const featuredSources = [0, 1, 2, 3];
export const sourceBoxes: Record<number, Box> = Object.fromEntries(featuredSources.map(i => [i, card(SOURCE_X, firstSourceY + i * SOURCE_PITCH)]));
export const featuredAnswers = featuredLessonAnswers;
const answersFor0 = stackAround(sourceBoxes[0], 2, ANSWER_X);
const answersFor1 = stackAround(sourceBoxes[1], 2, ANSWER_X);
export const answerBoxes: Record<number, Box> = { 0: answersFor0[0], 5: answersFor0[1], 1: answersFor1[0], 4: answersFor1[1] };
export const askFromAnswer = lessonAsk;
export const replyBoxes = stackAround(answerBoxes[askFromAnswer], 2, REPLY_X);
export const newBox = replyBoxes[0];
export const authorBoxes = stackAround(replyBoxes[0], 3, AUTHOR_X);
export const customBox = card(AUTHOR_X, authorBoxes[2].y + PITCH);
const articleCenters = featuredSources.map(i => midY(sourceBoxes[i]));
export const rootBox = card(100, (articleCenters[0] + articleCenters[3]) / 2 - CARD.h / 2);
export const promptBox = (width = 1280): Box => width < 700 ? ({ x: ANSWER_X, y: answerBoxes[askFromAnswer].y + PITCH, w: 520, h: 460 }) : ({ x: 2180, y: answerBoxes[askFromAnswer].y, w: 520, h: 460 });
export const authorPromptBox = (width = 1280): Box => width < 700 ? ({ x: REPLY_X, y: replyBoxes[0].y + PITCH, w: 520, h: 342 }) : ({ x: 2940, y: replyBoxes[0].y, w: 520, h: 342 });
export const promptAlpha = (p: number) => part(p, .752, .778) * (1 - part(p, .843, .865));
export const authorPromptAlpha = (p: number) => part(p, 1.05, 1.077) * (1 - part(p, 1.14, 1.17));
export const colorProgress = (p: number) => part(p, 1.598, 1.62);
export const customEntry = (p: number) => part(p, 1.765, 1.815);
export const sourceEntry = (p: number, i: number) => part(p, .248 + i * .028, .286 + i * .028);
export const answerStream = (i: number) => {
    const group = i < 2 ? .46 : .63, local = i % 2;
    return { start: group + local * .04, end: group + .055 + local * .04 };
};
export const answerEntry = (p: number, i: number) => { const w = answerStream(i); return part(p, w.start, w.end); };
export const replyEntry = (p: number, i: number) => part(p, .869 + i * .020, .914 + i * .020);
export const authorEntry = (p: number, i: number) => part(p, 1.18 + i * .025, 1.23 + i * .025);
type Pose = {
    at: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
};
const look = (b: Box, sx = 1040, sy = 690): Pick<Pose, 'x' | 'y' | 'sx' | 'sy'> => ({ x: midX(b), y: midY(b), sx, sy });
const lookSpan = (boxes: Box[], sx: number, sy: number): Pick<Pose, 'x' | 'y' | 'sx' | 'sy'> => ({
    x: boxes.reduce((s, b) => s + midX(b), 0) / boxes.length,
    y: boxes.reduce((s, b) => s + midY(b), 0) / boxes.length,
    sx, sy,
});
const lookBounds = (boxes: Box[], pad = 90): Pick<Pose, 'x' | 'y' | 'sx' | 'sy'> => {
    const left = Math.min(...boxes.map(b => b.x)), right = Math.max(...boxes.map(b => b.x + b.w));
    const top = Math.min(...boxes.map(b => b.y)), bottom = Math.max(...boxes.map(b => b.y + b.h));
    return { x: (left + right) / 2, y: (top + bottom) / 2, sx: right - left + pad * 2, sy: bottom - top + pad * 2 };
};
const treeBoxes = [rootBox, ...featuredSources.map(i => sourceBoxes[i]), ...Object.values(answerBoxes), ...replyBoxes, ...authorBoxes, customBox];
/** Fit the tree into the graph slot. The slot already reserves the bottom legend, so scale can prefer readable cards. */
export function overviewCameraAt(width: number, height: number) {
    const bounds = lookBounds(treeBoxes, 28);
    const scale = Math.min(width / bounds.sx, height / (bounds.sy * 0.7), 0.42);
    return { x: bounds.x, y: bounds.y, scale };
}
const authorFromLeft = [answerBoxes[askFromAnswer], replyBoxes[0], ...authorBoxes];
const poses: Pose[] = [
    { at: 0, ...look(rootBox, 1100, 690) }, { at: .248, ...look(rootBox, 1100, 690) },
    { at: .322, ...look(sourceBoxes[0], 1480, 920) }, { at: .385, ...look(sourceBoxes[0], 1480, 920) },
    { at: .43, ...look(sourceBoxes[0]) }, { at: .46, ...look(sourceBoxes[0]) },
    { at: .50, ...lookSpan([sourceBoxes[0], answersFor0[0], answersFor0[1]], 1480, 1100) }, { at: .56, ...lookSpan([sourceBoxes[0], answersFor0[0], answersFor0[1]], 1480, 1100) },
    { at: .60, ...look(sourceBoxes[1]) }, { at: .63, ...look(sourceBoxes[1]) },
    { at: .665, ...lookSpan([sourceBoxes[1], answersFor1[0], answersFor1[1]], 1480, 1100) }, { at: .72, ...lookSpan([sourceBoxes[1], answersFor1[0], answersFor1[1]], 1480, 1100) },
    { at: .733, ...look(answerBoxes[askFromAnswer]) }, { at: .735, ...look(answerBoxes[askFromAnswer]) },
    { at: .782, x: 2160, y: midY(answerBoxes[askFromAnswer]), sx: 1280, sy: 670 }, { at: .846, x: 2160, y: midY(answerBoxes[askFromAnswer]), sx: 1280, sy: 670 },
    { at: .90, ...lookSpan(replyBoxes, 1480, 1200) }, { at: .97, ...lookSpan(replyBoxes, 1480, 1200) },
    { at: .99, ...look(replyBoxes[0]) }, { at: 1.035, ...look(replyBoxes[0]) },
    { at: 1.077, x: 2920, y: midY(replyBoxes[0]), sx: 1280, sy: 670 }, { at: 1.145, x: 2920, y: midY(replyBoxes[0]), sx: 1280, sy: 670 },
    { at: 1.18, ...lookBounds(authorFromLeft, 110) }, { at: 1.335, ...lookBounds(authorFromLeft, 110) },
    { at: 1.385, ...look(authorBoxes[1]) }, { at: 1.435, ...look(authorBoxes[1]) },
    { at: 1.53, x: midX(replyBoxes[0]), y: replyBoxes[0].y + CARD.h + 160, sx: 1040, sy: 990 }, { at: 1.71, x: midX(replyBoxes[0]), y: replyBoxes[0].y + CARD.h + 160, sx: 1040, sy: 990 },
    { at: 1.78, x: 3020, y: midY(customBox) - 200, sx: 1530, sy: 1620 }, { at: 1.82, x: 3020, y: midY(customBox) - 200, sx: 1530, sy: 1620 },
    { at: 1.865, ...look(customBox) }, { at: 1.91, ...look(customBox) },
    { at: 1.98, ...lookBounds(treeBoxes, 120) }, { at: 2.04, ...lookBounds(treeBoxes, 120) },
];
const closeStages = new Set([0, .248, .322, .385, .43, .46, .60, .63, .733, .735, .782, .846, .99, 1.035, 1.077, 1.145, 1.385, 1.435, 1.53, 1.71, 1.865, 1.91]);
export function cameraAt(p: number, width: number, height: number) {
    const list = width < 700 ? poses.map(v => [.782, .846].includes(v.at) ? { ...v, x: 1880, y: 940, sx: 600, sy: 1040 } : [1.077, 1.145].includes(v.at) ? { ...v, x: 2640, y: 881, sx: 600, sy: 934 } : closeStages.has(v.at) ? { ...v, sx: 600 } : v) : poses;
    let i = list.findIndex(v => v.at >= p);
    if (i < 0)
        i = list.length - 1;
    if (i < 1)
        i = 1;
    const a = list[i - 1], b = list[i], t = part(p, a.at, b.at);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), scale: Math.min(width / lerp(a.sx, b.sx, t), height / lerp(a.sy, b.sy, t), 1.08) };
}
export function edgePath(a: Box, b: Box) {
    const x = a.x + a.w, y = a.y + a.h / 2, tx = b.x, ty = b.y + b.h / 2, m = (x + tx) / 2;
    return y === ty ? `M ${x} ${y} H ${tx}` : `M ${x} ${y} H ${m} V ${ty} H ${tx}`;
}
export function lightAt(p: number, start: number, end: number) { const t = clamp01((p - start) / (end - start)); return { travel: t, alpha: part(t, 0, .12) * (1 - part(t, .82, 1)) }; }
export function startCardScreen(width: number, height: number) {
    const narrow = width < 699, px = width * (narrow ? .015 : .025), py = narrow ? 16 : 22, c = cameraAt(0, width - 2 * px, height - 2 * py);
    return { x: width / 2 + (rootBox.x - c.x) * c.scale, y: height / 2 + (rootBox.y - c.y) * c.scale, w: CARD.w * c.scale, h: CARD.h * c.scale, scale: c.scale };
}
