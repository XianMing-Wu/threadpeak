import type {NetworkEvidence} from '@threadpeak/contracts/authors'
import {authorLearningHref} from '@threadpeak/contracts/authors'
import {sourceFootprints} from './source-footprints'
import {Glyph} from './atoms'
export type SourceFeedback=(authorId:string,topicId:string,kind:'helpful'|'pinned'|'hidden',value:boolean,evidenceId?:string)=>Promise<void>
const direction=<span className="au-internal-arrow" aria-hidden="true"><Glyph name="chevron" size={15}/></span>
export function SourceFootprints({evidence,authorId,onFeedback,busy,onClose}:{evidence:NetworkEvidence;authorId:string;onFeedback:SourceFeedback;busy:boolean;onClose:()=>void}){
  const groups=sourceFootprints(evidence)
  if(!groups.length)return <p className="au-quiet-empty">这篇资料还没有用于具体的学习概念。</p>
  return <div className="au-footprints">{groups.map(group=>{
    const originals=group.cards.filter(c=>c.kind==='article'),derived=group.cards.filter(c=>c.kind!=='article'&&c.kind!=='root')
    const learning=!!group.resourceId
    const context=learning?'用于学习这个概念':group.origins.has('collection')?'来自你导入的收藏夹':group.origins.has('creation')?'来自你导入的创作':'查找博主时发现'
    return <section className="au-footprint" key={group.id} aria-label={`${context}：${group.title}`}>
      <header className="au-footprint-heading"><span className="au-footprint-context">{context}</span><h4>{learning?<a href={authorLearningHref(group.resourceId!)} onClick={onClose} title={`进入“${group.title}”的学习`}>{group.title}{direction}</a>:group.title}</h4>{group.carrier&&<p className="au-footprint-carrier">所属载体 · {group.carrier}</p>}</header>
      {learning&&originals.length>0&&<div className="au-footprint-original"><Glyph name="document" size={15}/><span>已加入这个概念的资料</span>{originals.map((card,i)=><a key={card.id} href={authorLearningHref(group.resourceId!,card.id)} onClick={onClose} aria-label={`查看资料卡：${card.title}`}>查看资料卡{originals.length>1?` ${i+1}`:''}{direction}</a>)}</div>}
      {learning&&derived.length>0&&<div className="au-footprint-derived"><h5>沿这篇资料展开的内容 <span>{derived.length}</span></h5><p>这些内容在知识脉络中沿这篇资料展开，点击可定位到对应卡片。</p><ul>{derived.map(card=><li key={card.id}><a href={authorLearningHref(group.resourceId!,card.id)} onClick={onClose} aria-label={`定位${card.kind==='answer'?'讲解':'卡片'}：${card.title}`}><span className="au-footprint-card-kind">{card.kind==='answer'?'刘看山讲解':card.kind==='author'?`博主观点 · ${evidence.authorName}`:card.kind==='custom'?'我的笔记':'知识卡片'}</span><strong>{card.title}</strong>{direction}</a></li>)}</ul></div>}
      {learning&&originals.length>0&&!derived.length&&<p className="au-footprint-empty">目前仅收录了资料，还没有沿它展开的讲解。</p>}
      {group.questions.length>0&&<details className="au-footprint-questions"><summary>{learning?'相关提问':'当时的问题'} <span>{group.questions.length}</span></summary><ul>{group.questions.map(q=><li key={q.text}><p>{q.text}</p>{learning&&q.nodeIds.map((id,i)=><a key={id} href={authorLearningHref(group.resourceId!,id)} onClick={onClose}>查看对应内容{q.nodeIds.length>1?` ${i+1}`:''}{direction}</a>)}</li>)}</ul></details>}
      {group.searchIds.map((id,i)=><a key={id} className="au-footprint-search" href={`#authors?search=${encodeURIComponent(id)}`} onClick={onClose}>查看这次找人的结果{group.searchIds.length>1?` ${i+1}`:''}{direction}</a>)}
      <footer className="au-footprint-feedback"><p>{learning?<>这篇资料对你理解<strong>「{group.title}」</strong>有帮助吗？</>:<>这篇资料对<strong>「{group.title}」</strong>有帮助吗？</>}</p><button type="button" aria-label={`${group.helpful?'取消标记':'标记'}《${evidence.title}》对「${group.title}」有帮助`} aria-pressed={group.helpful} disabled={busy} onClick={()=>void onFeedback(authorId,group.id,'helpful',!group.helpful,evidence.evidenceId)}><Glyph name={group.helpful?'check':'like'} size={15}/>{group.helpful?'有帮助 · 点击取消':'有帮助'}</button></footer>
    </section>
  })}</div>
}
