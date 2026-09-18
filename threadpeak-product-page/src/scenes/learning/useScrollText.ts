import { useEffect,useState,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { streamingMarkdown } from "../../shared/reading/streaming-markdown.ts";
import { chapterStops,learningProgress } from "./learning-motion.ts";
export type TextStream = {
    transition: RefObject<ScrollTransition>;
    start: number;
    end: number;
};
/** Actual growing Markdown strings; the complete source is never changed.
 * Punctuation costs a little more scroll distance, like a brief typing pause.
 */
export function useScrollText(title: string, text: string, stream?: TextStream) {
    const [counts, setCounts] = useState({ title: stream ? 0 : title.length, text: stream ? 0 : text.length });
    useEffect(() => {
        if (!stream) {
            setCounts({ title: title.length, text: text.length });
            return;
        }
        let frame = 0, lastTitle = -1, lastText = -1;
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const titleChars = [...title], chars = [...text], weights = chars.map(c => /[。！？；]/.test(c) ? 2.2 : /[，、：\n]/.test(c) ? 1.35 : 1), total = weights.reduce((sum, n) => sum + n, 0);
        const tick = () => {
            const raw = learningProgress(legacyRaw(stream.transition.current.progress)), p = media.matches ? (chapterStops.find(n => n >= raw) ?? 2.04) : raw, q = media.matches ? (p >= stream.start ? 1 : 0) : Math.max(0, Math.min(1, (p - stream.start) / (stream.end - stream.start)));
            const titleCount = Math.min(titleChars.length, Math.floor(q / .13 * titleChars.length));
            let budget = Math.max(0, (q - .13) / .87) * total, count = 0;
            while (count < chars.length && budget >= weights[count])
                budget -= weights[count++];
            if (q === 1)
                count = chars.length;
            if (titleCount !== lastTitle || count !== lastText) {
                lastTitle = titleCount;
                lastText = count;
                setCounts({ title: titleChars.slice(0, titleCount).join('').length, text: chars.slice(0, count).join('').length });
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [title, text, stream?.transition, stream?.start, stream?.end]);
    return { title: title.slice(0, counts.title), text: streamingMarkdown(text.slice(0, counts.text)) || '\u200b', streaming: counts.title < title.length || counts.text < text.length };
}
