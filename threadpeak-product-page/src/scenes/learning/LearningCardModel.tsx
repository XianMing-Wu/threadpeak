import 'katex/dist/katex.min.css';
import { useEffect,useId,useRef,useState,type ReactNode } from 'react';
import { GraphCard } from "../../components/learning/GraphCard.tsx";
import { LearningData } from "../../components/learning/data.tsx";
import type { GraphNode } from "../../components/learning/model.ts";
import { useScrollText,type TextStream } from "./useScrollText.ts";
import content from "../../data/learning-content.json";
import "../../styles/learning-product.generated.css";
import "../../styles/learning-card-fit.css";
import { CARD,featuredSources } from "./learning-motion.ts";
// Number visible sources in reading order; original evidence IDs stay intact.
const readingArticles = [...featuredSources.map(i => content.articles[i]), ...content.articles.filter((_, i) => !featuredSources.includes(i))];
type Kind = 'root' | 'article' | 'answer' | 'author' | 'custom';
const marks = { root: 'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z', article: 'M3 4c3-1 6 0 8 1v15c-2-1-5-2-8-1V4Zm10 1c2-1 5-2 8-1v15c3-1 6-0 8 1V5Z', answer: 'M12 4 20 12 12 20 4 12Z M11 0h2v2h-2z M11 22h2v2h-2z M0 11h2v2H0z M22 11h2v2h-2z', author: 'M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM3 21v-3a9 9 0 0 1 18 0v3h-2v-3a7 7 0 0 0-14 0v3H3Z', custom: 'M5 3h10l4 4v14H5V3Zm3 7v2h8v-2H8Zm0 5v2h6v-2H8Z' };
export function CardMark({ kind }: {
    kind: Kind;
}) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={marks[kind]}/></svg>; }
export { CardAvatar } from "../../components/learning/CardAvatar.tsx";
/** Product GraphCard is the surface. SVG only carries the one-shot birth/idle light. */
export function LearningCardModel({ kind, children }: {
    kind: Kind;
    children: ReactNode;
}) {
    const uid = useId().replaceAll(':', '');
    return <div className="learn-card-model" data-model={kind}>
  <div className="learn-card-face">
   {children}
   <svg className="learn-card-fx" viewBox={`0 0 ${CARD.w} ${CARD.h}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={`rim-${uid}`}><stop stopColor="#6db5b6"/><stop offset=".55" stopColor="#527fc8"/><stop offset="1" stopColor="#b2a2ca"/></linearGradient></defs>
    <g className="learn-glow"><rect className="glow-halo" x="2" y="2" width={CARD.w - 4} height={CARD.h - 4} rx="12" pathLength="100" stroke={`url(#rim-${uid})`}/><rect className="glow-color" x="2" y="2" width={CARD.w - 4} height={CARD.h - 4} rx="12" pathLength="100" stroke={`url(#rim-${uid})`}/><rect className="glow-core" x="2" y="2" width={CARD.w - 4} height={CARD.h - 4} rx="12" pathLength="100"/></g>
    <rect className="learn-idle-rim" x="2" y="2" width={CARD.w - 4} height={CARD.h - 4} rx="12" pathLength="100" stroke={`url(#rim-${uid})`}/>
   </svg>
  </div>
 </div>;
}
/** Actual product card DOM: kind, title, prose, sources, expand. */
export function LearningCardContent({ node, fullText, editing, onFinishEdit, stream }: {
    stream?: TextStream;
    node: GraphNode;
    fullText?: string;
    editing?: boolean;
    onFinishEdit?: (title: string) => void;
}) {
    const current = useScrollText(node.title, node.text, stream);
    const face = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false), [sourceId, setSourceId] = useState<string | null>(null);
    const source = content.articles.find(a => a.id === sourceId);
    const requestFocus = () => face.current?.dispatchEvent(new CustomEvent('learning-card-read', { bubbles: true }));
    const collapse = () => { setSourceId(null); setExpanded(false); };
    const toggle = () => { if (expanded)
        collapse();
    else {
        requestFocus();
        setExpanded(true);
    } };
    const openSource = (id: string) => { requestFocus(); setSourceId(id === node.id ? null : id); setExpanded(true); };
    useEffect(() => { if (current.streaming)
        collapse(); }, [current.streaming]);
    useEffect(() => { for (const body of face.current?.querySelectorAll('.lp-node-prose,.lp-author-content') ?? [])
        body.scrollTop = 0; }, [expanded, sourceId]);
    const displayed: GraphNode = source ? { id: source.id, type: 'article', title: source.title, text: source.markdown || source.text, sources: [source.id], parents: [] } : { ...node, author: node.author ? { ...node.author, matchReason: undefined } : undefined, title: expanded ? node.title : current.title, text: expanded ? (fullText ?? node.text) : current.text };
    return <div ref={face} className="learn-card-ink" data-streaming={!expanded && current.streaming} data-expanded={expanded} data-source-reading={!!source}>
  <div className="learn-product-ui learn-product-card">
  <LearningData value={{ articles: readingArticles.map(a => ({ ...a, summary: a.text, likes: a.likes ?? null, authorId: null, topic: content.provenance.conceptId, sourceKind: 'zhihu' as const })), concept: content.provenance.conceptId }}>
   {source && <button className="learn-source-back" onClick={e => { e.stopPropagation(); collapse(); }}>← 返回当前卡片</button>}
   <GraphCard key="markdown-stream" node={displayed} toolbar={false} expanded={expanded} onExpand={toggle} onOriginal={toggle} onSource={openSource} editing={editing} onFinishEdit={onFinishEdit}/>
  </LearningData>
 </div></div>;
}
