import { part } from "../../core/motion.ts";
export const FINALE_START = 58.75, COMMERCE_START = 62.15, THANKS_START = 63.35;
export function finaleAt(raw: number) {
    const enter = part(raw, 58.75, 59.85) * (1 - part(raw, COMMERCE_START - .12, COMMERCE_START));
    return {
        enter,
        search: part(raw, 58.95, 60.10) * (enter > 0 ? 1 : 0),
        paper: part(raw, 58.85, 59.95),
        favorites: part(raw, 59.15, 60.25),
        goal: part(raw, 59.35, 60.45),
        heading: part(raw, 59.55, 60.55),
    };
}

