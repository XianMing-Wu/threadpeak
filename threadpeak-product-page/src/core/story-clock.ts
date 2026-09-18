/** Wall-clock story time. Existing scenes still think in the pre-prelude numbers. */
export const PRELUDE_INTRO = .72;
export const PRELUDE_CASE = 1.48;
export const PRELUDE_ORBIT = 2.18;
export function wallRaw(legacy: number) {
    return legacy + PRELUDE_ORBIT;
}
export function legacyRaw(wall: number) {
    return wall - PRELUDE_ORBIT;
}
export function readStory(transition: {
    current: {
        progress: number;
    };
}) {
    const wall = transition.current.progress;
    return { wall, raw: legacyRaw(wall) };
}
export function pitchAt(wall: number) {
    if (wall < PRELUDE_INTRO - .02)
        return 'cover';
    if (wall < PRELUDE_CASE - .02)
        return 'intro';
    if (wall < PRELUDE_ORBIT - .02)
        return 'case';
    return 'story';
}
