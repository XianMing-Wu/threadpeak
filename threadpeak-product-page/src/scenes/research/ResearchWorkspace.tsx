import 'katex/dist/katex.min.css';
import { useEffect,useRef,useState,type ReactNode,type RefObject } from 'react';
import kanshan from "../../../assets/images/illustrations/kanshan-ink.png";
import { CardAvatar } from "../../components/learning/CardAvatar.tsx";
import { Avatar, Glyph, IconButton, SourceTag } from "../../components/learning/atoms.tsx";
import { MarkdownMath } from "../../shared/reading/MarkdownMath.tsx";
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { seekLegacy } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { knowledgeDocRows } from "../learning/knowledge-tree.ts";
import { LearningGuideCursor } from "../learning/LearningGuideCursor.tsx";
import { researchLesson,streamBlocks } from "./research-content.ts";
import "./research.css";
import "../../components/controls/send-control.css";
import { clampPoint,cursorWindow,researchAt,researchTimes,waitPhases } from "./research-motion.ts";

const knowledgeDoc = knowledgeDocRows();

function centerOf(node: HTMLElement, host: DOMRect, x = .62, y = .45) {
    const box = node.getBoundingClientRect();
    return { x: box.left - host.left + box.width * x, y: box.top - host.top + box.height * y };
}

function isolateScroll(region: HTMLElement, scrollerFor: () => HTMLElement) {
    let drag: {
        id: number;
        y: number;
        top: number;
        moved: boolean;
    } | null = null;
    const onScrollbar = (event: PointerEvent, pane: HTMLElement) => {
        const box = pane.getBoundingClientRect();
        const gutter = Math.max(16, pane.offsetWidth - pane.clientWidth);
        return event.clientX >= box.right - gutter;
    };
    const interactive = (event: Event) => (event.target as HTMLElement | null)?.closest('button, a, input, textarea, select, [role=button], [data-source], .research-card, .research-back');
    const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const pane = scrollerFor();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pane.clientHeight : 1;
        pane.scrollTop += event.deltaY * unit;
        pane.scrollLeft += event.deltaX * unit;
    };
    const onDown = (event: PointerEvent) => {
        if (event.button !== 0 || interactive(event))
            return;
        const pane = scrollerFor();
        if (onScrollbar(event, pane))
            return;
        drag = { id: event.pointerId, y: event.clientY, top: pane.scrollTop, moved: false };
    };
    const onMove = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.id)
            return;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.abs(dy) < 8)
            return;
        if (!drag.moved) {
            drag.moved = true;
            region.setPointerCapture(event.pointerId);
            scrollerFor().classList.add('is-dragging');
        }
        scrollerFor().scrollTop = drag.top - dy;
        event.preventDefault();
    };
    const onUp = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.id)
            return;
        scrollerFor().classList.remove('is-dragging');
        if (drag.moved && region.hasPointerCapture(event.pointerId))
            region.releasePointerCapture(event.pointerId);
        drag = null;
    };
    region.addEventListener('wheel', onWheel, { passive: false });
    region.addEventListener('pointerdown', onDown);
    region.addEventListener('pointermove', onMove);
    region.addEventListener('pointerup', onUp);
    region.addEventListener('pointercancel', onUp);
    return () => {
        region.removeEventListener('wheel', onWheel);
        region.removeEventListener('pointerdown', onDown);
        region.removeEventListener('pointermove', onMove);
        region.removeEventListener('pointerup', onUp);
        region.removeEventListener('pointercancel', onUp);
    };
}

function StrokeIcon({ size = 16, children }: {
    size?: number;
    children: ReactNode;
}) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const rail = [
    { box: '0 0 256 256', fill: true, d: 'M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z' },
    { box: '0 0 256 256', fill: true, d: 'M232,44H160a43.86,43.86,0,0,0-32,13.85A43.86,43.86,0,0,0,96,44H24A12,12,0,0,0,12,56V200a12,12,0,0,0,12,12H96a20,20,0,0,1,20,20,12,12,0,0,0,24,0,20,20,0,0,1,20-20h72a12,12,0,0,0,12-12V56A12,12,0,0,0,232,44ZM96,188H36V68H96a20,20,0,0,1,20,20V192.81A43.79,43.79,0,0,0,96,188Zm124,0H160a43.71,43.71,0,0,0-20,4.83V88a20,20,0,0,1,20-20h60Z' },
    { box: '0 0 256 256', fill: true, d: 'M200,164a36.07,36.07,0,0,0-33.94,24H72a28,28,0,0,1,0-56h96a44,44,0,0,0,0-88H72a12,12,0,0,0,0,24h96a20,20,0,0,1,0,40H72a52,52,0,0,0,0,104h94.06A36,36,0,1,0,200,164Zm0,48a12,12,0,1,1,12-12A12,12,0,0,1,200,212Z' },
] as const;

export function ResearchWorkspace({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLDivElement>(null);
    const [openedArticle, setOpenedArticle] = useState(researchLesson.sources[0]);
    const [teachT, setTeachT] = useState(0);
    const streamedTeach = streamBlocks(researchLesson.teachingBlocks, teachT);
    const lastTeach = streamedTeach.reduce((n, block, i) => block.visible ? i : n, -1);
    useEffect(() => {
        const el = host.current!;
        const list = el.querySelector<HTMLElement>('.research-list')!;
        const articlePane = el.querySelector<HTMLElement>('.research-article')!;
        const feed = el.querySelector<HTMLElement>('.research-feed')!;
        const sourcesPane = el.querySelector<HTMLElement>('.research-pane[data-side="sources"]')!;
        const teachPane = el.querySelector<HTMLElement>('.research-teach')!;
        const cursor = el.querySelector<HTMLElement>('.research-cursor')!;
        const graphTab = el.querySelector<HTMLElement>('[data-tab="graph"]')!;
        const docTab = el.querySelector<HTMLElement>('[data-present-doc]')!;
        const mapTab = el.querySelector<HTMLElement>('[data-present-map]')!;
        const docPane = el.querySelector<HTMLElement>('.research-doc')!;
        const studyTab = el.querySelector<HTMLElement>('[data-tab="study"]')!;
        const waitSteps = [...el.querySelectorAll<HTMLElement>('[data-wait-step]')];
        const searchPill = el.querySelector<HTMLElement>('[data-search-pill]')!;
        const cards = [...el.querySelectorAll<HTMLElement>('[data-source]')];
        const back = el.querySelector<HTMLElement>('.research-back')!;
        const searchCount = el.querySelector<HTMLElement>('[data-search-count]')!;
        const composerHint = el.querySelector<HTMLElement>('[data-composer-hint]')!;
        const graphCount = el.querySelector<HTMLElement>('[data-graph-count]')!;
        let frame = 0, last = -1, lastTeachT = -1, followOutput = false;
        const browse = { pane: 'list' as 'list' | 'article', present: 'map' as 'map' | 'document', source: String(researchLesson.sources[0].index), userPresent: false };
        const onGraph = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (legacyRaw(transition.current.progress) < researchTimes.graphHold - 1e-4)
                seekLegacy(researchTimes.graphHold);
        };
        const onStudy = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            browse.pane = 'list';
            applyPane();
            if (legacyRaw(transition.current.progress) >= researchTimes.graphIn - 1e-4)
                seekLegacy(8.96);
        };
        const storyTab = () => legacyRaw(transition.current.progress) >= researchTimes.graphIn ? 'graph' : 'study';
        const applyPane = () => {
            const raw = legacyRaw(transition.current.progress);
            const tab = storyTab();
            if (el.dataset.tab !== tab)
                el.dataset.tab = tab;
            if (raw >= researchTimes.docIn && raw < researchTimes.mapIn) {
                browse.present = 'document';
                browse.userPresent = false;
            }
            else if (raw >= researchTimes.mapIn) {
                browse.present = 'map';
                browse.userPresent = false;
            }
            else if (!browse.userPresent)
                browse.present = 'map';
            const pane = tab === 'graph' ? 'graph' : browse.pane;
            if (el.dataset.pane !== pane)
                el.dataset.pane = pane;
            if (el.dataset.present !== browse.present)
                el.dataset.present = browse.present;
            mapTab.setAttribute('aria-pressed', String(browse.present !== 'document'));
            docTab.setAttribute('aria-pressed', String(browse.present === 'document'));
            studyTab.dataset.active = String(tab === 'study');
            graphTab.dataset.active = String(tab === 'graph');
            cards.forEach(card => { card.dataset.active = String(browse.pane === 'article' && card.dataset.source === browse.source); });
        };
        const openArticle = (index: string) => {
            const source = researchLesson.sources.find(item => String(item.index) === index);
            if (!source)
                return;
            browse.pane = 'article';
            browse.source = String(source.index);
            applyPane();
            setOpenedArticle(source);
        };
        const onCard = (event: Event) => {
            const card = (event.currentTarget as HTMLElement);
            event.preventDefault();
            event.stopPropagation();
            openArticle(card.dataset.source ?? '');
        };
        const onCardKey = (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openArticle((event.currentTarget as HTMLElement).dataset.source ?? '');
            }
        };
        const onBack = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            browse.pane = 'list';
            applyPane();
        };
        const onDocument = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            browse.present = 'document';
            browse.userPresent = true;
            applyPane();
        };
        const onMap = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            browse.present = 'map';
            browse.userPresent = true;
            applyPane();
        };
        graphTab.style.pointerEvents = 'auto';
        studyTab.style.pointerEvents = 'auto';
        docTab.style.pointerEvents = 'auto';
        mapTab.style.pointerEvents = 'auto';
        back.style.pointerEvents = 'auto';
        graphTab.addEventListener('click', onGraph);
        studyTab.addEventListener('click', onStudy);
        back.addEventListener('click', onBack);
        docTab.addEventListener('click', onDocument);
        mapTab.addEventListener('click', onMap);
        cards.forEach(card => {
            card.style.pointerEvents = 'auto';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.addEventListener('click', onCard);
            card.addEventListener('keydown', onCardKey);
        });
        const releaseScroll = [
            isolateScroll(sourcesPane, () => el.dataset.present === 'document' ? docPane : el.dataset.pane === 'article' ? articlePane : list),
            isolateScroll(teachPane, () => feed),
        ];
        const send = el.querySelector<HTMLButtonElement>('.research-send');
        const restAnchor = { x: 0, y: 0 };
        const update = () => {
            const raw = legacyRaw(transition.current.progress);
            if (raw < 7 || raw > 31) {
                if (el.style.visibility !== 'hidden') {
                    el.style.visibility = 'hidden';
                    el.style.opacity = '0';
                    cursor.style.visibility = 'hidden';
                }
                frame = requestAnimationFrame(update);
                return;
            }
            const tour = cursorWindow(raw);
            const box = tour ? el.getBoundingClientRect() : null;
            const demo = researchAt(raw, {
                graphTab: tour === 'graph' && box ? centerOf(graphTab, box) : restAnchor,
                docTab: tour === 'doc' && box ? centerOf(docTab, box) : restAnchor,
                mapTab: tour === 'map' && box ? centerOf(mapTab, box) : restAnchor,
            });
            if (tour && box) {
                const pos = clampPoint(demo, box.width, box.height);
                cursor.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
                cursor.style.opacity = String(demo.cursorAlpha);
                cursor.style.visibility = demo.cursorAlpha < .02 ? 'hidden' : 'visible';
                cursor.style.setProperty('--guide-press', String(1 - demo.click * .14));
            }
            else if (cursor.style.visibility !== 'hidden') {
                cursor.style.visibility = 'hidden';
                cursor.style.opacity = '0';
            }
            if (raw !== last) {
                last = raw;
                if (Math.abs(demo.stream - lastTeachT) > 1e-4) {
                    lastTeachT = demo.stream;
                    setTeachT(demo.stream);
                }
                const streaming = demo.stream > .01 && demo.stream < 1;
                if (streaming)
                    followOutput = true;
                if (followOutput) {
                    feed.scrollTop = feed.scrollHeight;
                    const max = feed.scrollHeight - feed.clientHeight;
                    if (!streaming && (max <= 0 || feed.scrollTop >= max - 1))
                        followOutput = false;
                }
                el.style.opacity = String(demo.alpha);
                el.style.visibility = demo.alpha < .01 ? 'hidden' : 'visible';
                el.style.transform = `scale(${.92 + demo.open * .08})`;
                el.dataset.tab = demo.tab;
                el.dataset.expanding = String(raw > researchTimes.graphHold && raw < 26.9);
                applyPane();
                if (graphCount)
                    graphCount.textContent = raw >= 26.9 ? '15 个节点' : '1 个节点';
                el.dataset.filled = String(demo.filled > .6);
                el.dataset.waiting = String(demo.waitVisible);
                el.dataset.streaming = String(demo.stream > .02 && demo.stream < .995);
                el.dataset.generating = String(demo.generating);
                if (send) {
                    send.dataset.state = demo.generating ? 'stop' : 'send';
                    send.setAttribute('aria-label', demo.generating ? '停止生成' : '发送');
                }
                waitSteps.forEach((node, i) => {
                    const on = demo.waitVisible && demo.waitIndex >= 0 && i <= demo.waitIndex;
                    node.hidden = !on;
                    node.classList.toggle('is-busy', on && i === demo.waitIndex);
                    node.classList.toggle('is-done', on && i < demo.waitIndex);
                });
                if (searchPill.textContent !== demo.searchLabel)
                    searchPill.textContent = demo.searchLabel;
                searchCount.textContent = demo.filled > .6 ? String(researchLesson.sources.length) : '—';
                composerHint.textContent = demo.filled > .6 ? `全部资料 ${researchLesson.sources.length} 篇` : '材料尚未就绪 0 篇';
                studyTab.dataset.active = String(demo.tab === 'study');
                graphTab.dataset.active = String(demo.tab === 'graph');
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => {
            cancelAnimationFrame(frame);
            graphTab.removeEventListener('click', onGraph);
            studyTab.removeEventListener('click', onStudy);
            back.removeEventListener('click', onBack);
            docTab.removeEventListener('click', onDocument);
            mapTab.removeEventListener('click', onMap);
            cards.forEach(card => {
                card.removeEventListener('click', onCard);
                card.removeEventListener('keydown', onCardKey);
            });
            releaseScroll.forEach(stop => stop());
        };
    }, [transition]);
    const article = openedArticle;
    return <div className="route-research" ref={host} data-pane="list" data-tab="study" aria-label="概念研究页：左侧资料，右侧连续讲解" aria-hidden="true">
  <div className="research-frame">
   <aside className="research-rail" aria-hidden="true">
    {rail.map(icon => <svg key={icon.d} viewBox={icon.box} fill="currentColor" width="16" height="16"><path d={icon.d}/></svg>)}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" width="16" height="16"><circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="5" r="2.3"/><circle cx="17" cy="18" r="2.3"/><circle cx="7" cy="18" r="2.3"/><path d="m8.2 6.6 7.5-1.2M7.4 9l8.2 6.8M9.4 18h5.2M18 7.4v8.2"/></svg>
   </aside>
   <header className="research-top">
    <div className="research-top-left">
     <i className="research-portal-orb" aria-hidden="true"/>
     <div className="research-title-stack"><small>刘看山陪你学</small><h1>{researchLesson.title}</h1></div>
    </div>
    <div className="research-tabs">
     <button type="button" data-tab="study" data-active="true"><StrokeIcon size={15}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></StrokeIcon>研究</button>
     <button type="button" data-tab="graph"><StrokeIcon size={16}><rect x="3" y="9" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M8 11.5h4V5.5h4M12 11.5v7h4"/></StrokeIcon>知识脉络</button>
    </div>
    <div className="research-top-right">
     <span className="research-ghost"><StrokeIcon size={14}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></StrokeIcon>找人请教</span>
     <span className="research-ghost"><StrokeIcon size={14}><path d="M12 5v14M5 12h14"/></StrokeIcon>新对话</span>
    </div>
   </header>
   <div className="research-body">
    <section className="research-pane" data-side="sources">
     <div className="research-heading"><StrokeIcon size={17}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></StrokeIcon><h2>{researchLesson.title}</h2></div>
     <div className="research-tools"><span>相关内容 <i data-search-count>—</i></span><span>最相关</span></div>
     <div className="research-loading">
      <span className="research-pill is-busy"><i className="research-spinner"/><b data-search-pill>正在寻找这个概念的相关内容</b></span>
      <p>按当前概念需要分批搜索，收齐后挑选互补资料</p>
      {researchLesson.sources.map(source => <div className="research-skel" key={source.id}><i/><i/><i/></div>)}
     </div>
     <div className="research-list" data-visible-pane="list">
      <div className="research-stack">
       {researchLesson.sources.map(source => <article className="research-card" data-source={source.index} key={source.id} role="listitem">
        <div className="research-card-main">
         <div className="research-card-title"><span>{source.index}</span><h3>{source.title}</h3></div>
         <MarkdownMath className="research-card-excerpt" source={source.excerpt} sourceExcerpt passive/>
        </div>
        <footer className="research-meta"><CardAvatar src={source.avatar} name={source.author}/><span className="research-author-name">{source.author}</span><span className="research-meta-dot">·</span><span className="research-topic">{source.topic}</span><span className="research-likes"><StrokeIcon size={13}><path d="M8 10V21H4V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1-6A2 2 0 0 0 19 9h-6l1-5c-1-2-3-2-3 0l-3 6"/></StrokeIcon>{source.likes.toLocaleString()}</span><em>作者足迹</em></footer>
       </article>)}
      </div>
     </div>
     <div className="research-article" data-visible-pane="article">
      <div className="research-article-scroll">
       <button className="research-back" type="button"><StrokeIcon size={15}><path d="m14 5-7 7 7 7"/></StrokeIcon>返回检索结果</button>
       <div className="research-detail-content">
        <p className="research-eyebrow">知乎 · {article.topic}</p>
        <h2>{article.title}</h2>
        <div className="research-author">
         <Avatar author src={article.avatar} size={38}/>
         <div className="research-author-info">
          <strong>{article.author}</strong>
          <span className="research-author-desc">文章内容总结</span>
          <button className="research-author-action" type="button" tabIndex={-1}><StrokeIcon size={14}><rect x="3" y="9" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M8 11.5h4V5.5h4M12 11.5v7h4"/></StrokeIcon>查看作者与学习足迹</button>
         </div>
         <span className="research-likes"><StrokeIcon size={15}><path d="M8 10V21H4V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1-6A2 2 0 0 0 19 9h-6l1-5c-1-2-3-2-3 0l-3 6"/></StrokeIcon>{article.likes.toLocaleString()} 赞同</span>
        </div>
        <div className="research-article-body">
         <MarkdownMath className="learn-markdown" source={article.markdown} passive/>
        </div>
        <a className="research-original" href={article.url} target="_blank" rel="noopener noreferrer" tabIndex={-1}>去知乎阅读原文<StrokeIcon size={14}><path d="M14 4h6v6M20 4 10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></StrokeIcon></a>
        <p className="research-material-note"><StrokeIcon size={14}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></StrokeIcon>这份资料已作为本次提问材料</p>
       </div>
      </div>
      <i className="research-grip" data-grip="article" aria-hidden="true"/>
     </div>
     <div className="research-graph" data-visible-pane="graph">
      <header className="research-graph-head">
       <div>
        <div className="research-graph-tabs" role="group" aria-label="知识脉络呈现方式">
         <IconButton icon="graph" label="画布模式" active data-present-map/>
         <IconButton icon="document" label="文档模式" data-present-doc/>
        </div>
        <strong>知识脉络</strong>
        <span data-graph-count>1 个节点</span>
       </div>
       <div>
        <IconButton icon="undo" label="撤销" disabled/>
        <IconButton icon="redo" label="重做" disabled/>
        <IconButton icon="graph" label="添加想法卡片"/>
        <IconButton icon="search" label="搜索画布"/>
        <IconButton icon="plus" label="放大画布"/>
        <IconButton icon="minus" label="缩小画布"/>
        <IconButton icon="fit" label="适应全部节点"/>
       </div>
      </header>
      <div className="research-graph-stage" data-graph-slot/>
      <div className="research-doc">
       {knowledgeDoc.rows.map(({ node, depth }) => <div className="research-doc-branch" data-depth={depth} key={node.id} style={{ marginInlineStart: Math.min(depth, 6) * 23 }}>
        <section className="research-doc-node" data-kind={node.kind} data-node-id={node.id}>
         {(knowledgeDoc.children.get(node.id)?.length ?? 0) > 0 && <button className="research-doc-collapse" type="button" tabIndex={-1} aria-label={`收起文档章节 ${node.title}`}><Glyph name="chevron" size={14}/></button>}
         <div className="research-doc-content">
          <button className="research-doc-edit" type="button" tabIndex={-1}><Glyph name="edit" size={14}/>编辑正文</button>
          <h3>{node.title}</h3>
          {node.text && <div className="research-doc-read"><MarkdownMath className="learn-markdown" source={node.text} sourceExcerpt={false} passive/></div>}
         </div>
        </section>
       </div>)}
      </div>
      <div className="research-graph-bottom"><span><i/>概念<span className="research-legend-article"/><span>文章</span><span className="research-legend-answer"/><span>回答</span></span><span>Shift 多选 · Tab 添加 · 双击编辑</span><button type="button" tabIndex={-1}>16%</button></div>
     </div>
    </section>
    <section className="research-pane research-teach" data-side="teach">
     <span className="research-chip">{researchLesson.title}</span>
     <div className="research-host"><img src={kanshan} alt="" width="28" height="28"/><span>刘看山 <small>陪你一起理解</small></span></div>
     <div className="research-feed">
      <div className="research-wait">
       {waitPhases.map((phase, i) => <span className="research-pill" data-wait-step={i} hidden key={phase.title}><i className="research-spinner"/><svg className="research-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg><b>{phase.title}</b></span>)}
      </div>
      <div className="research-stream">
       <i className="research-grip" data-grip="teach" aria-hidden="true"/>
       {streamedTeach.map((block, i) => block.kind === 'cite'
         ? <div className="research-cite" data-block={i} data-caret={String(i === lastTeach && teachT > .01 && teachT < .995)} hidden={!block.visible} key={i}><span>资料来源</span><SourceTag number={block.cite ?? 1}/><button className="lp-locate-node" type="button" tabIndex={-1}><Glyph name="graph" size={12}/>在脉络中查看</button></div>
         : block.kind === 'md'
             ? <div className="research-md" data-block={i} data-caret={String(i === lastTeach && teachT > .01 && teachT < .995)} hidden={!block.visible} key={i}><MarkdownMath className="learn-markdown" source={block.shown} streaming passive/></div>
         : block.kind === 'h3'
             ? <h3 data-block={i} data-caret={String(i === lastTeach && teachT > .01 && teachT < .995)} hidden={!block.visible} key={i}><span data-stream-text>{block.shown}</span></h3>
             : <p data-block={i} data-caret={String(i === lastTeach && teachT > .01 && teachT < .995)} hidden={!block.visible} key={i}><span data-stream-text>{block.shown}</span></p>)}
      </div>
     </div>
     <div className="research-composer"><small data-composer-hint>材料尚未就绪 0 篇</small><span>继续提问，探索这个概念…</span><button className="research-send send-control" type="button" tabIndex={-1} aria-label="发送"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path className="research-send-arrow" d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect className="research-send-stop" x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></button></div>
    </section>
   </div>
  </div>
  <div className="research-cursor" aria-hidden="true"><LearningGuideCursor /></div>
 </div>;
}
