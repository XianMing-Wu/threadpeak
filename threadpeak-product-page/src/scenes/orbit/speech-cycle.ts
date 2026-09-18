const ENTER = .18;
const HOLD = 1.6;
const EXIT = .16;
export const SPEECH_TURN = ENTER + HOLD + EXIT;
export const createSpeechCycle = () => ({ index: 0, elapsed: 0, displayed: -1 });
export function advanceSpeech(cycle: ReturnType<typeof createSpeechCycle>, dt: number, count: number, paused: boolean) {
    if (paused)
        return;
    cycle.elapsed += dt;
    while (cycle.elapsed >= SPEECH_TURN) {
        cycle.elapsed -= SPEECH_TURN;
        cycle.index = (cycle.index + 1) % count;
    }
}
export function speechEnvelope(elapsed: number) {
    const t = Math.max(0, Math.min(1, elapsed < ENTER ? elapsed / ENTER : (SPEECH_TURN - elapsed) / EXIT));
    return t * t * (3 - 2 * t);
}
