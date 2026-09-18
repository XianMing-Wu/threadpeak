import { useLayoutEffect,useRef } from 'react';
import { MarkdownMath } from "../../shared/reading/MarkdownMath.tsx";
import { KnowledgeMark } from "../brand/KnowledgeMark.tsx";
import { Avatar,CountBadge,Glyph,SourceTag } from "./atoms.tsx";
import { useLearningData } from "./data.tsx";
import type { GraphNode } from "./model.ts";
import { NodeToolbar,type CardActions } from "./NodeToolbar.tsx";
import { sourceLink } from "./source-link.ts";
// Matches the reference edit(): edit the title in place; blur/Enter/Escape commit.
function InlineTitle({ title, onFinish }: {
    title: string;
    onFinish: (title: string) => void;
}) {
    const ref = useRef<HTMLSpanElement>(null), done = useRef(false);
    useLayoutEffect(() => { const el = ref.current; if (!el)
        return; el.textContent = title; el.focus({ preventScroll: true }); const range = document.createRange(); range.selectNodeContents(el); range.collapse(false); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); }, []);
    const finish = () => { if (done.current)
        return; done.current = true; onFinish(ref.current?.innerText.trim() ?? title); };
    return <h3 className="lp-inline-title"><span ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label="编辑卡片标题" onPointerDown={e => e.stopPropagation()} onBlur={finish} onKeyDown={e => { e.stopPropagation(); if ((e.key === 'Enter' || e.key === 'Escape') && !e.nativeEvent.isComposing) {
        e.preventDefault();
        finish();
    } }}/></h3>;
}
export function GraphCard({ node, selected = false, expanded = false, onExpand, onOriginal, onSource, editing, onFinishEdit, toolbar = true, ...actions }: {
    node: GraphNode;
    selected?: boolean;
    expanded?: boolean;
    onExpand?: () => void;
    onOriginal?: () => void;
    onSource?: (id: string) => void;
} & CardActions) {
    const { articles, concept: CONCEPT, example } = useLearningData();
    const original = sourceLink(node.author?.url);
    const article = articles.find(a => a.id === node.id);
    return <div className={`lp-graph-card ${selected ? 'is-selected' : ''}`} data-type={node.type} data-custom-color={node.color ? true : undefined} style={{ background: node.color ?? 'var(--surface-1)', borderWidth: node.stroke ?? 1 }}>
  {node.type !== 'custom' && <div className="lp-node-kind"><KnowledgeMark kind={node.type} size={17}/>{node.type === 'root' ? '学习概念' : node.type === 'article' ? (example ? (articles.find(a => a.id === node.id)?.sourceKind === 'web' ? '论文阅读锚点' : '知乎文章') : articles.find(a => a.id === node.id)?.sourceKind === 'upload' ? '上传资料' : articles.find(a => a.id === node.id)?.sourceKind === 'collection' ? '知乎收藏' : articles.find(a => a.id === node.id)?.sourceKind === 'web' ? '全网资料' : '知乎文章') : node.type === 'author' ? '新博主解读' : example ? '示例解读' : 'AI 回答'}{node.edited && <span>· 已编辑</span>}{node.type === 'article' && <CountBadge>{articles.findIndex(a => a.id === node.id) + 1}</CountBadge>}</div>}
  {node.author && <div className="lp-card-author"><Avatar author src={node.author.avatar} size={24}/><span><strong>{node.author.name}</strong><small>{node.author.expertise}</small></span></div>}
  {node.author && node.title !== node.author.name && <h3>{node.title}</h3>}{!node.author && (editing ? <InlineTitle title={node.title} onFinish={title => onFinishEdit?.(title)}/> : <h3>{node.title || '\u00a0'}</h3>)}{node.type === 'article' && article?.likes != null && article.likes > 0 && <p className="lp-article-likes">{article.likes.toLocaleString('zh-CN')} 赞同</p>}{node.author ? <div className={`lp-author-content ${expanded ? 'is-expanded' : ''}`}>{node.author.matchReason && <p className="lp-author-match">{node.author.matchReason}{node.author.coverageLimit && <><br />适用边界：{node.author.coverageLimit}</>}</p>}{node.text && <MarkdownMath className="lp-node-prose learn-markdown" source={node.text} sourceExcerpt={false} passive/>}</div> : node.text && <MarkdownMath className={`lp-node-prose learn-markdown ${expanded ? 'is-expanded' : ''}`} source={node.text} sourceExcerpt={false} passive/>}
  {node.type !== 'root' && node.type !== 'custom' && <><div className="lp-node-sources">{node.type === 'author' ? <>本次检索 · 博主文章{node.author?.url && (onOriginal ? <button className="lp-author-original" aria-expanded={expanded} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onOriginal(); }}>{expanded ? '收起文章' : '阅读原文'}</button> : original.kind === 'external' ? <a className="lp-author-original" href={original.href} target="_blank" rel="noopener noreferrer" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>阅读原文 ↗</a> : null)}</> : node.origin === 'direct' ? '刘看山讲解' : node.sources.length ? <>{node.type === 'article' ? '资料' : '资料来源'}{node.sources.map(id => { const number = articles.findIndex(a => a.id === id) + 1; return number > 0 ? <SourceTag key={id} number={number} onClick={() => onSource?.(id)}/> : null; })}</> : '依据父卡内容'}</div><button className="lp-node-expand" aria-expanded={expanded} onClick={e => { e.stopPropagation(); onExpand?.(); }}>{expanded ? '收起内容' : node.type === 'article' && example ? '展开阅读说明' : node.type === 'article' && articles.find(a => a.id === node.id)?.sourceKind !== 'upload' ? '展开完整总结' : '展开完整正文'}<Glyph name="chevron" size={11}/></button></>}
  {selected && !editing && toolbar && <NodeToolbar {...actions}/>}</div>;
}
