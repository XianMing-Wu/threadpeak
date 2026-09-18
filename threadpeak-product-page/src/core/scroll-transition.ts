import { useEffect,useRef,type RefObject } from 'react';
import { mix,segment,smooth } from "./motion.ts";
import { progressForScroll,SCROLL_SCREENS,scrollScreensAt } from "./scroll-pacing.ts";
import { wallRaw } from "./story-clock.ts";
import { CHAPTER_STEPS,easeStep,nearestStep,settleIndex,STORY_STEPS } from "./story-steps.ts";
export { mix,segment,smooth };
export type ScrollTransition = {
    target: number;
    progress: number;
    locked: boolean;
    slots: number[];
};
const STEP_EVENT = 'threadpeak:story-step';
const SEEK_EVENT = 'threadpeak:story-seek';
export const requestStoryStep = (direction = 1) => window.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: direction }));
export const seekStory = (raw: number) => window.dispatchEvent(new CustomEvent(SEEK_EVENT, { detail: raw }));
export const seekLegacy = (legacy: number) => seekStory(wallRaw(legacy));
export function useScrollTransition(root: RefObject<HTMLElement | null>) {
    const state = useRef<ScrollTransition>({ target: 0, progress: 0, locked: false, slots: [0, 1, 2, 3, 4, 5] });
    useEffect(() => {
        const el = root.current;
        if (!el)
            return;
        const diagnostic = location.pathname.startsWith('/qa/'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0, last = 0, lastInput = -Infinity, lastY = window.scrollY, syntheticY: number | null = null, direction = 1, resizeFrame = 0, booted = false;
        let snap: {
            from: number;
            to: number;
            fromY: number;
            toY: number;
            start: number;
            duration: number;
        } | null = null;
        const snapT = (now = performance.now()) => snap ? Math.min(1, (now - snap.start) / snap.duration) : 1;
        const remaining = (now = performance.now()) => snap ? Math.max(0, snap.duration * (1 - snapT(now))) : 0;
        const playing = (now = performance.now()) => !!snap && remaining(now) > 220 && snapT(now) < .9;
        const top = () => el.getBoundingClientRect().top + window.scrollY;
        const travel = () => Math.max(1, el.offsetHeight - window.innerHeight);
        const rawAtScroll = () => progressForScroll(SCROLL_SCREENS * (window.scrollY - top()) / travel());
        const yAtRaw = (raw: number) => top() + scrollScreensAt(raw) / SCROLL_SCREENS * travel();
        const placeScroll = (y: number) => { syntheticY = y; lastY = y; window.scrollTo({ top: y, behavior: 'instant' }); };
        const report = () => {
            const nearest = nearestStep(state.current.progress), exact = Math.abs(STORY_STEPS[nearest].raw - state.current.progress) < .00001;
            const next = {
                storyProgress: state.current.progress.toFixed(6),
                storyTarget: state.current.target.toFixed(6),
                storyCount: String(STORY_STEPS.length),
                storyMode: diagnostic ? 'diagnostic' : 'continuous',
                storyIndex: String(nearest),
                storyStep: STORY_STEPS[nearest].id,
                storyState: snap ? 'settling' : exact ? 'settled' : 'scrolling',
            };
            for (const [key, value] of Object.entries(next))
                if (el.dataset[key] !== value)
                    el.dataset[key] = value;
        };
        const finishSnap = () => {
            if (!snap)
                return;
            const current = snap;
            snap = null;
            state.current.progress = current.to;
            state.current.target = current.to;
            placeScroll(current.toY);
            report();
        };
        const accelerate = () => {
            const now = performance.now(), current = snap;
            if (!current)
                return false;
            if (remaining(now) <= 220 || snapT(now) >= .9) {
                finishSnap();
                return false;
            }
            const t = snapT(now), ease = easeStep(t);
            snap = { from: mix(current.from, current.to, ease), to: current.to, fromY: mix(current.fromY, current.toY, ease), toY: current.toY, start: now, duration: Math.max(180, Math.min((current.duration * (1 - t)) / 3, 480)) };
            report();
            return true;
        };
        const seek = (raw: number, instant = false) => {
            const to = STORY_STEPS[settleIndex(raw, direction)].raw;
            if (!instant && !reduced.matches && snap && Math.abs(snap.to - to) < 1e-6)
                return void accelerate();
            state.current.target = to;
            if (instant) {
                snap = null;
                state.current.progress = to;
                placeScroll(yAtRaw(to));
                report();
                return;
            }
            const from = state.current.progress, next = nearestStep(to), fromStep = nearestStep(from);
            const other = Math.max(0, Math.min(STORY_STEPS.length - 1, next + (from > to ? 1 : -1)));
            const fraction = Math.min(1, Math.abs(to - from) / Math.max(.01, Math.abs(to - STORY_STEPS[other].raw)));
            const away = Math.abs(next - fromStep);
            const ppt = /^(cover|intro|case-study|begin|commerce|thanks)$/.test(STORY_STEPS[next].id);
            const duration = ppt
                ? Math.max(180, Math.min(320, STORY_STEPS[next].duration * .55))
                : away <= 1
                ? Math.max(240, STORY_STEPS[next].duration * Math.max(fraction, .7))
                : Math.max(520, Math.min(1200, 560 + away * 36));
            snap = { from, to, fromY: window.scrollY, toY: yAtRaw(to), start: performance.now(), duration };
            report();
        };
        const onScroll = () => {
            const y = window.scrollY;
            if (syntheticY !== null && Math.abs(y - syntheticY) < 2)
                return;
            syntheticY = null;
            direction = Math.sign(y - lastY) || direction;
            lastY = y;
            lastInput = performance.now();
            snap = null;
            state.current.target = rawAtScroll();
        };
        // Passive observation only. The browser owns wheel, momentum, touch and keys.
        // A fresh gesture immediately interrupts automatic settling in either direction.
        const intent = (e: Event) => {
            if (e.defaultPrevented)
                return;
            if (e instanceof WheelEvent && (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)))
                return;
            if (e instanceof KeyboardEvent && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key))
                return;
            if (snap) {
                snap = null;
                syntheticY = null;
                state.current.target = rawAtScroll();
            }
            lastInput = performance.now();
        };
        const onStep = (e: Event) => {
            direction = Math.sign((e as CustomEvent<number>).detail) || 1;
            lastInput = performance.now();
            if (accelerate())
                return;
            const current = settleIndex(state.current.target, direction);
            seek(STORY_STEPS[Math.max(0, Math.min(STORY_STEPS.length - 1, current + (Math.abs(STORY_STEPS[current].raw - state.current.target) < .00001 ? direction : 0)))].raw);
        };
        const onSeek = (e: Event) => { lastInput = performance.now(); const raw = STORY_STEPS[nearestStep((e as CustomEvent<number>).detail)].raw; direction = Math.sign(raw - state.current.progress) || 1; seek(raw); };
        const hash = () => { const id = CHAPTER_STEPS[location.hash.slice(1)], raw = STORY_STEPS.find(s => s.id === id)?.raw ?? 0; seek(raw, !booted); booted = true; };
        const resize = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (diagnostic) {
            state.current.target = rawAtScroll();
            return;
        } snap = null; const raw = STORY_STEPS[settleIndex(state.current.target, direction)].raw; seek(raw, true); }); };
        const visibility = () => { if (document.hidden && !diagnostic)
            seek(state.current.target, true); };
        const tick = (now: number) => {
            const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
            last = now;
            if (diagnostic) {
                state.current.progress = state.current.target;
            }
            else if (snap) {
                const t = Math.min(1, (now - snap.start) / snap.duration), ease = easeStep(t);
                state.current.progress = mix(snap.from, snap.to, ease);
                placeScroll(mix(snap.fromY, snap.toY, ease));
                if (t === 1) {
                    const landed = snap.to;
                    state.current.progress = landed;
                    snap = null;
                    const landedId = STORY_STEPS[nearestStep(landed)].id;
                    if (direction > 0 && landedId === 'research-stream')
                        seek(STORY_STEPS.find(s => s.id === 'research-taught')!.raw);
                    if (direction > 0 && landedId === 'research-graph')
                        seek(STORY_STEPS.find(s => s.id === 'answer-one')!.raw);
                    if (direction > 0 && landedId === 'graph-document')
                        seek(STORY_STEPS.find(s => s.id === 'graph-doc-read')!.raw);
                }
            }
            else {
                state.current.progress = reduced.matches ? state.current.target : mix(state.current.progress, state.current.target, 1 - Math.exp(-dt * 24));
                if (Math.abs(state.current.progress - state.current.target) < .00001)
                    state.current.progress = state.current.target;
                if (now - lastInput > 140) {
                    const settled = STORY_STEPS[settleIndex(state.current.target, direction)].raw;
                    if (Math.abs(settled - state.current.target) > .000001)
                        seek(settled);
                }
            }
            report();
            frame = requestAnimationFrame(tick);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        const restoration = history.scrollRestoration;
        history.scrollRestoration = 'manual';
        if (diagnostic)
            state.current.target = rawAtScroll();
        else
            hash();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', resize);
        if (!diagnostic) {
            window.addEventListener('wheel', intent, { passive: true });
            window.addEventListener('touchmove', intent, { passive: true });
            window.addEventListener('keydown', intent);
            window.addEventListener(STEP_EVENT, onStep);
            window.addEventListener(SEEK_EVENT, onSeek);
            window.addEventListener('hashchange', hash);
        }
        document.addEventListener('visibilitychange', visibility);
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            cancelAnimationFrame(resizeFrame);
            observer.disconnect();
            history.scrollRestoration = restoration;
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', resize);
            window.removeEventListener('wheel', intent);
            window.removeEventListener('touchmove', intent);
            window.removeEventListener('keydown', intent);
            window.removeEventListener(STEP_EVENT, onStep);
            window.removeEventListener(SEEK_EVENT, onSeek);
            window.removeEventListener('hashchange', hash);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [root]);
    return state;
}
export function columnLayout(width: number, height: number) {
    const narrow = width < 620;
    const compact = width <= 940;
    const top = narrow && height < 510 ? 108 : Math.max(narrow ? 126 : 118, Math.min(152, height * .22));
    const bottom = height - 38;
    const step = (bottom - top) / 6;
    const size = Math.min(narrow ? 62 : 86, step * .79);
    const x = width * (narrow ? .095 : compact ? .11 : .32);
    return { x, top, step, size, labelX: x + size / 2 + (narrow ? 9 : 14),
        answerSize: Math.min(narrow ? 14 : compact ? 16 : Math.min(21, Math.max(16, width * .0145)), Math.max(11, (step - 6) / 3)),
        centerX: width * .12, centerY: height * .55,
        goalX: width * (narrow ? .55 : compact ? .55 : .655), goalTop: top, goalBottom: bottom };
}
export const goals = [
    { id: 'application', title: '做成一个应用', subtitle: '知乎上有人说：先调用现成模型，做成能演示的应用。', compactSubtitle: '先调用现成模型，做成能演示的应用。', steps: '调用 → 验证 → 交付', tag: '把它用起来' },
    { id: 'principles', title: '从零训一个小模型', subtitle: '也有人说：先自己训完一个能验收的小模型。', compactSubtitle: '先自己训完一个能验收的小模型。', steps: '规模与预算 → 结构与词表 → 训练与验收', tag: '亲手训起来' },
    { id: 'research', title: '复现一篇论文', subtitle: '还有人说：先亲手对照一篇公开方法。', compactSubtitle: '先亲手对照一篇公开方法。', steps: '读懂方法 → 运行基线 → 对比实验', tag: '亲手验证它' },
] as const;
export type GoalId = typeof goals[number]['id'];
export const characterGoals: GoalId[] = ['application', 'principles', 'principles', 'application', 'principles', 'research'];
