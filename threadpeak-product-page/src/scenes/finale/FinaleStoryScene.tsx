import { useEffect,useRef,useState,type RefObject } from 'react';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import "../../styles/finale.css";
import { HomeLandscape } from "../../components/brand/HomeLandscape.tsx";
import { COMMERCE_START,FINALE_START } from "./finale-motion.ts";
import { FavoritesIllustration,GoalIllustration,PaperIllustration } from "./FinaleIllustrations.tsx";
import { GoalSearchIllustration,goalExamples } from "./GoalSearchIllustration.tsx";
export function FinaleStoryScene({ transition }: {
    transition: RefObject<ScrollTransition>;
}) {
    const host = useRef<HTMLElement>(null), [page, setPage] = useState(0), [collection, setCollection] = useState(0), [focused, setFocused] = useState(false), [example, setExample] = useState(0), [searchActive, setSearchActive] = useState(false);
    const searchVisible = useRef(false);
    useEffect(() => {
        const el = host.current!, stage = el.querySelector<HTMLElement>('.finale-stage')!;
        let frame = 0, w = 0, h = 0;
        const size = new ResizeObserver(() => { w = el.clientWidth; h = el.clientHeight; });
        size.observe(el);
        const tick = () => {
            const p = legacyRaw(transition.current.target);
            const active = p >= FINALE_START && p < COMMERCE_START;
            const visible = active;
            if (visible !== searchVisible.current) {
                searchVisible.current = visible;
                setSearchActive(visible);
            }
            el.dataset.active = String(active);
            el.inert = !active;
            el.style.visibility = active ? 'visible' : 'hidden';
            el.setAttribute('aria-hidden', String(!active));
            el.style.opacity = active ? '1' : '0';
            el.style.setProperty('--finale-enter', active ? '1' : '0');
            if (active && w && h) {
                const narrow = w < 760, W = narrow ? 700 : 1400, H = narrow ? 1540 : 820;
                const scale = Math.min((w - 24) / W, (h - 24) / H);
                stage.style.width = `${W}px`;
                stage.style.height = `${H}px`;
                stage.style.transform = `translate3d(${(w - W * scale) / 2}px,${(h - H * scale) / 2}px,0) scale(${scale})`;
                el.dataset.narrow = String(narrow);
                for (const name of ['paper', 'favorites', 'goal', 'search', 'heading'] as const) {
                    const n = el.querySelector<HTMLElement>(`[data-final-part=${name}]`)!;
                    n.style.opacity = '1';
                    n.style.transform = 'translateY(0)';
                    n.inert = false;
                }
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(frame); size.disconnect(); };
    }, [transition]);
    return <section className="finale-scene" ref={host} aria-label="上传 PDF、收藏夹、通向目标的路线，以及换一个目标也能开始" data-active="false" aria-hidden="true" inert><div className="finale-stage">
  <header className="finale-heading" data-final-part="heading"><HomeLandscape /><span className="finale-eyebrow">问山 · ThreadPeak</span><h2>知乎上的不同回答，<br />长成自己的学习路线。</h2><p>PDF、收藏夹、通向目标的部分，都可以接到同一段学习里。<br />换一个目标，也能从一句真正想做成的事开始。</p></header>
  <button className="finale-island finale-paper" data-final-part="paper" data-page={page} onClick={() => setPage(v => 1 - v)} aria-label="翻阅上传 PDF 如何进入学习"><PaperIllustration page={page}/><span className="finale-island-caption"><strong>上传 PDF，接着学</strong><span>论文、讲义和笔记进路线和画布，公式和出处一起保留，按当前目标拆开读。</span><small>{page === 0 ? '点击，翻到方法页' : '点击，回到封面'} <b>↗</b></small></span></button>
  <button className="finale-island finale-favorites" data-final-part="favorites" data-collection={collection} onClick={() => setCollection(v => 1 - v)} aria-label="切换知乎收藏夹学习演示"><FavoritesIllustration collection={collection}/><span className="finale-island-caption"><strong>针对收藏夹学习</strong><span>授权后选择知乎收藏夹，按这次目标筛选，旧回答进入路线、讲解和追问。</span><small>{collection === 0 ? '点击，换一本收藏' : '点击，回到学习收藏'} <b>↗</b></small></span></button>
  <button className="finale-island finale-goal" data-final-part="goal" aria-label="只显示通向目标的学习路线" aria-pressed={focused} onClick={() => setFocused(v => !v)}><GoalIllustration focused={focused}/><span className="finale-island-caption"><strong>只学通向目标的部分</strong><small>{focused ? '阶段示意 · 点击还原全貌' : '点击，看知识怎样收成一条学习路线'} <b>↗</b></small></span></button>
  <button className="finale-island finale-search" data-final-part="search" onClick={() => setExample(v => (v + 1) % goalExamples.length)} aria-label="换一个目标，演示问山不限定领域"><GoalSearchIllustration key={example} example={example} active={searchActive}/><span className="finale-island-caption"><strong>换一个目标也能开始</strong><span>理财、摄影、设计、历史、大模型，<br />先说想做成什么。</span><small>点击，试试另一个目标 <b>↗</b></small></span></button>
 </div></section>;
}
