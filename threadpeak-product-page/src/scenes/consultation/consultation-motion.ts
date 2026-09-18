import { lerp,part } from "../../core/motion.ts";
import { SCAN_STOPS } from "../../core/story-steps.ts";
import { CONSULTATION_END,CONSULTATION_START,NETWORK_EXIT } from "../../core/timeline.ts";
import { CONSULT_BG,CONSULT_NEW_SEND,backgroundOpenAt,consultPlay } from "./consultation-times.ts";
const typeProgress = (raw: number, start: number, end: number) => Math.max(0, Math.min(1, (raw - start) / (end - start)));
export { CONSULTATION_END,CONSULTATION_START,NETWORK_EXIT };
export { CONSULT_BG,backgroundOpenAt,consultDisplay,consultPlay } from "./consultation-times.ts";
export type ConsultPointerAim = 'field' | 'background' | 'situation' | 'tried' | 'help' | 'done' | 'send' | '';
export type ConsultBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type AvatarOrigin = {
    x: number;
    y: number;
    size: number;
};
export const consultationFit = (width: number, height: number) => {
    const narrow = width < 760, W = narrow ? 700 : 1400, H = narrow ? 1400 : 820, s = Math.min((width - 24) / W, (height - 24) / H);
    return { narrow, W, H, s, x: (width - W * s) / 2, y: (height - H * s) / 2 };
};
export const CONSULTATION_CARD_COUNT = 6;
export const clampConsultationIndex = (i: number) => Math.max(0, Math.min(CONSULTATION_CARD_COUNT - 1, i));
export function consultationAt(raw: number, narrow = false, selected = 2) {
    const play = consultPlay(raw);
    const focus = part(play, 48.2, 49.45), draft = part(play, 55.3, 56.1), entry = part(play, 40.4, 42.25);
    const cards = Array.from({ length: CONSULTATION_CARD_COUNT }, (_, i) => {
        const delta = i - selected, side = Math.sign(delta), distance = Math.abs(delta);
        const count = side < 0 ? Math.max(1, selected) : Math.max(1, 5 - selected);
        const spread = (distance - 1) / Math.max(1, count - 1);
        const initial = narrow ? { x: 20 + (i % 3) * 226, y: 234 + Math.floor(i / 3) * 315, w: 208, h: 294 } : { x: 27 + i * 225, y: 214 + Math.abs(i - 2.5) * 8, w: 221, h: 368 };
        const center = narrow ? 350 : 300;
        const sideCenter = side < 0 ? lerp(center - 119, narrow ? 96 : 95, spread) : lerp(center + 119, narrow ? 604 : 550, spread);
        const target = narrow ? { x: delta === 0 ? 210 : sideCenter - 86, y: delta === 0 ? 248 : 291, w: delta === 0 ? 280 : 172, h: delta === 0 ? 396 : 302 } : { x: delta === 0 ? 150 : sideCenter - 90, y: delta === 0 ? 239 : 288, w: delta === 0 ? 300 : 180, h: delta === 0 ? 418 : 321 };
        return { x: lerp(initial.x, target.x, focus), y: lerp(initial.y, target.y, focus), w: lerp(initial.w, target.w, focus), h: lerp(initial.h, target.h, focus),
            angle: lerp((2.5 - i) * 2.2, side * -32, focus), z: 20 - distance, shell: part(play, 41.6 + i * .14, 42.6 + i * .14), ink: part(play, 42.1 + i * .14, 43.08 + i * .14), opacity: 1, selected: delta === 0 };
    });
    const composer: ConsultBox = narrow ? { x: 45, y: 884, w: 610, h: 270 } : { x: 310, y: 608, w: 780, h: 198 };
    const panel: ConsultBox = narrow ? { x: 40, y: 718, w: 620, h: 655 } : { x: 660, y: 239, w: 655, h: 528 };
    const { x: lensX, y: lensY } = consultationLens(play, cards);
    const backgroundPress = part(raw, CONSULT_BG.openClick - .08, CONSULT_BG.openClick) * (1 - part(raw, CONSULT_BG.openClick + .03, CONSULT_BG.open + .04));
    const donePress = part(raw, CONSULT_BG.doneClick - .08, CONSULT_BG.doneClick) * (1 - part(raw, CONSULT_BG.doneClick + .03, CONSULT_BG.close));
    return { entry, focus, draft, cards, composer, panel, play,
        title: part(play, 42.25, 43.0), composerIn: part(play, 43.1, 43.6) * (1 - part(play, 48.1, 48.85)),
        question: typeProgress(raw, 44.0, 45.5), fieldFocus: part(raw, 43.84, 43.98) * (1 - part(raw, CONSULT_BG.leaveField, CONSULT_BG.atButton)),
        searchPress: part(raw, CONSULT_NEW_SEND, CONSULT_NEW_SEND + .09) * (1 - part(raw, CONSULT_NEW_SEND + .13, CONSULT_NEW_SEND + .26)),
        backgroundOpen: backgroundOpenAt(raw), backgroundPress, donePress,
        cardPress: part(play, 48.15, 48.22) * (1 - part(play, 48.27, 48.38)),
        preparePress: part(play, 55.05, 55.15) * (1 - part(play, 55.22, 55.35)),
        lens: { x: lensX, y: lensY, opacity: part(play, 43.0, 43.65) * (1 - part(play, 47.75, 48.12)) * (backgroundOpenAt(raw) ? 0 : 1) },
        panelIn: part(play, 49.65, 49.95), evidenceInk: typeProgress(play, 49.72, 50.55), draftInk: typeProgress(play, 56.0, 58.0),
        searching: play >= 46.08 && play < 48.1, results: part(play, 47.7, 48.2), raw,
    };
}
export function consultationAvatar(raw: number, i: number, origin: AvatarOrigin, destination: AvatarOrigin) {
    const t = part(raw, 40.45 + i * .035, 41.98 + i * .09);
    return { x: lerp(origin.x, destination.x, t), y: lerp(origin.y, destination.y, t) - Math.sin(t * Math.PI) * (46 - i * 7), size: lerp(origin.size, destination.size, t), t };
}
export function consultationPointerAim(raw: number): ConsultPointerAim {
    if (raw < CONSULT_BG.leaveField)
        return raw >= 43.75 ? 'field' : '';
    if (raw < CONSULT_BG.type[0].start)
        return 'background';
    if (raw < CONSULT_BG.type[1].start)
        return 'situation';
    if (raw < CONSULT_BG.type[2].start)
        return 'tried';
    if (raw < CONSULT_BG.atDone)
        return 'help';
    if (raw < CONSULT_BG.atSend)
        return 'done';
    if (raw < CONSULT_NEW_SEND + .35)
        return 'send';
    return '';
}
export function consultationPointer(raw: number, narrow: boolean) {
    const a = consultationAt(raw, narrow), play = a.play, b = a.composer, p = a.panel, aim = consultationPointerAim(raw);
    if (play >= 50.65) {
        const left = p.x + 34, top = p.y, header = narrow ? 123 : 117, sourceY = narrow ? 284 : 245;
        const keys = [{ p: 50.65, x: p.x + 260, y: top + 250 }, { p: 51.03, x: left + 100, y: top + p.h - 39 }, { p: 51.28, x: left + 100, y: top + p.h - 39 }, { p: 51.95, x: left + 104, y: top + header }, { p: 52.32, x: left + 104, y: top + header }, { p: 53.04, x: left + 210, y: top + sourceY }, { p: 53.34, x: left + 210, y: top + sourceY }, { p: 54.22, x: p.x + p.w - 71, y: top + 52 }, { p: 54.55, x: p.x + p.w - 71, y: top + 52 }, { p: 55.03, x: p.x + p.w - 92, y: top + p.h - 39 }, { p: 55.4, x: p.x + p.w - 92, y: top + p.h - 39 }, { p: 55.88, x: p.x + 145, y: top + 191 }];
        const prev = [...keys].reverse().find(k => k.p <= play) ?? keys[0], next = keys.find(k => k.p > play) ?? prev, t = next === prev ? 0 : part(play, prev.p, next.p);
        const press = Math.max(...[51.15, 52.15, 53.2, 54.35, 55.15].map(at => part(play, at - .10, at) * (1 - part(play, at + .03, at + .19))));
        return { x: lerp(prev.x, next.x, t), y: lerp(prev.y, next.y, t), opacity: part(play, 50.65, 50.9) * (1 - part(play, 56.15, 56.5)), press, aim };
    }
    if (play >= 47.8 && play < 49) {
        const card = a.cards[2], travel = part(play, 47.8, 48.12);
        return { x: card.x + card.w * .58 + 65 * (1 - travel), y: card.y + card.h * .47 + 34 * (1 - travel), opacity: part(play, 47.8, 48.08) * (1 - part(play, 48.5, 48.85)), press: a.cardPress, aim };
    }
    const field = { x: b.x + 92, y: b.y + 86 }, send = { x: b.x + b.w - 36, y: b.y + b.h - 22 };
    const background = { x: b.x + 168, y: b.y + b.h - 22 }, done = { x: b.x + 364, y: b.y - 38 };
    const situation = { x: b.x + 216, y: b.y - 350 }, tried = { x: b.x + 216, y: b.y - 230 }, help = { x: b.x + 216, y: b.y - 110 };
    const keys = [
        { p: 43.35, x: b.x - 20, y: b.y + 156 }, { p: 43.75, ...field }, { p: CONSULT_BG.leaveField, ...field },
        { p: CONSULT_BG.atButton, ...background }, { p: CONSULT_BG.open, ...background },
        { p: CONSULT_BG.type[0].start, ...situation }, { p: CONSULT_BG.type[0].end, ...situation },
        { p: CONSULT_BG.type[1].start, ...tried }, { p: CONSULT_BG.type[1].end, ...tried },
        { p: CONSULT_BG.type[2].start, ...help }, { p: CONSULT_BG.type[2].end, ...help },
        { p: CONSULT_BG.atDone, ...done }, { p: CONSULT_BG.close, ...done },
        { p: CONSULT_BG.atSend, ...send }, { p: CONSULT_NEW_SEND + .3, ...send },
    ];
    const prev = [...keys].reverse().find(k => k.p <= raw) ?? keys[0], next = keys.find(k => k.p > raw) ?? prev, t = next === prev ? 0 : part(raw, prev.p, next.p);
    const fieldPress = part(raw, 43.72, 43.79) * (1 - part(raw, 43.86, 43.98));
    return { x: lerp(prev.x, next.x, t), y: lerp(prev.y, next.y, t),
        opacity: part(raw, 43.3, 43.55) * (1 - part(raw, CONSULT_NEW_SEND + .26, CONSULT_NEW_SEND + .54)),
        press: Math.max(fieldPress, a.backgroundPress, a.donePress, a.searchPress), aim };
}
// A bounded, ordered rail: no wrapping or reindexing during a camera handoff.
// Stop the rail clock before focus, then interpolate the same six poses.
export function consultationOrbitCard(index: number, elapsed: number, raw: number) {
    const worldX = (index - 2.5) * 239 + Math.sin(elapsed * .24) * 52 + part(raw, 44.6, 47.7) * 24;
    const depth = -(worldX * worldX) / (2 * 2800), scale = 1600 / (1600 - depth);
    const h = 392 * scale;
    const y = 205 + (1 - scale) * 65;
    return { x: 700 + worldX * scale - 214 * scale / 2, y, w: 214 * scale, h, angle: -Math.atan(worldX / 3600) * 180 / Math.PI, opacity: 1 };
}
export function consultationLens(raw: number, cards: ConsultBox[]) {
    const index = Math.max(0, SCAN_STOPS.reduce((last, p, i) => p <= raw ? i : last, 0));
    const next = Math.min(5, index + 1), t = next === index ? 0 : part(raw, SCAN_STOPS[index], SCAN_STOPS[next]);
    const a = cards[index], b = cards[next];
    return { x: lerp(a.x + a.w * .5, b.x + b.w * .5, t), y: lerp(a.y + a.h * .72, b.y + b.h * .72, t) - Math.sin(t * Math.PI) * 10, index };
}
