import { useEffect,useRef,useState,type RefObject } from 'react';
import { NodeEditor } from "../../components/learning/NodeEditor.tsx";
import { NodeToolbar } from "../../components/learning/NodeToolbar.tsx";
import { cardColors } from "../../components/learning/card-colors.ts";
import type { GraphNode } from "../../components/learning/model.ts";
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { seekLegacy } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { copyText } from "../../runtime/clipboard.ts";
import "../../styles/learning.css";
import { networkProgress } from "../../core/timeline.ts";
import { LearningCardContent,LearningCardModel } from "./LearningCardModel.tsx";
import { LearningGuideCursor } from "./LearningGuideCursor.tsx";
import { LearningProductPrompt } from "./LearningProductPrompt.tsx";
import { LearningStartCard } from "./LearningStartCard.tsx";
import { guideAt } from "./learning-guide.ts";
import { answerBoxes,answerEntry,answerStream,askFromAnswer,authorBoxes,authorEntry,authorPromptAlpha,authorPromptBox,cameraAt,chapterStops,colorProgress,customBox,customEntry,edgePath,featuredAnswers,featuredSources,learningProgress,lerp,lightAt,overviewCameraAt,part,promptAlpha,promptBox,rawAtLearning,replyBoxes,replyEntry,rootBox,sourceBoxes,sourceEntry,type Box } from "./learning-motion.ts";
import content,{ projectScenario } from "./learning-story-content.ts";
import { useOverviewCardFocus } from "./useOverviewCardFocus.ts";
const focusId = content.answers[askFromAnswer].id;
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const noteMarkdown = projectScenario.note;
function Wire({ id }: {
    id: string;
}) { return <g data-wire={id}><path className="learn-wire-base" pathLength="1"/><g className="learn-wire-light"><path className="wire-halo" pathLength="100"/><path className="wire-tail" pathLength="100"/><path className="wire-tip" pathLength="100"/></g></g>; }
export function LearningStoryScene({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLElement>(null);
    useOverviewCardFocus(host, transition);
    const [chosenColor, setChosenColor] = useState(cardColors[12]);
    const [chosenStroke, setChosenStroke] = useState(1);
    const [colorApplied, setColorApplied] = useState(false);
    const [extraMenu, setExtraMenu] = useState(false);
    const [editTitle, setEditTitle] = useState(false);
    const [localTitle, setLocalTitle] = useState(content.followup.paragraphs[0].title);
    const [customTitle, setCustomTitle] = useState('我的学习笔记');
    const [customText, setCustomText] = useState(noteMarkdown);
    const [customSibling, setCustomSibling] = useState(false);
    const [removedBranch, setRemovedBranch] = useState(false);
    const [copyResult, setCopyResult] = useState<{ copied: boolean; text: string } | null>(null);
    const copyField = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (copyResult && !copyResult.copied) {
            copyField.current?.focus({ preventScroll: true });
            copyField.current?.select();
        }
    }, [copyResult]);
    const editNode: GraphNode = { ...content.followup.paragraphs[0], type: 'answer', origin: 'articles', title: localTitle, color: colorApplied ? chosenColor : '#ffffff', stroke: chosenStroke };
    const go = (p: number) => seekLegacy(rawAtLearning(p));
    useEffect(() => {
        const el = host.current!, viewport = el.querySelector<HTMLElement>('.learn-viewport')!, world = el.querySelector<HTMLElement>('.learn-world')!;
        const root = el.querySelector<HTMLElement>('.learn-root')!, aiPrompt = el.querySelector<HTMLElement>('.learn-ai-prompt')!, authorPrompt = el.querySelector<HTMLElement>('.learn-author-prompt')!;
        const toolbar = el.querySelector<HTMLElement>('.learn-selected-tools')!, palette = el.querySelector<HTMLElement>('.learn-palette')!, addMenu = el.querySelector<HTMLElement>('.learn-add-menu')!, cursor = el.querySelector<HTMLElement>('.learn-demo-cursor')!, custom = el.querySelector<HTMLElement>('.learn-custom')!;
        const sources = [...el.querySelectorAll<HTMLElement>('[data-source-card]')], answers = [...el.querySelectorAll<HTMLElement>('[data-answer-card]')], replies = [...el.querySelectorAll<HTMLElement>('[data-reply-card]')], authors = [...el.querySelectorAll<HTMLElement>('[data-author-card]')];
        const wires = new Map([...el.querySelectorAll<SVGGElement>('[data-wire]')].map(n => [n.dataset.wire!, n]));
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        let width = 0, height = 0, last = -1, lastStory = '', dirty = true, frame = 0, applied = colorApplied;
        const resize = new ResizeObserver(() => { width = viewport.clientWidth; height = viewport.clientHeight; dirty = true; });
        resize.observe(viewport);
        const refresh = () => { dirty = true; };
        media.addEventListener('change', refresh);
        document.addEventListener('visibilitychange', refresh);
        function place(node: HTMLElement, b: Box, entry: number, alpha = 1) {
            const visible = entry > .0001 && alpha > .001;
            node.style.visibility = visible ? 'visible' : 'hidden';
            node.style.opacity = String(Math.min(1, entry * 8) * alpha);
            node.inert = !visible || entry < .98;
            node.setAttribute('aria-hidden', String(!visible));
            node.style.transform = `translate3d(${b.x}px,${b.y}px,0)`;
            node.style.width = `${b.w}px`;
            node.style.height = `${b.h}px`;
            node.style.setProperty('--shell-x', String(lerp(.025, 1, part(entry, 0, .79))));
            node.style.setProperty('--shell-y', String(lerp(.065, 1, part(entry, .10, 1))));
            node.style.setProperty('--card-ink', String(part(entry, .43, .96)));
            node.style.setProperty('--ink-rise', `${(1 - part(entry, .4, 1)) * 8}px`);
        }
        function glow(node: HTMLElement, p: number, a: number, b: number) { const l = lightAt(p, a, b); node.style.setProperty('--glow-alpha', String(media.matches ? 0 : l.alpha)); node.style.setProperty('--glow-offset', String(-l.travel * 110)); }
        function wire(id: string, a: Box, b: Box, p: number, start: number, end: number) {
            const g = wires.get(id)!;
            g.style.opacity = removedBranch && (id === 'reply-0' || id.startsWith('author-') || (id === 'custom' && !customSibling)) ? '0' : '1';
            const d = edgePath(a, b), v = part(p, start, end), l = lightAt(p, start, end + .028);
            g.style.visibility = v < .0001 ? 'hidden' : 'visible';
            for (const path of g.querySelectorAll('path'))
                if (path.getAttribute('d') !== d)
                    path.setAttribute('d', d);
            g.querySelector<SVGPathElement>('.learn-wire-base')!.style.strokeDashoffset = String(1 - v);
            const light = g.querySelector<SVGGElement>('.learn-wire-light')!;
            light.style.opacity = String(media.matches ? 0 : l.alpha);
            light.style.setProperty('--wire-offset', String(10 - l.travel * 110));
        }
        function update() {
            const raw = legacyRaw(transition.current.progress);
            const visible = raw >= 9.41 && raw < 31.0 && !(raw >= 28.05 && raw < 29.08);
            const expand = raw <= 9.52 ? 0 : part(raw, 9.52, 9.60);
            const collapse = raw < 26.9 ? 0 : part(raw, 26.9, 27.8);
            const slotT = Math.max(raw <= 9.52 ? 1 : 1 - expand, collapse);
            if (el.dataset.active !== String(visible))
                el.dataset.active = String(visible);
            const split = String(visible && slotT > .05);
            if (el.dataset.split !== split)
                el.dataset.split = split;
            el.style.visibility = visible ? 'visible' : 'hidden';
            el.style.opacity = visible ? String(1 - part(raw, 29.18, 30.05)) : '0';
            el.inert = !visible;
            el.setAttribute('aria-hidden', String(!visible));
            const slot = visible && slotT > .005 ? document.querySelector<HTMLElement>('[data-graph-slot]') : null;
            const page = el.parentElement;
            if (visible && slotT > .005 && slot && page) {
                const s = slot.getBoundingClientRect(), h = page.getBoundingClientRect(), t = slotT;
                el.style.transform = '';
                el.style.top = `${(s.top - h.top) * t}px`;
                el.style.right = `${(h.right - s.right) * t}px`;
                el.style.bottom = `${(h.bottom - s.bottom) * t}px`;
                el.style.left = `${(s.left - h.left) * t}px`;
                el.style.borderRadius = `${12 * t}px`;
                width = viewport.clientWidth;
                height = viewport.clientHeight;
            }
            else {
                if (el.style.top && el.style.top !== '0' && el.style.top !== '0px') {
                    el.style.top = el.style.right = el.style.bottom = el.style.left = '0';
                    el.style.transform = '';
                    el.style.borderRadius = '';
                }
                if (visible) {
                    width = viewport.clientWidth;
                    height = viewport.clientHeight;
                }
            }
            const storyState = document.querySelector<HTMLElement>('.scroll-story')?.dataset.storyState ?? '';
            if (!document.hidden && (last !== raw || dirty || lastStory !== storyState) && width > 0 && height > 0) {
                last = raw;
                lastStory = storyState;
                dirty = false;
                if (removedBranch && raw < 15.8)
                    setRemovedBranch(false);
                if (visible) {
                    let p = learningProgress(raw);
                    if (media.matches && p > .08)
                        p = chapterStops.find(s => s >= p) ?? 2.04;
                    if ((p >= 1.604) !== applied) {
                        applied = p >= 1.604;
                        setColorApplied(applied);
                    }
                    const splitOverview = slotT > .05;
                    const c = splitOverview ? (collapse > .05 || p >= .28 ? overviewCameraAt(width, height) : cameraAt(0, width, height)) : cameraAt(p, width, height);
                    const tx = width / 2 - c.x * c.scale, ty = height / 2 - c.y * c.scale;
                    el.dataset.learningProgress = p.toFixed(5);
                    el.dataset.cameraX = c.x.toFixed(3);
                    el.dataset.cameraScale = c.scale.toFixed(4);
                    world.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${c.scale})`;
                    const overview = c.scale < 0.2;
                    if (el.dataset.overview !== String(overview))
                        el.dataset.overview = String(overview);
                    viewport.style.setProperty('--grid-alpha', String(.22 * part(p, .07, .17)));
                    viewport.style.setProperty('--grid-x', `${tx}px`);
                    viewport.style.setProperty('--grid-y', `${ty}px`);
                    viewport.style.setProperty('--grid-step', `${46 * c.scale}px`);
                    place(root, rootBox, 1);
                    root.dataset.selected = String(p > .165 && p < .32);
                    glow(root, p, 0, .12);
                    sources.forEach((node, i) => { node.dataset.selected = String((i === 0 && p > .40 && p < .52) || (i === 1 && p > .58 && p < .68)); const index = featuredSources[i], b = sourceBoxes[index]; place(node, b, sourceEntry(p, i)); glow(node, p, .268 + i * .028, .330 + i * .028); wire(`source-${index}`, rootBox, b, p, .236 + i * .028, .278 + i * .028); });
                    answers.forEach((node, i) => { const index = featuredAnswers[i], data = content.answers[index], from = sourceBoxes[content.articles.findIndex(a => a.id === data.parents[0])], stream = answerStream(i); place(node, answerBoxes[index], answerEntry(p, i)); glow(node, p, stream.start, stream.end + .02); node.dataset.selected = String((i === 0 && p > .46 && p < .51) || (i === 1 && p > .51 && p < .58) || (index === askFromAnswer && p > .70 && p < .987)); if (from) wire(`answer-${index}`, from, answerBoxes[index], p, stream.start - .01, stream.start + .05); });
                    place(aiPrompt, promptBox(width), promptAlpha(p));
                    replies.forEach((node, i) => { place(node, replyBoxes[i], replyEntry(p, i), removedBranch && i === 0 ? 0 : 1); glow(node, p, .90 + i * .02, .963 + i * .02); node.dataset.selected = String(i === 0 && ((p > 1.005 && p < 1.355) || (p > 1.507 && p < 1.79))); wire(`reply-${i}`, answerBoxes[askFromAnswer], replyBoxes[i], p, .842 + i * .02, .884 + i * .02); if (i === 0) {
                        const color = colorProgress(p), fill = rgb(chosenColor);
                        node.style.setProperty('--card-fill', `rgb(${fill.map(v => lerp(255, v, color)).join(',')})`);
                        node.style.setProperty('--card-line', '#d8dce2');
                        node.style.setProperty('--card-stroke', String(lerp(1, chosenStroke, color)));
                    } });
                    place(authorPrompt, authorPromptBox(width), authorPromptAlpha(p));
                    authors.forEach((node, i) => { node.dataset.selected = String(i === 1 && p > 1.393 && p < 1.45); place(node, authorBoxes[i], authorEntry(p, i), removedBranch ? 0 : 1 - part(raw, 29.18, 29.48)); glow(node, p, 1.215 + i * .025, 1.29 + i * .025); wire(`author-${i}`, replyBoxes[0], authorBoxes[i], p, 1.15 + i * .025, 1.202 + i * .025); });
                    const firstTools = part(p, .718, .731) * (1 - part(p, .747, .759)), laterTools = part(p, 1.009, 1.024) * (1 - part(p, 1.035, 1.049)), editTools = part(p, 1.512, 1.538) * (1 - part(p, 1.71, 1.744));
                    const anchor = p < .98 ? answerBoxes[askFromAnswer] : replyBoxes[0];
                    place(toolbar, { x: anchor.x, y: anchor.y + anchor.h + 16, w: 520, h: 61 }, removedBranch && p > .98 ? 0 : Math.max(firstTools, laterTools, editTools));
                    place(palette, { x: replyBoxes[0].x, y: replyBoxes[0].y + 460, w: 520, h: 310 }, part(p, 1.558, 1.579) * (1 - part(p, 1.63, 1.656)));
                    palette.dataset.chosen = String(p >= 1.604);
                    place(addMenu, { x: replyBoxes[0].x, y: replyBoxes[0].y + 460, w: 390, h: extraMenu ? 230 : 142 }, extraMenu && p > 1.52 && p < 1.735 ? 1 : part(p, 1.669, 1.688) * (1 - part(p, 1.721, 1.747)));
                    const legend = el.querySelector<HTMLElement>('.learn-split-legend');
                    if (legend) {
                        legend.style.opacity = String(slotT);
                        const zoom = el.querySelector<HTMLElement>('[data-split-zoom]');
                        if (zoom)
                            zoom.textContent = `${Math.max(8, Math.round(c.scale * 100))}%`;
                    }
                    const pointer = guideAt(p, width), size = 24 / c.scale;
                    const rest = storyState === 'settled';
                    place(cursor, { x: pointer.x - 1.64 / c.scale, y: pointer.y - 1.64 / c.scale, w: size, h: size * 54 / 44 }, rest ? 0 : pointer.alpha);
                    cursor.style.setProperty('--guide-press', '1');
                    const presses = [{ start: .742, label: '询问 AI' }, { start: 1.031, label: '问博主' }, { start: 1.538, label: '卡片颜色和描边' }, { start: 1.67, label: '添加卡片' }];
                    for (const button of toolbar.querySelectorAll('button')) {
                        const label = button.getAttribute('aria-label') ?? button.textContent?.trim(), press = presses.find(v => v.label === label), pressure = press ? part(p, press.start - .004, press.start) * (1 - part(p, press.start + .005, press.start + .015)) : 0;
                        button.style.setProperty('--button-press', String(pressure));
                        button.toggleAttribute('data-guided', !!press && p > press.start - .009 && p < press.start + .016);
                    }
                    for (const [card, time] of [[root, .166], [sources[0], .46], [sources[1], .63], [answers[2], .714], [replies[0], 1.005], [authors[1], 1.393], [custom, 1.79]] as const) {
                        card?.style.setProperty('--card-press', String(part(p, time - .003, time) * (1 - part(p, time + .004, time + .016))));
                    }
                    const green = palette.querySelector<HTMLElement>('[aria-label="颜色 13 #dff1e5"]');
                    green?.style.setProperty('--button-press', String(part(p, 1.600, 1.604) * (1 - part(p, 1.609, 1.624))));
                    const child = addMenu.querySelectorAll<HTMLElement>('.lp-node-menu button')[1];
                    child?.style.setProperty('--button-press', String(part(p, 1.714, 1.72) * (1 - part(p, 1.725, 1.739))));
                    custom.dataset.selected = String(p > 1.79 && p < 1.925);
                    place(custom, customBox, customEntry(p), removedBranch && !customSibling ? 0 : 1);
                    glow(custom, p, 1.8, 1.885);
                    wire('custom', customSibling ? answerBoxes[askFromAnswer] : replyBoxes[0], customBox, p, 1.735, 1.79);
                }
            }
            frame = requestAnimationFrame(update);
        }
        frame = requestAnimationFrame(update);
        return () => { cancelAnimationFrame(frame); resize.disconnect(); media.removeEventListener('change', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [transition, chosenColor, chosenStroke, extraMenu, customSibling, removedBranch]);
    const copied = async () => {
        const text = learningProgress(legacyRaw(transition.current.progress)) < .98 ? content.answers[askFromAnswer].markdown : (editNode.text || content.followup.paragraphs[0].markdown);
        setCopyResult({ copied: await copyText(text), text });
    };
    const add = (kind: 'child' | 'sibling') => { setCustomSibling(kind === 'sibling'); setExtraMenu(false); go(1.88); };
    const editorActions = { node: editNode, onMode: () => { }, onClose: () => { setExtraMenu(false); go(1.66); }, onAdd: add, onEdit: () => { setEditTitle(true); setExtraMenu(false); go(1.54); }, onColor: (color: string) => { setChosenColor(color); go(1.62); }, onStroke: setChosenStroke, onDuplicate: () => { setCustomTitle(editNode.title); setCustomText(editNode.text); add('sibling'); }, onDelete: () => { setExtraMenu(false); setRemovedBranch(true); } };
    return <section ref={host} className="learning-scene" data-active="false" aria-label="学习画布展示" aria-hidden="true" inert>
  <div className="learn-viewport"><div className="learn-world">
   <svg className="learn-wires" width="4000" height="4000" aria-hidden="true">{featuredSources.map(i => <Wire key={i} id={`source-${i}`}/>)}{featuredAnswers.map(i => <Wire key={i} id={`answer-${i}`}/>)}{content.followup.paragraphs.map((_, i) => <Wire key={i} id={`reply-${i}`}/>)}{content.authorFollowup.paragraphs.map((_, i) => <Wire key={i} id={`author-${i}`}/>)}<Wire id="custom"/></svg>
   <article className="learn-object learn-root" data-node-id={content.provenance.conceptId}><LearningCardModel kind="root"><LearningStartCard /></LearningCardModel></article>
   {featuredSources.map(index => { const a = content.articles[index]; return <article className="learn-object learn-source" data-source-card={index} data-node-id={a.id} data-parent-id={content.provenance.conceptId} key={a.id}><LearningCardModel kind="article"><LearningCardContent stream={{ transition, start: .252 + featuredSources.indexOf(index) * .028, end: .288 + featuredSources.indexOf(index) * .028 }} node={{ id: a.id, type: "article", title: a.title, text: a.markdown, sources: [a.id], parents: [content.provenance.conceptId] }} fullText={a.markdown}/></LearningCardModel></article>; })}
   {featuredAnswers.map(index => { const a = content.answers[index], stream = answerStream(featuredAnswers.indexOf(index)); return <article className="learn-object learn-answer" data-answer-card={index} data-node-id={a.id} data-parent-id={a.parents[0]} key={a.id}><LearningCardModel kind="answer"><LearningCardContent stream={{ transition, start: stream.start, end: stream.end }} node={{ ...a, type: "answer", text: a.markdown }} fullText={a.markdown}/></LearningCardModel></article>; })}
   <div className="learn-object learn-selected-tools"><div className="learn-product-ui learn-controls-scale"><NodeToolbar onAdd={() => { setExtraMenu(false); go(1.69); }} onColor={() => { setExtraMenu(false); go(1.575); }} onCopy={() => void copied()} onMore={() => { setExtraMenu(true); go(1.69); }} onAsk={() => go(.805)} onAuthor={() => go(1.095)}/>{copyResult && <div className="learn-copy-result" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><span role="status">{copyResult.copied ? '已复制当前卡片内容' : '无法自动复制，请手动复制下方已选中的内容。'}</span><button type="button" aria-label="关闭复制提示" onClick={() => setCopyResult(null)}>×</button>{!copyResult.copied && <textarea ref={copyField} aria-label="待复制的卡片内容" value={copyResult.text} readOnly rows={3}/>}</div>}</div></div>
   <div className="learn-object learn-prompt learn-ai-prompt" data-selected-node={focusId}><div className="learn-product-ui learn-controls-scale"><LearningProductPrompt transition={transition} question={content.followup.question} title={content.answers[askFromAnswer].title} onSubmit={() => go(.93)} onClose={() => go(.72)}/></div></div>
   {content.followup.paragraphs.map((a, i) => <article className="learn-object learn-answer learn-new-answer" data-reply-card={i} data-node-id={a.id} data-parent-id={a.parents[0]} key={a.id}><LearningCardModel kind="answer"><LearningCardContent stream={{ transition, start: .900 + i * .02, end: .942 + i * .02 }} node={{ ...a, type: "answer", origin: "articles", title: i === 0 ? localTitle : a.title, text: a.markdown }} fullText={a.markdown} editing={i === 0 && editTitle} onFinishEdit={title => { setLocalTitle(title); setEditTitle(false); }}/></LearningCardModel></article>)}
   <div className="learn-object learn-prompt learn-author-prompt" data-selected-node={content.followup.paragraphs[0].id}><div className="learn-product-ui learn-controls-scale"><LearningProductPrompt transition={transition} author question={content.authorFollowup.question} title={content.followup.paragraphs[0].title} onSubmit={() => go(1.31)} onClose={() => go(1.02)}/></div></div>
   {content.authorFollowup.paragraphs.map((a, i) => <article className="learn-object learn-author" data-author-card={i} data-node-id={a.id} data-parent-id={a.parents[0]} key={a.id}><LearningCardModel kind="author"><LearningCardContent stream={{ transition, start: 1.212 + i * .025, end: 1.276 + i * .025 }} node={{ ...a, type: "author", origin: "author", author: { ...a.author, sourceKind: a.author.sourceKind === 'web' ? 'web' : 'zhihu' }, text: a.markdown }} fullText={a.markdown}/></LearningCardModel></article>)}
   <div className="learn-object learn-palette"><div className="learn-product-ui learn-controls-scale"><NodeEditor mode="color" {...editorActions}/></div></div>
   <div className="learn-object learn-add-menu"><div className="learn-product-ui learn-controls-scale"><NodeEditor mode={extraMenu ? 'more' : 'add'} {...editorActions}/></div></div>
   <div className="learn-object learn-demo-cursor" aria-hidden="true"><LearningGuideCursor /></div>
   <article className="learn-object learn-custom" data-node-id="showcase-custom-context-budget" data-parent-id={customSibling ? content.answers[askFromAnswer].id : content.followup.paragraphs[0].id}><LearningCardModel kind="custom"><LearningCardContent stream={{ transition, start: 1.793, end: 1.858 }} node={{ id: "showcase-custom-context-budget", type: "custom", title: customTitle, text: customText, sources: [], parents: [customSibling ? content.answers[askFromAnswer].id : content.followup.paragraphs[0].id] }} fullText={customText}/></LearningCardModel></article>
  </div></div>
  <span className="learn-scenario-note">选中任意卡片，问 AI 或检索博主公开观点，让理解继续生长。</span>
  <div className="learn-split-legend" aria-hidden="true"><span><i/><span>概念</span><span className="learn-legend-article"/><span>文章</span><span className="learn-legend-answer"/><span>回答</span></span><span>Shift 多选 · Tab 添加 · 双击编辑</span><button type="button" tabIndex={-1} data-split-zoom>16%</button></div>
 </section>;
}
