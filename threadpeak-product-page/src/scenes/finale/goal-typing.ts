const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function goalTypingAt(seconds: number, length: number, reduced = false) {
    const typedAt = .35 + length * .085, sendAt = typedAt + .55, resultsAt = sendAt + .25, end = resultsAt + 4.6;
    const t = reduced ? resultsAt + 1 : Math.max(0, seconds) % end;
    const count = Math.min(length, Math.max(0, Math.floor((t - .35) / .085)));
    const results = clamp((t - resultsAt) / .55), fade = 1 - clamp((t - (end - .3)) / .3);
    const press = t >= sendAt && t < sendAt + .25 ? Math.sin((t - sendAt) / .25 * Math.PI) : 0;
    return { count, results, fade, press, caret: t < sendAt, phase: count < length ? 'typing' : t < sendAt ? 'ready' : results < 1 ? 'searching' : 'complete' };
}
