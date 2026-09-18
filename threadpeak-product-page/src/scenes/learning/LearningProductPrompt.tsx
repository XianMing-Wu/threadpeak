import { useEffect,useState,type RefObject } from 'react';
import { SendControl } from "../../components/controls/SendControl.tsx";
import { Glyph,IconButton } from "../../components/learning/atoms.tsx";
import { cycleDialogFocus } from "../../components/learning/dialog-focus.ts";
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { chapterStops,learningProgress,part } from "./learning-motion.ts";
type Phase = 'waiting' | 'focused' | 'typing' | 'ready' | 'sending';
/** Source NodePrompt UI, with a scroll-controlled demonstration instead of a network request. */
export function LearningProductPrompt({ author = false, question, title, onSubmit, onClose, transition }: {
    transition: RefObject<ScrollTransition>;
    author?: boolean;
    question: string;
    title: string;
    onSubmit: () => void;
    onClose: () => void;
}) {
    const [state, setState] = useState({ typed: '', phase: 'waiting' as Phase, pressure: 0 });
    useEffect(() => {
        let frame = 0, last = '';
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const chars = [...question], weights = chars.map(c => /[，。？、：]/.test(c) ? 2.1 : 1), total = weights.reduce((n, w) => n + w, 0);
        const focus = author ? 1.077 : .779, start = author ? 1.09 : .791, end = author ? 1.122 : .821, send = author ? 1.138 : .834;
        const tick = () => {
            const raw = learningProgress(legacyRaw(transition.current.progress)), p = media.matches ? (chapterStops.find(n => n >= raw) ?? 2.04) : raw, t = Math.max(0, Math.min(1, (p - start) / (end - start)));
            let budget = t * total, index = 0;
            while (index < chars.length && budget >= weights[index])
                budget -= weights[index++];
            if (t === 1 || (media.matches && p >= focus))
                index = chars.length;
            const phase: Phase = p < focus ? 'waiting' : p < start ? 'focused' : p < end ? 'typing' : p < send ? 'ready' : 'sending';
            const pressure = Number((part(p, send - .004, send) * (1 - part(p, send + .006, send + .02))).toFixed(2)), key = `${index}-${phase}-${pressure}`;
            if (key !== last) {
                last = key;
                setState({ typed: chars.slice(0, index).join(''), phase, pressure });
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [transition, question, author]);
    const { typed, phase, pressure } = state, focused = phase !== 'waiting' && phase !== 'sending', closeLabel = author ? '关闭问博主输入框' : '关闭询问 AI 输入框';
    const field = <div className="learn-input-field"><textarea aria-label={author ? '问博主的问题' : '询问 AI 的问题'} value={typed} readOnly rows={author ? 3 : 2}/><div className="learn-input-mirror" aria-hidden="true">{typed || (!focused ? <span>{author ? '想查找哪些公开观点？' : '询问 AI'}</span> : null)}{focused && <i className="learn-insertion-caret"/>}</div></div>;
    const send = <span className="learn-send-feedback" style={{ '--button-press': pressure } as React.CSSProperties}><SendControl busy={phase === 'sending'} disabled={!typed.trim()} onSend={onSubmit} onStop={onSubmit} sendLabel={author ? '查看公开观点示例' : '查看 AI 追问示例'}/></span>;
    return <form className={`lp-node-prompt ${author ? '' : 'lp-ai-quick'}`} data-input-focus={focused} data-phase={phase} role="dialog" aria-label={author ? '问博主' : '询问 AI'} onSubmit={e => { e.preventDefault(); onSubmit(); }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => { cycleDialogFocus(e); e.stopPropagation(); if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
    } }}>
  {author ? <><header><span><Glyph name="message" size={17}/><strong>问博主</strong></span><IconButton icon="close" label={closeLabel} onClick={onClose}/></header><div className="lp-node-prompt-sources" aria-label="本次引用节点"><span title={title}><Glyph name="graph" size={12}/><span>{title}</span></span></div>{field}</> : <><div className="lp-ai-input"><Glyph name="spark" size={19}/>{field}{send}</div><div className="lp-quick-actions"><span>选中卡片，接着追问</span><button type="button" onClick={onSubmit}><Glyph name="spark" size={19}/>查看这次追问</button></div></>}
  <footer><span className="lp-node-prompt-depth"><Glyph name="spark" size={author ? 14 : 13}/>快速回答</span><span role="status">{phase === 'sending' ? '展示结果…' : author ? '公开观点，不联系本人' : 'Esc 关闭'}</span>{author ? send : <IconButton icon="close" label={closeLabel} onClick={onClose}/>}</footer>
 </form>;
}
