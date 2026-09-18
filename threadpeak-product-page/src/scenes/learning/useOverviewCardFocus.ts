import { useEffect,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { CARD,learningProgress } from "./learning-motion.ts";
/** Click lifts the existing SVG face; pointer exit restores the unchanged tree. */
export function useOverviewCardFocus(host: RefObject<HTMLElement | null>, transition: RefObject<ScrollTransition>) {
    useEffect(() => {
        const scene = host.current!, viewport = scene.querySelector<HTMLElement>('.learn-viewport')!;
        const cards = [...scene.querySelectorAll<HTMLElement>('article.learn-object[data-node-id]')];
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let active: HTMLElement | null = null, enabled = false, frame = 0;
        const clear = () => {
            if (active) {
                active.style.removeProperty('--hover-x');
                active.style.removeProperty('--hover-y');
                active.style.removeProperty('--hover-scale');
                if (reduced.matches)
                    delete active.dataset.hoverLift;
                else
                    active.dataset.hoverLift = 'returning';
                active = null;
            }
            delete scene.dataset.hoveredCard;
        };
        const focus = (node: HTMLElement) => {
            if (!enabled || node.inert || active === node)
                return;
            const bounds = viewport.getBoundingClientRect(), anchor = node.getBoundingClientRect();
            const scale = anchor.width / CARD.w;
            if (scale <= 0)
                return;
            const margin = Math.max(28, bounds.width * .025);
            const size = Math.max(scale, Math.min(1.04, (bounds.width - 2 * margin) / CARD.w, (bounds.height - 2 * margin) / CARD.h));
            const w = CARD.w * size, h = CARD.h * size;
            const x = Math.min(bounds.right - margin - w, Math.max(bounds.left + margin, anchor.left + (anchor.width - w) / 2));
            const y = Math.min(bounds.bottom - margin - h, Math.max(bounds.top + margin, anchor.top + (anchor.height - h) / 2));
            clear();
            active = node;
            node.style.setProperty('--hover-x', `${(x - anchor.left) / scale}px`);
            node.style.setProperty('--hover-y', `${(y - anchor.top) / scale}px`);
            node.style.setProperty('--hover-scale', String(size / scale));
            node.dataset.hoverLift = 'active';
            scene.dataset.hoveredCard = node.dataset.nodeId;
        };
        const click = (event: MouseEvent) => {
            if (!(event.target instanceof Element))
                return;
            // Preserve source links, expand buttons, and the real card controls.
            if (event.target.closest('button,a,input,textarea,select,[contenteditable=true]'))
                return;
            const node = event.target.closest<HTMLElement>('article.learn-object[data-node-id]');
            if (node && scene.contains(node))
                focus(node);
        };
        const move = (event: PointerEvent) => {
            if (!active || (event.pointerType !== 'mouse' && event.pointerType !== 'pen'))
                return;
            const contains = (b: DOMRect) => event.clientX >= b.left && event.clientX <= b.right && event.clientY >= b.top && event.clientY <= b.bottom;
            const face = active.querySelector('.learn-card-model')!.getBoundingClientRect();
            // Keep the original anchor hittable while the enlarged face is moving.
            if (!contains(face) && !contains(active.getBoundingClientRect()))
                clear();
        };
        const read = (event: Event) => { const node = event.target instanceof Element ? event.target.closest<HTMLElement>('article.learn-object[data-node-id]') : null; if (node)
            focus(node); };
        const leaveWindow = (event: PointerEvent) => { if (event.relatedTarget === null)
            clear(); };
        const cleanups = cards.map(node => {
            const focusOut = (event: FocusEvent) => { if (active === node && !node.contains(event.relatedTarget as Node | null))
                clear(); };
            const finish = (event: TransitionEvent) => { if (event.propertyName === 'transform' && event.target === node.querySelector('.learn-card-model') && node.dataset.hoverLift === 'returning')
                delete node.dataset.hoverLift; };
            node.addEventListener('focusout', focusOut);
            node.addEventListener('transitionend', finish);
            return () => { node.removeEventListener('focusout', focusOut); node.removeEventListener('transitionend', finish); };
        });
        const update = () => {
            const progress = legacyRaw(transition.current.progress), target = legacyRaw(transition.current.target);
            const next = progress < 27.8 && target < 27.8 && learningProgress(progress) >= 1.98 && learningProgress(target) >= 1.98;
            if (next !== enabled) {
                enabled = next;
                scene.dataset.overviewInteractive = String(enabled);
                cards.forEach(node => { node.tabIndex = enabled ? 0 : -1; });
                if (!enabled)
                    clear();
            }
            frame = requestAnimationFrame(update);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                clear();
                return;
            }
            if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement && cards.includes(event.target)) {
                event.preventDefault();
                focus(event.target);
            }
        };
        const resize = new ResizeObserver(clear);
        resize.observe(viewport);
        scene.addEventListener('click', click);
        scene.addEventListener('keydown', onKey);
        scene.addEventListener('learning-card-read', read);
        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerout', leaveWindow);
        window.addEventListener('blur', clear);
        window.addEventListener('scroll', clear, { passive: true });
        frame = requestAnimationFrame(update);
        return () => { cancelAnimationFrame(frame); clear(); resize.disconnect(); cleanups.forEach(cleanup => cleanup()); scene.removeEventListener('click', click); scene.removeEventListener('keydown', onKey); scene.removeEventListener('learning-card-read', read); window.removeEventListener('pointermove', move); window.removeEventListener('pointerout', leaveWindow); window.removeEventListener('blur', clear); window.removeEventListener('scroll', clear); };
    }, [host, transition]);
}
