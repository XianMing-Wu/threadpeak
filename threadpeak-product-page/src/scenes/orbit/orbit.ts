import { clamp } from "../../core/motion.ts";
export const ORBIT_PERIOD = 36;
const ENTRANCE_STAGGER = .035;
const CHARACTER_ENTRANCE = .4;
export const ENTRANCE_DURATION = CHARACTER_ENTRANCE + 5 * ENTRANCE_STAGGER;
export { clamp };
export function orbitPoint(index: number, angle: number, radiusX: number, radiusY: number, entrance: number) {
    const theta = -Math.PI / 2 + index * Math.PI / 3 + angle;
    const p = clamp((entrance - index * ENTRANCE_STAGGER) / CHARACTER_ENTRANCE, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    return { x: Math.cos(theta) * radiusX, y: Math.sin(theta) * radiusY,
        opacity: ease, scale: .86 + .14 * ease, tilt: Math.sin(theta * 2) * 7 };
}
