import { useEffect,useRef,useState,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import "../../styles/author-network.css";
import { CardAvatar } from "../../components/learning/CardAvatar.tsx";
import { lerp,part } from "../../core/motion.ts";
import { NETWORK_EXIT,spanProgress } from "../../core/timeline.ts";
import content,{ projectScenario } from "../learning/learning-story-content.ts";
import { LearningCardContent,LearningCardModel } from "../learning/LearningCardModel.tsx";
import { arrivingAuthors,authorFootprint,bridgeBox,footprintBoxes,footprintEntry,footprintInk,footprintPaths,footprintWire,networkProgress,networkVolumeProgress,projectedNetwork,stageFit } from "./author-network-motion.ts";
import { AuthorNetwork3D } from "./AuthorNetwork3D.tsx";
const featured = content.authorFollowup.paragraphs;
const trimTitle = (s: string) => s.replace(/\s*-\s*知乎$/, '');
function FootprintMark({ kind }: {
    kind: string;
}) {
    const paths: Record<string, string> = { source: 'M4 6Q10 3 16 7Q22 3 28 6V27Q22 24 16 28Q10 24 4 27ZM16 7V28M8 11l4 1M20 12l4-1M8 16l4 1M20 17l4-1', concept: 'M6 24 16 7 27 23ZM6 24 22 28 27 23M16 7 22 28', question: 'M5 6H27V22H16L10 27V22H5ZM10 12H22M10 16H18', card: 'M6 7V25H15M6 15H15M18 4H28V12H18ZM18 19H28V28H18Z' };
    return <svg viewBox="0 0 32 32" className={`footprint-mark mark-${kind}`} fill="none" aria-hidden="true"><path d={paths[kind]} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/>{kind === 'concept' && <g fill="currentColor" stroke="white">{[[6, 24], [16, 7], [27, 23], [22, 28]].map(([x, y]) => <circle cx={x} cy={y} r="2.8" key={x}/>)}</g>}</svg>;
}
function Paper({ id, w, h, label }: {
    id: string;
    w: number;
    h: number;
    label: string;
}) {
    return <svg className="footprint-paper" data-paper={id} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="group" aria-label={label}>
  <defs><linearGradient id={`foot-rim-${id}`}><stop stopColor="#70bcb0"/><stop offset=".58" stopColor="#5388d7"/><stop offset="1" stopColor="#adc5e0"/></linearGradient><linearGradient id={`foot-face-${id}`} x2=".6" y2="1"><stop stopColor={id === 'question' ? '#fdfbf7' : id === 'concept' ? '#f4faf7' : '#f9fbfe'}/><stop offset=".75" stopColor="#ffffff"/></linearGradient></defs>
  <g className="footprint-shell">
   <rect x="1" y="5" width={w - 2} height={h - 7} rx="12" className="foot-shadow"/>
   <rect x=".8" y=".8" width={w - 1.6} height={h - 1.6} rx="12" fill={`url(#foot-face-${id})`} stroke="#d1dee6"/>
   <path d={`M18 1 H${w - 18}`} stroke="#e7eff5"/>
   {id === 'source' && <path d={`M${w - 31} 1V18Q${w - 31} 23 ${w - 26} 23H${w - 1}`} fill="#eef4f8" stroke="#d9e5ed"/>}
   <g className="footprint-live-rim">{['halo', 'color', 'core'].map(c => <rect key={c} className={`foot-rim-${c}`} x="1" y="1" width={w - 2} height={h - 2} rx="12" fill="none" stroke={c === 'core' ? '#f7ffff' : `url(#foot-rim-${id})`} pathLength="100"/>)}</g>
  </g>
 </svg>;
}
export function AuthorNetworkStoryScene({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLElement>(null), [selected, setSelected] = useState(arrivingAuthors[0]);
    const active = useRef(selected);
    active.current = selected;
    const f = authorFootprint(selected), realQuestion = arrivingAuthors.includes(selected) ? projectScenario.footprintQuestion : f.group.questions[0]?.text, derived = f.group.cards.filter(c => c.kind !== 'article');
    const sourceTitle = trimTitle(f.evidence.title), colon = sourceTitle.search(/[:：]/), sourceLead = colon > 0 && colon < 15 ? sourceTitle.slice(0, colon) : '', sourceRest = sourceLead ? sourceTitle.slice(colon + 1) : sourceTitle;
    const likes = f.evidence.likes ?? featured.find(p => p.author.id === selected)?.author.likes ?? 0;
    const excerpt = selected === arrivingAuthors[0] ? '固定算力下不能先把模型做大。做大参数、少看词元，损失会钉在数据项上。' : selected === arrivingAuthors[1] ? '二十词元配一参数是等损失谷，不是你的数据证明。脏数据会把谷底挪走。' : selected === arrivingAuthors[2] ? '小模型多看词元可以是过训。损失在降，仍可能该停这次训练。' : (f.evidence.summary?.replace(/\s+/g, ' ').slice(0, 96) ?? '');
    const preview = selected === arrivingAuthors[0] ? '已验证：开销能写成参数乘词元；谷底约二十配一。模型判断不了：这一亿两千万、多头、上下文一千值不值得把剩下的显卡小时砸进去。' : selected === arrivingAuthors[1] ? '已记下：谷底会被脏数据挪走。模型能复述口诀。它看不出：实验记录别人三秒内看见的是取舍还是一串日志。' : selected === arrivingAuthors[2] ? '已留下缺口：损失掉了不等于可以继续砸算力。还缺一次真人现场——突增那天先看数据切片还是先砍学习率。' : derived[0]?.title ?? f.evidence.title;
    useEffect(() => {
        const el = host.current!, wrap = el.querySelector<HTMLElement>('.author-stage-wrap')!, stage = el.querySelector<SVGSVGElement>('.author-stage')!, bridges = [...el.querySelectorAll<HTMLElement>('.network-bridge')], travelers = [...el.querySelectorAll<HTMLElement>('.network-traveler')];
        const viewport = el.querySelector<HTMLElement>('.network-viewport')!;
        const papers = [...el.querySelectorAll<SVGSVGElement>('svg.footprint-paper')];
        const inks = [...el.querySelectorAll<HTMLElement>('.author-stage-wrap .footprint-ink')];
        const identityFace = el.querySelector<HTMLElement>('.footprint-identity-face');
        const wires = [...el.querySelectorAll<SVGGElement>('[data-footprint-wire]')];
        const identity = el.querySelector<SVGGElement>('.footprint-identity')!;
        const headers = [...el.querySelectorAll<SVGGElement>('[data-network-heading]')];
        const arrivals = bridges.map(n => n.querySelector<HTMLElement>('.lp-author-avatar'));
        let frame = 0, width = 0, height = 0, dirty = true, lastRaw = -1, lastSelected = '';
        const avatarLocal: Array<{
            x: number;
            y: number;
            w: number;
        } | undefined> = [];
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const resize = new ResizeObserver(() => { width = el.clientWidth; height = el.clientHeight; avatarLocal.length = 0; dirty = true; });
        resize.observe(el);
        const reflow = () => { dirty = true; };
        reduced.addEventListener('change', reflow);
        function opacity(n: SVGElement | HTMLElement, v: number) {
            const value = String(Math.max(0, Math.min(1, v)));
            n.style.opacity = value;
            if (n instanceof SVGElement)
                n.setAttribute('opacity', value);
        }
        function update() {
            const raw = legacyRaw(transition.current.progress), p = spanProgress(raw, 29.15, 40.4), visible = raw >= 29.2 && raw < NETWORK_EXIT;
            el.dataset.active = String(visible);
            el.style.visibility = visible ? 'visible' : 'hidden';
            el.style.pointerEvents = visible ? 'auto' : 'none';
            if (visible && !document.hidden) {
                const box = el.getBoundingClientRect();
                width = box.width || el.clientWidth || width;
                height = box.height || el.clientHeight || height;
                if (width > 8)
                    dirty = dirty || lastRaw < 0;
            }
            if (visible && !document.hidden && width > 8) {
                if (dirty || lastRaw !== raw || lastSelected !== active.current) {
                    if (lastSelected && lastSelected !== active.current && p > .88 && !reduced.matches) {
                        for (const ink of el.querySelectorAll('.footprint-ink'))
                            ink.animate([{ opacity: .35, translate: '0 3px' }, { opacity: 1, translate: '0 0' }], { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
                    }
                    dirty = false;
                    lastRaw = raw;
                    lastSelected = active.current;
                    el.inert = raw >= 40.4;
                    el.setAttribute('aria-hidden', 'false');
                    el.dataset.networkProgress = p.toFixed(5);
                    el.dataset.selectedAuthor = active.current;
                    el.style.backgroundColor = `rgb(255 255 255 / ${part(p, 0, .14)})`;
                    if (p < .30 && active.current !== arrivingAuthors[0])
                        setSelected(arrivingAuthors[0]);
                    const fit = stageFit(width, height);
                    wrap.style.left = `${fit.x}px`;
                    wrap.style.top = `${fit.y}px`;
                    wrap.style.width = `${fit.W}px`;
                    wrap.style.height = `${fit.H}px`;
                    wrap.style.transform = `scale(${fit.scale})`;
                    stage.setAttribute('viewBox', `0 0 ${fit.W} ${fit.H}`);
                    stage.setAttribute('width', String(fit.W));
                    stage.setAttribute('height', String(fit.H));
                    stage.style.width = `${fit.W}px`;
                    stage.style.height = `${fit.H}px`;
                    stage.style.left = '0';
                    stage.style.top = '0';
                    stage.dataset.narrow = String(fit.narrow);
                    const nodes = projectedNetwork(p, fit.narrow);
                    const area = fit.narrow ? { x: 20, y: 915, w: 660, h: 470 } : { x: 744, y: 145, w: 636, h: 600 };
                    viewport.style.left = `${fit.x + area.x * fit.scale}px`;
                    viewport.style.top = `${fit.y + area.y * fit.scale}px`;
                    viewport.style.width = `${area.w * fit.scale}px`;
                    viewport.style.height = `${area.h * fit.scale}px`;
                    viewport.style.setProperty('--stage-scale', String(fit.scale));
                    const volumeOn = networkVolumeProgress(p) > .525;
                    viewport.style.opacity = volumeOn ? '1' : '0';
                    viewport.style.pointerEvents = volumeOn ? 'auto' : 'none';
                    viewport.style.visibility = 'visible';
                    bridges.forEach((n, i) => {
                        const b = bridgeBox(i, p, width, height, el.getBoundingClientRect());
                        n.style.transform = `translate3d(${b.x}px,${b.y}px,0) scale(${b.w / 520})`;
                        opacity(n, 1 - part(p, .275, .35));
                        n.inert = true;
                        if (arrivals[i])
                            arrivals[i]!.style.opacity = String(1 - part(p, .237, .253));
                        const inkEl = n.querySelector<HTMLElement>('.learn-card-ink');
                        if (inkEl)
                            inkEl.style.opacity = String(1 - part(p, .244, .295));
                        // Measure the actual avatar inside the unchanged product card before peeling it away.
                        if (!avatarLocal[i]) {
                            const avatar = arrivals[i]?.getBoundingClientRect(), root = el.getBoundingClientRect(), scale = b.w / 520;
                            avatarLocal[i] = avatar ? { x: (avatar.x + avatar.width / 2 - root.x - b.x) / scale, y: (avatar.y + avatar.height / 2 - root.y - b.y) / scale, w: avatar.width / scale } : { x: 40, y: 92, w: 31 };
                        }
                        const av = avatarLocal[i]!;
                        const source = { x: b.x + av.x * b.w / 520, y: b.y + av.y * b.w / 520, size: av.w * b.w / 520 };
                        const dest = nodes.find(v => v.author?.id === arrivingAuthors[i]);
                        const target = i === 0 || !dest ? { x: fit.x + 275 * fit.scale, y: fit.y + 416 * fit.scale, size: 58 * fit.scale } : { x: fit.x + dest.x * fit.scale, y: fit.y + dest.y * fit.scale, size: 34 * fit.scale };
                        const t = part(p, .25, .37 + i * .018), size = lerp(source.size, target.size, t), x = lerp(source.x, target.x, t), y = lerp(source.y, target.y, t);
                        const v = part(p, .237, .253) * (1 - part(p, i === 0 ? .37 : .85, i === 0 ? .397 : .87));
                        travelers[i].style.width = `${size}px`;
                        travelers[i].style.height = `${size}px`;
                        travelers[i].style.transform = `translate3d(${x - size / 2}px,${y - size / 2}px,0)`;
                        opacity(travelers[i], v);
                    });
                    opacity(identity, part(p, .37, .401));
                    if (identityFace)
                        opacity(identityFace, part(p, .37, .401));
                    headers.forEach((n, i) => { opacity(n, part(p, .27, .34)); n.setAttribute('transform', `translate(${i === 0 ? 40 : fit.narrow ? 40 : 778} ${i === 0 ? 65 : fit.narrow ? 837 : 65})`); });
                    papers.forEach((n, i) => { const b = Object.values(footprintBoxes)[i]; if (!b) return; const v = footprintEntry(p, i), ink = footprintInk(p, i); n.setAttribute('x', String(b.x)); n.setAttribute('y', String(b.y)); opacity(n, Math.min(1, v * 5)); n.style.setProperty('--foot-x', String(lerp(.02, 1, part(v, 0, .8)))); n.style.setProperty('--foot-y', String(lerp(.07, 1, part(v, .12, 1)))); n.style.setProperty('--foot-ink', String(ink)); n.style.setProperty('--foot-rise', `${(1 - ink) * 7}px`); n.style.setProperty('--foot-glow', String(part(v, .08, .22) * (1 - part(v, .8, 1)))); n.style.setProperty('--foot-offset', String(-v * 112)); n.dataset.settled = String(v > .99); const face = inks[i]; if (face) { face.style.left = `${b.x}px`; face.style.top = `${b.y}px`; face.style.width = `${b.w}px`; face.style.height = `${b.h}px`; face.style.setProperty('--foot-ink', String(ink)); face.style.setProperty('--foot-rise', `${(1 - ink) * 7}px`); } });
                    wires.forEach((n, i) => { const v = footprintWire(p, i), light = part(v, 0, .15) * (1 - part(v, .8, 1)); opacity(n, v > 0 ? 1 : 0); n.style.setProperty('--foot-wire', String(1 - v)); n.style.setProperty('--foot-light', String(reduced.matches ? 0 : light)); n.style.setProperty('--foot-travel', String(-v * 120)); n.dataset.settled = String(v > .99); });
                    const footnote = el.querySelector<SVGGElement>('.network-footnote');
                    if (footnote) {
                        footnote.setAttribute('transform', `translate(${fit.narrow ? 40 : 778} ${fit.narrow ? 1418 : 786})`);
                        opacity(footnote, part(p, .96, .972));
                    }
                    const hint = el.querySelector<SVGGElement>('.footprint-note');
                    if (hint)
                        opacity(hint, part(p, .83, .84));
                }
            }
            else if (!visible) {
                el.inert = true;
                el.setAttribute('aria-hidden', 'true');
                lastRaw = -1;
                for (const t of travelers) {
                    t.style.opacity = '0';
                    t.style.visibility = 'hidden';
                }
                for (const n of el.querySelectorAll<HTMLElement>('.space-author')) {
                    n.style.visibility = 'hidden';
                    n.style.opacity = '0';
                }
            }
            frame = requestAnimationFrame(update);
        }
        frame = requestAnimationFrame(update);
        return () => { cancelAnimationFrame(frame); resize.disconnect(); reduced.removeEventListener('change', reflow); };
    }, [transition]);
    return <section ref={host} className="author-network-scene" data-active="false" aria-label="博主网络与学习足迹展示" aria-hidden="true" inert>
  <div className="author-stage-wrap">
  <svg className="author-stage" viewBox="0 0 1400 820">
   <g data-network-heading="footprint"><text className="network-eyebrow">学习足迹</text><text className="network-title" y="58">记住问题，也记住知乎内容的来处。</text></g>
   <g className="footprint-wires" fill="none">{footprintPaths.map((d, i) => <g data-footprint-wire={i} key={d}><path d={d} pathLength="1" className="footprint-wire-base"/>{["halo", "color", "core"].map(c => <path key={c} d={d} pathLength="100" className={`footprint-wire-light wire-${c}`}/>)}<circle cx={[192, 528, 201, 535][i]} cy={[330, 298, 526, 526][i]} r="2.5" fill="white" stroke="#9eb6c8"/></g>)}</g>
   <g className="footprint-identity" aria-label={`我与 ${f.author.name} 的公开内容相关的学习足迹`}>
    <rect x="233" y="363" width="240" height="106" rx="18" fill="#fff" stroke="#dce6ec"/>
    <text x="323" y="412" className="footprint-name">{f.author.name.length > 13 ? f.author.name.slice(0, 12) + '…' : f.author.name}</text><text x="323" y="438" className="footprint-meta">与这个卡点相关的博主</text>
   </g>
   <Paper id="source" {...footprintBoxes.source} label="关联的知乎文章"/>
   <Paper id="concept" {...footprintBoxes.concept} label="当前项目的学习任务"/>
   <Paper id="question" {...footprintBoxes.question} label={realQuestion ? '当时的追问' : '学习起点'}/>
   <Paper id="card" {...footprintBoxes.card} label="关联的知识卡片"/>
   <g className="footprint-note" transform="translate(40 758)"><text>学到了哪一步、试过什么、谁的内容帮过你，</text><text y="26">逐步留下来，让下一次学习与请教有据可循。</text></g>
   <g data-network-heading="network"><text className="network-eyebrow">知乎博主网络</text><text className="network-title" y="58">循着公开内容，寻找请教线索。</text></g>
   <g className="network-footnote"><text>从问题、知乎文章和使用反馈出发，回看经验并寻找新线索。</text><text y="24" className="network-provenance">点选博主，回看与你有关的足迹 · 拖动探索关系</text></g>
  </svg>
   <div className="footprint-identity-face"><CardAvatar name={f.author.name} src={f.evidence.avatar ?? undefined}/></div>
   <div className="footprint-ink" data-paper="source"><div className="footprint-kicker"><FootprintMark kind="source"/> 来源文章</div><h3>{sourceLead && <span className="footprint-title-topic">{sourceLead}</span>}{sourceRest}</h3><p className="footprint-source-meta">{f.author.name} · {likes.toLocaleString('zh-CN')} 赞同</p><p className="footprint-source-excerpt">{excerpt}</p></div>
   <div className="footprint-ink" data-paper="concept"><div className="footprint-kicker"><FootprintMark kind="concept"/> 我的目标</div><h3>{arrivingAuthors.includes(selected) ? '从零训出一个能验收的小模型。当前停在规模：会定计算最优，还没选定注意力实现。' : f.group.title.split('：').slice(-1)}</h3></div>
   <div className="footprint-ink" data-paper="question"><div className="footprint-kicker"><FootprintMark kind="question"/>{realQuestion ? '当时的追问' : '学习起点'}</div><p className="footprint-question-copy">{realQuestion ?? `围绕「${f.group.title.split('：')[0]}」阅读与理解。`}</p></div>
   <div className="footprint-ink" data-paper="card"><div className="footprint-kicker"><FootprintMark kind="card"/> {realQuestion ? '留下的线索' : '理解卡片'}</div><p className="footprint-card-copy">{preview}</p></div>
  </div>
  <div className="network-viewport"><AuthorNetwork3D transition={transition} selected={selected} onSelect={setSelected}/></div>
  {featured.map((a, i) => <div className="network-bridge learn-author" key={a.id} data-bridge={i}><LearningCardModel kind="author"><LearningCardContent node={{ ...a, type: 'author', origin: 'author', author: { ...a.author, sourceKind: 'zhihu' }, text: a.markdown }} fullText={a.markdown}/></LearningCardModel></div>)}
  {featured.map(a => <div className="network-traveler" key={a.id} aria-hidden="true"><CardAvatar name={a.author.name} src={a.author.avatar}/></div>)}
 </section>;
}
