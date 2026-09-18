export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (v: number) => {
    const t = clamp01(v);
    return t * t * t * (t * (t * 6 - 15) + 10);
};
export const part = (p: number, a: number, b: number) => ease((p - a) / (b - a));
export const mix = lerp;
export const smooth = (value: number) => {
    const p = clamp01(value);
    return p * p * (3 - 2 * p);
};
export const segment = (p: number, start: number, end: number) => smooth((p - start) / (end - start));
