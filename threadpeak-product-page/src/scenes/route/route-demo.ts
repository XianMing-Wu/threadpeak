import { lerp, part } from "../../core/motion.ts";
import route from "../../data/interview-route.json";
import { routeTimes } from "./route-choreography.ts";

export type DemoPoint = {
    x: number;
    y: number;
};
export type DemoAnchors = {
    rest: DemoPoint;
    subject: DemoPoint;
    concept: DemoPoint;
    subjectButton: DemoPoint;
    conceptButton: DemoPoint;
};
export type DemoCardCopy = {
    kind: 'subject' | 'concept';
    nodeId: string;
    eyebrow: string;
    title: string;
    description: string;
    action: string;
};

const cards = route.data.cards;
const subject = cards.find(card => card.id === 'card-carrier-job-contract')!;
const concept = cards.find(card => card.id === 'card-llm-application-concept-1')!;
export const demoCards: Record<'subject' | 'concept', DemoCardCopy> = {
    subject: {
        kind: 'subject',
        nodeId: 'carrier-job-contract',
        eyebrow: subject.eyebrow,
        title: subject.title,
        description: subject.summary,
        action: '走到这',
    },
    concept: {
        kind: 'concept',
        nodeId: 'llm-application-concept-1',
        eyebrow: concept.eyebrow,
        title: concept.title,
        description: concept.summary,
        action: '开始学习',
    },
};

export const demoTimes = {
    appear: [6.12, 6.18],
    subjectAim: [6.18, 6.30],
    subjectPress: 6.345,
    walkA: routeTimes.walkA,
    conceptAim: [6.58, 6.68],
    conceptPress: 6.745,
    walkB: routeTimes.walkB,
    hide: [6.86, 6.98],
} as const;

const cursorKeys = [
    6.12, 6.18, 6.30, 6.335, 6.38, 6.58, 6.68, 6.72, 6.80,
] as const;

function pressAt(raw: number, at: number) {
    return part(raw, at - .012, at) * (1 - part(raw, at, at + .014));
}

function samplePath(raw: number, points: DemoPoint[]) {
    let index = cursorKeys.findIndex(time => time >= raw);
    if (index < 1)
        index = raw >= cursorKeys[cursorKeys.length - 1] ? cursorKeys.length - 1 : 1;
    const from = cursorKeys[index - 1], to = cursorKeys[index], a = points[index - 1], b = points[index];
    const t = part(raw, from, to);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function routeDemoAt(raw: number, anchors: DemoAnchors) {
    const subjectAlpha = part(raw, 6.26, 6.30) * (1 - part(raw, 6.36, 6.42));
    const conceptAlpha = part(raw, 6.68, 6.72) * (1 - part(raw, 6.80, 6.88));
    const kind = conceptAlpha >= subjectAlpha && conceptAlpha > .01 ? 'concept' as const : subjectAlpha > .01 ? 'subject' as const : null;
    const walkHide = part(raw, 6.385, 6.44) * (1 - part(raw, 6.54, 6.585));
    const click = Math.max(pressAt(raw, demoTimes.subjectPress), pressAt(raw, demoTimes.conceptPress));
    const cursor = samplePath(raw, [
        anchors.rest, anchors.rest, anchors.subject, anchors.subjectButton, anchors.subjectButton,
        anchors.subject, anchors.concept, anchors.conceptButton, anchors.conceptButton,
    ]);
    return {
        ...cursor,
        alpha: part(raw, ...demoTimes.appear) * (1 - walkHide) * (1 - part(raw, ...demoTimes.hide)),
        click,
        kind,
        cardAlpha: kind === 'concept' ? conceptAlpha : subjectAlpha,
        copy: kind ? demoCards[kind] : null,
        buttonPress: click,
    };
}

export const CONTEXT_CARD_SCALE = .72;

export function placeContextCard(anchorX: number, anchorY: number, cardWidth: number, cardHeight: number, viewportW: number, viewportH: number) {
    const margin = 12, gap = 14, scale = CONTEXT_CARD_SCALE;
    const width = Math.min(Math.max(cardWidth, 200), Math.max(180, viewportW - margin * 2));
    const visualWidth = width * scale, visualHeight = Math.max(cardHeight, 96) * scale;
    const visualLeft = Math.min(viewportW - margin - visualWidth, Math.max(margin, anchorX - visualWidth / 2));
    const top = Math.min(viewportH - margin - visualHeight, Math.max(margin, anchorY + gap));
    const arrowX = Math.min(92, Math.max(8, (anchorX - visualLeft) / Math.max(1, visualWidth) * 100));
    const originX = visualLeft + visualWidth * (arrowX / 100);
    return {
        left: originX - width * (arrowX / 100),
        top,
        scale,
        arrowX,
        availableWidth: Math.max(180, viewportW - margin * 2),
    };
}
