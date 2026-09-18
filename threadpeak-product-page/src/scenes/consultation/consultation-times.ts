import { part } from "../../core/motion.ts";
/** Original send/search clock. Background filling is inserted in display time only. */
export const CONSULT_OLD_SEND = 45.86;
export const CONSULT_NEW_SEND = 47.71;
export const CONSULT_JOIN = 58.75;
export const CONSULT_BG = {
    leaveField: 45.62,
    atButton: 45.74,
    openClick: 45.82,
    open: 45.90,
    type: [
        { start: 46.00, end: 46.38 },
        { start: 46.46, end: 46.84 },
        { start: 46.92, end: 47.22 },
    ],
    atDone: 47.38,
    doneClick: 47.48,
    close: 47.55,
    atSend: 47.62,
} as const;
export function consultPlay(raw: number) {
    if (raw < CONSULT_BG.close)
        return Math.min(raw, CONSULT_BG.leaveField);
    if (raw < CONSULT_NEW_SEND)
        return CONSULT_BG.leaveField + (raw - CONSULT_BG.close) / (CONSULT_NEW_SEND - CONSULT_BG.close) * (CONSULT_OLD_SEND - CONSULT_BG.leaveField);
    if (raw >= CONSULT_JOIN)
        return raw;
    return CONSULT_OLD_SEND + (raw - CONSULT_NEW_SEND) * (CONSULT_JOIN - CONSULT_OLD_SEND) / (CONSULT_JOIN - CONSULT_NEW_SEND);
}
export function consultDisplay(play: number) {
    if (play <= CONSULT_OLD_SEND)
        return play;
    if (play >= CONSULT_JOIN)
        return play;
    return CONSULT_NEW_SEND + (play - CONSULT_OLD_SEND) * (CONSULT_JOIN - CONSULT_NEW_SEND) / (CONSULT_JOIN - CONSULT_OLD_SEND);
}
export const backgroundOpenAt = (raw: number) => raw >= CONSULT_BG.openClick && raw < CONSULT_BG.close;
export const backgroundFieldProgress = (raw: number, index: number) => part(raw, CONSULT_BG.type[index].start, CONSULT_BG.type[index].end);
