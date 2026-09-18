import { sourceLink } from "../../components/learning/source-link.ts";
import { Glyph } from "../../components/learning/atoms.tsx";
import { CardAvatar } from "../../components/learning/CardAvatar.tsx";
import { consultationAuthors,consultationQuestion } from "./consultation-content.ts";
import content from "../learning/learning-story-content.ts";
export type AuthorDetailTab = 'sources' | 'footprints' | 'reading';
const Arrow = () => <span className="consult-internal-arrow" aria-hidden="true"><Glyph name="chevron" size={15}/></span>;
export function ConsultationAuthorDetails({ index, tab, onTab, onClose, onPrepare }: {
    index: number;
    tab: AuthorDetailTab;
    onTab: (tab: AuthorDetailTab) => void;
    onClose: () => void;
    onPrepare: () => void;
}) {
    const a = consultationAuthors[index];
    const original = sourceLink(a.url);
    const learned = a.provenance === 'learning-evidence';
    const derived = [
        { kind: '博主观点 · ' + a.name, title: a.title },
        { kind: '刘看山讲解', title: content.followup.paragraphs[0].title },
        { kind: '我的笔记', title: '我的学习笔记' },
    ];
    return <section className="consult-author-details" aria-label={`${a.name}的作者资料`} aria-hidden="true" inert>
  <header><span className="consult-detail-avatar"><CardAvatar name={a.name} src={a.avatar}/></span><div><strong>{a.name}</strong><small>{a.badge}</small></div><button onClick={onClose} aria-label="返回推荐依据">返回依据 <span>↗</span></button></header>
  <div className="consult-inline-tabs" role="tablist" aria-label="作者资料分类"><button role="tab" aria-selected={tab !== 'footprints'} onClick={() => onTab('sources')}>资料 <span>1</span></button><button role="tab" aria-selected={tab === 'footprints'} onClick={() => onTab('footprints')}>学习足迹</button></div>
  <div className="consult-inline-scroll" key={`${a.id}:${tab}`}>
   {tab === 'sources' && <div role="tabpanel" aria-label="资料">
    <p className="consult-list-caption">在你的学习与找人过程中发现的资料</p>
    <button className="consult-source-row" onClick={() => onTab('reading')}><span className="consult-source-row-icon"><Glyph name="document" size={18}/></span><span><strong>{a.title}</strong><small>{a.topic}</small></span><Glyph name="chevron" size={16}/></button>
   </div>}
   {tab === 'footprints' && <div role="tabpanel" aria-label="学习足迹">
    <p className="consult-list-caption">查看作者的哪篇资料用于哪个概念，以及沿它展开的讲解与提问。</p>
    {learned ? <section className="consult-footprint" aria-label={`用于学习这个概念：${content.title}`}>
     <header className="consult-footprint-heading"><span className="consult-footprint-context">用于学习这个概念</span><h4><button type="button" onClick={() => onTab('reading')}>{content.title}<Arrow/></button></h4><p className="consult-footprint-carrier">所属载体 · 规模与预算</p></header>
     <div className="consult-footprint-derived"><h5>沿这篇资料展开的内容 <span>{derived.length}</span></h5><p>这些内容在知识脉络中沿这篇资料展开，点击可定位到对应卡片。</p><ul>{derived.map(card => <li key={card.title}><button type="button" onClick={() => onTab('reading')}><span className="consult-footprint-card-kind">{card.kind}</span><strong>{card.title}</strong><Arrow/></button></li>)}</ul></div>
     <details className="consult-footprint-questions" open><summary>相关提问 <span>1</span></summary><ul><li><p>{consultationQuestion}</p></li></ul></details>
     <footer className="consult-footprint-feedback"><p>这篇资料对你理解<strong>「{content.title}」</strong>有帮助吗？</p><button type="button" aria-pressed="false"><Glyph name="like" size={15}/>有帮助</button></footer>
    </section> : <p className="consult-quiet-empty">这篇资料还没有用于具体的学习概念。</p>}
   </div>}
   {tab === 'reading' && <article className="consult-inline-reading"><button className="consult-inline-return" onClick={() => onTab('sources')}>← 返回资料</button><small>公开资料 · 检索摘要</small><h3>{a.title}</h3><p className="consult-inline-byline">{a.name}</p>{a.text.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}<p className="consult-inline-note">以上是已保存的检索材料，不代表完整原文。</p>{original.kind === 'external' && <a href={original.href} target="_blank" rel="noopener noreferrer">到知乎查看原文 ↗</a>}</article>}
  </div>
  <footer><span>带上实践记录，约定请教范围。</span><button className="consult-prepare" onClick={onPrepare}>准备请教 ↗</button></footer>
 </section>;
}
