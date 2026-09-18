// Presentation timing only. Subject/concept identities and edges are read from
// the compiled example document, never inferred from these stage positions.
export const STORY_END = 7.4;
export const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
export const linear = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const ease = (p: number) => p * p * (3 - 2 * p);
export const range = (p: number, a: number, b: number) => ease(linear(p, a, b));
export const interviewBeats = [1.68, 1.94, 2.20, 2.46] as const;
const INTERVIEW_ASK_FROM = 1.54;
const INTERVIEW_ASK_U = (1.555 - INTERVIEW_ASK_FROM) / (interviewBeats[0] - INTERVIEW_ASK_FROM);
const INTERVIEW_OPTIONS_U = (1.618 - INTERVIEW_ASK_FROM) / (interviewBeats[0] - INTERVIEW_ASK_FROM);
export function interviewRange(beat: number) {
    const from = beat === 0 ? INTERVIEW_ASK_FROM : interviewBeats[beat - 1];
    const to = interviewBeats[beat];
    return { from, to };
}
export function interviewPose(beat: number, phase: 'ask' | 'options' | 'pick') {
    const { from, to } = interviewRange(beat);
    if (phase === 'pick')
        return to;
    return from + (to - from) * (phase === 'ask' ? INTERVIEW_ASK_U : INTERVIEW_OPTIONS_U);
}
export const routeTimes = {
    platforms: [2.52, 2.99], roads: [2.96, 3.31], mascot: [3.32, 3.52],
    guide: [3.52, 5.52], expand: [5.52, 6.12], lift: [5.20, 5.52],
    walkA: [6.38, 6.58], walkB: [6.78, 6.88],
    walk: [6.38, 6.88], portal: [6.88, 7.38],
} as const;
export function falling(p: number, start: number, duration: number) {
    const t = linear(p, start, start + duration);
    if (t < .76)
        return { height: 12 * (1 - (t / .76) ** 2), squash: 1, visible: t > 0 };
    const settle = (t - .76) / .24;
    return { height: .17 * Math.sin(settle * Math.PI) * (1 - settle), squash: 1 - .09 * Math.sin(settle * Math.PI), visible: true };
}
export function interviewPlay(raw: number) {
    let dest = 0;
    for (let i = 0; i < interviewBeats.length; i++)
        if (raw + 1e-6 >= interviewBeats[i])
            dest = i;
    const atHold = Math.abs(raw - interviewBeats[dest]) < .0008;
    const beat = !atHold && dest < interviewBeats.length - 1 && raw > interviewBeats[dest] ? dest + 1 : dest;
    const { from, to } = interviewRange(beat);
    const u = Math.max(0, Math.min(1, (raw - from) / Math.max(.01, to - from)));
    const phase = u >= .78 || raw + 1e-4 >= to ? 'pick' as const : u < .32 ? 'ask' as const : 'options' as const;
    return { beat, phase };
}
export function storyAt(raw: number) {
    const play = interviewPlay(raw);
    return {
        warm: raw > 1.03, visible: raw > 1.54,
        routeVisible: raw > routeTimes.platforms[0] - .04,
        beat: play.beat,
        phase: play.phase,
        settled: raw > routeTimes.platforms[0] - .04,
    };
}
export function choreographyAt(raw: number) {
    return { raw, expand: range(raw, ...routeTimes.expand), lift: range(raw, ...routeTimes.lift),
        walk: range(raw, ...routeTimes.walk), portal: range(raw, ...routeTimes.portal),
        leftOpacity: 1 - range(raw, 5.52, 5.94), lightOpacity: range(raw, routeTimes.guide[0], routeTimes.guide[0] + .06) * (1 - range(raw, 5.52, 5.66)),
        active: raw < 3.56 ? 0 : raw < 4.5 ? 1 : 2,
        phase: raw < routeTimes.roads[0] ? 'platforms' : raw < routeTimes.mascot[0] ? 'roads' : raw < routeTimes.guide[0] ? 'mascot' : raw < 5.52 ? 'guide' : raw < 6.38 ? 'expand' : raw < 6.88 ? 'walk' : 'portal',
    };
}
