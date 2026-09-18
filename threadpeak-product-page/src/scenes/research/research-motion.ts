import { lerp, part, smooth } from "../../core/motion.ts";

export const waitPhases = [
    { title: '拆解检索方向', detail: '按概念用途与目标生成互补查询' },
    { title: '搜索知乎 · 第 1 路', detail: '一项一搜，两条一批收齐' },
    { title: '搜索知乎 · 正在排队，等待请求间隔', detail: '限流后共享冷却，遵守 Retry-After' },
    { title: '搜索知乎 · 第 2 路', detail: '继续本批查询，不丢任何一项' },
    { title: '筛选相关资料', detail: '从候选中挑选互补文章' },
    { title: '选择回答依据', detail: '最多 4 张作为本次讲解依据' },
    { title: '正在组织讲解', detail: '按目标写连续教学并逐段引用' },
] as const;

export const researchTimes = {
    reveal: [7.12, 7.38],
    wait: [7.20, 7.88],
    fill: [7.72, 8.22],
    stream: [7.90, 8.70],
    chat: [8.70, 8.96],
    article: [8.96, 9.12],
    reading: [9.12, 9.38],
    graphClick: 9.405,
    graphIn: 9.41,
    graphHold: 9.52,
    expand: [9.52, 9.60],
    leave: [9.52, 9.60],
    docClick: 28.00,
    docIn: 28.05,
    docScroll: [28.25, 28.80],
    mapClick: 28.98,
    mapIn: 29.08,
    canvasHold: 29.15,
} as const;

export type ResearchPoint = { x: number; y: number };
export type ResearchAnchors = {
    graphTab: ResearchPoint;
    docTab: ResearchPoint;
    mapTab: ResearchPoint;
};
const cursorTours = {
    graph: { keys: [9.36, 9.39, 9.405, 9.48, 9.52], clickAt: 9.405, fade: [9.36, 9.39, 9.46, 9.52] as const },
    doc: { keys: [27.88, 27.96, 28.00, 28.12, 28.25], clickAt: 28.00, fade: [27.88, 27.96, 28.18, 28.25] as const },
    map: { keys: [28.88, 28.94, 28.98, 29.08, 29.15], clickAt: 28.98, fade: [28.88, 28.94, 29.08, 29.15] as const },
} as const;
export type CursorTour = keyof typeof cursorTours;
export function cursorWindow(raw: number): CursorTour | null {
    if (raw >= 9.36 && raw < 9.52)
        return 'graph';
    if (raw >= 27.88 && raw < 28.26)
        return 'doc';
    if (raw >= 28.88 && raw < 29.16)
        return 'map';
    return null;
}

function pressAt(raw: number, at: number) {
    return part(raw, at - .012, at) * (1 - part(raw, at, at + .014));
}

function sample(raw: number, keys: readonly number[], points: ResearchPoint[]) {
    let index = keys.findIndex(time => time >= raw);
    if (index < 1)
        index = raw >= keys[keys.length - 1] ? keys.length - 1 : 1;
    const from = keys[index - 1], to = keys[index], a = points[index - 1], b = points[index];
    const t = part(raw, from, to);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clampPoint(point: ResearchPoint, width: number, height: number) {
    return {
        x: Math.max(16, Math.min(width - 28, point.x)),
        y: Math.max(14, Math.min(height - 38, point.y)),
    };
}

export function researchAt(raw: number, anchors: ResearchAnchors) {
    const open = part(raw, ...researchTimes.reveal);
    const filled = Math.max(0, Math.min(1, (raw - researchTimes.fill[0]) / (researchTimes.fill[1] - researchTimes.fill[0])));
    const article = Math.max(0, Math.min(1, (raw - researchTimes.article[0]) / (researchTimes.article[1] - researchTimes.article[0])));
    const chatT = Math.max(0, Math.min(1, (raw - researchTimes.chat[0]) / (researchTimes.chat[1] - researchTimes.chat[0])));
    const chatY = raw < researchTimes.chat[0] ? 1 : chatT < .42 ? 1 - smooth(chatT / .42) : smooth((chatT - .42) / .58);
    const readT = Math.max(0, Math.min(1, (raw - researchTimes.reading[0]) / (researchTimes.reading[1] - researchTimes.reading[0])));
    const articleY = readT < .5 ? smooth(readT * 2) : 1 - smooth((readT - .5) * 2);
    const leave = raw <= researchTimes.graphHold ? 0 : raw < 26.9 ? part(raw, ...researchTimes.leave) : raw <= 29.15 ? 1 - part(raw, 26.9, 27.8) : part(raw, 29.15, 30.05);
    const expand = raw <= researchTimes.graphHold ? 0 : part(raw, ...researchTimes.expand);
    const waitT = Math.max(0, Math.min(.999, (raw - researchTimes.wait[0]) / (researchTimes.wait[1] - researchTimes.wait[0])));
    const waitIndex = raw < researchTimes.wait[0] ? -1 : Math.min(waitPhases.length - 1, Math.floor(waitT * waitPhases.length));
    const stream = Math.max(0, Math.min(1, (raw - researchTimes.stream[0]) / (researchTimes.stream[1] - researchTimes.stream[0])));
    const waitVisible = waitIndex >= 0 && stream < .12;
    const phase = waitIndex < 0 ? waitPhases[0] : waitPhases[waitIndex];
    const tab = raw >= researchTimes.graphIn ? 'graph' : 'study';
    const present = raw >= researchTimes.docIn && raw < researchTimes.mapIn ? 'document' : 'map';
    const docT = Math.max(0, Math.min(1, (raw - researchTimes.docScroll[0]) / (researchTimes.docScroll[1] - researchTimes.docScroll[0])));
    const docY = raw < researchTimes.docScroll[0] ? 0 : raw > researchTimes.docScroll[1] ? 0 : docT < .5 ? smooth(docT * 2) : 1 - smooth((docT - .5) * 2);
    const tour = cursorWindow(raw);
    const spec = tour ? cursorTours[tour] : cursorTours.graph;
    const target = tour === 'doc' ? anchors.docTab : tour === 'map' ? anchors.mapTab : anchors.graphTab;
    const cursor = sample(raw, spec.keys, [target, target, target, target, target]);
    const fade = spec.fade;
    return {
        ...cursor,
        open,
        filled,
        article,
        chatY,
        articleY,
        leave,
        expand,
        waitIndex,
        waitDone: Math.max(0, waitIndex),
        waitVisible,
        waitTitle: phase.title,
        waitDetail: phase.detail,
        stream,
        alpha: open * (1 - leave),
        cursorAlpha: tour ? part(raw, fade[0], fade[1]) * (1 - part(raw, fade[2], fade[3])) : 0,
        generating: waitVisible || (stream > .01 && stream < .995),
        click: pressAt(raw, spec.clickAt),
        pane: tab === 'graph' ? 'graph' : 'list',
        tab,
        present,
        docY,
        highlight: false,
        searchLabel: waitIndex < 4 ? '正在寻找这个概念的相关内容' : waitIndex < 5 ? '正在筛选互补资料' : '资料已就绪，开始讲解',
    };
}
