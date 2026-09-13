import {safeSourceImageUrl} from '@threadpeak/contracts/source-image'
import {SourceFootprints,type SourceFeedback as Feedback} from './SourceFootprints'
import {ChoiceMenu} from '../components/ChoiceMenu'
import {SourceComments} from './SourceComments'
import {SourceReading,useSourcePresentation} from './SourcePresentation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { AuthorBrief, AuthorMatch, AuthorNetwork, NetworkAuthor, NetworkEvidence } from '@threadpeak/contracts/authors'
import { consultationDraft } from '@threadpeak/contracts/authors'
import { AuthorNetworkGraph } from '../components/AuthorNetworkGraph'
import { networkGraph } from './author-graph'
import { Glyph } from './atoms'
import { MarkdownMath } from '../lib/MarkdownMath'
import { SourceImport } from './AuthorSourceImport'
import { isDemoSourceUrl, sourceLink } from './source-link'
import {restoreAuthorDraft} from './author-draft'
import { Icon } from '../icons'

export function AuthorAvatar({name,src,sourceUrl}:{name:string;src?:string;sourceUrl?:string}){
  const [failedSources,setFailedSources]=useState<string[]>([])
  const supplied=safeSourceImageUrl(src),lookup=!supplied||failedSources.includes(supplied)
  const {value,failed}=useSourcePresentation(sourceUrl,lookup)
  const avatar=lookup?safeSourceImageUrl(value?.data.metadata.avatar):supplied
  if(avatar&&!failedSources.includes(avatar))return <img className="au-avatar" src={avatar} alt={`${name}的头像`} width={42} height={42} loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={()=>setFailedSources(previous=>previous.includes(avatar)?previous:[...previous,avatar])}/>
  const label=value||failed||failedSources.length||!sourceUrl?`${name}的头像暂不可用`:`正在读取${name}的头像`
  return <span className="au-avatar" role="img" aria-label={label} title={label}><Icon name="user" size={24}/></span>
}
export function AuthorBadge({icon,text,sourceUrl,fallback="知乎内容作者"}:{icon?:string;text?:string;sourceUrl?:string;fallback?:string}){
  const {value}=useSourcePresentation(sourceUrl,!icon&&!text)
  icon=icon||value?.data.metadata.badgeIcon; text=text||value?.data.metadata.badge
  const [failedSrc,setFailedSrc]=useState<string>()
  return <span className={`au-meta ${text||icon?'au-identity':''}`} aria-label={text||icon?'知乎作者认证':undefined}>{safeSourceImageUrl(icon)&&icon!==failedSrc&&<img className="au-badge-icon" src={icon} alt="" width={13} height={13} referrerPolicy="no-referrer" onError={()=>setFailedSrc(icon)}/>}<span>{text||fallback}</span></span>
}
function SourceMetrics({source}:{source:AuthorMatch|NetworkEvidence}){
  const count=(value:number|undefined)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?new Intl.NumberFormat('zh-CN').format(value):null
  const likes=count(source.likes)
  const edited=source.editedAt&&source.editedAt>0?new Date(source.editedAt*1000):null
  const date=edited&&Number.isFinite(edited.getTime())?edited:null
  if(likes===null&&!date)return null
  return <div className="au-source-metrics" aria-label="文章数据">{likes!==null&&<span><Glyph name="like" size={12}/>{likes} 赞同</span>}{date&&<time dateTime={date.toISOString()}>{new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'numeric',day:'numeric'}).format(date)} 更新</time>}</div>
}
export function AuthorMatchCard({author,index,onPrepare,onInspect}:{author:AuthorMatch;index:number;onPrepare:()=>void;onInspect:()=>void}){
  const [expanded,setExpanded]=useState(false)
  const used=author.topic.uses,helpful=author.topic.helpful
  const link=sourceLink(author.url),demo=link.kind==='demo'||isDemoSourceUrl(author.authorUrl)
  return <article className="au-result" style={{'--au-delay':`${index*70}ms`} as React.CSSProperties}>
    <header><AuthorAvatar name={author.authorName} src={author.avatar} sourceUrl={author.url}/><div className="au-author-heading"><button className="au-author-name" onClick={onInspect}>{author.authorName}</button><AuthorBadge icon={author.badgeIcon} text={demo?undefined:author.badge} sourceUrl={demo?undefined:author.url} fallback={demo?'演示资料':author.known?'你的来源网络':'知乎内容作者'}/></div><span className={`au-fit ${author.fit}`}>{author.fit==='direct'?'切中这个问题':'相关切入点'}</span></header>
    <div className="au-match-title" role="heading" aria-level={3}><MarkdownMath source={author.canHelpWith}/></div><div className="au-reason"><MarkdownMath source={author.reason}/></div>
    {link.kind==='external'&&!demo?<a className="au-evidence-link" href={link.href} target="_blank" rel="noopener noreferrer"><Glyph name="book" size={15}/><span>{author.title}</span><Glyph name="link" size={14}/></a>:<button type="button" className="au-evidence-link" onClick={onInspect}><Glyph name="book" size={15}/><span>{author.title}</span><small>{demo?'演示资料':'预览资料'}</small></button>}
    <SourceMetrics source={author}/>
    <blockquote><span>{author.quoteSummarized?'压缩摘要中的依据':'文章总结中的依据'}</span><div className={expanded?'':'au-quote-preview'}><MarkdownMath source={author.quote} sourceExcerpt/></div><button className="au-link-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'收起依据':'展开推荐依据'}</button></blockquote>
    <div className="au-caveat"><Glyph name="help" size={14}/><MarkdownMath source={author.limitation}/></div>
    {(used>0||helpful>0||author.topic.pinned)&&<div className="au-personal"><Glyph name="graph" size={14}/><span>在「{author.topic.title}」{helpful>0?`，你标记过 ${helpful} 份材料有帮助`:used>0?`，你主动使用过 ${used} 次`:'，你设为优先参考'}</span></div>}
    <footer><button className="au-link-button" onClick={onInspect}>了解依据与学习足迹 <Glyph name="chevron" size={14}/></button>{demo?<span className="au-demo-note">演示作者 · 仅供预览</span>:<button className="au-primary" onClick={onPrepare}>准备请教<Glyph name="message" size={15}/></button>}</footer>
  </article>
}
export function AuthorDialog({title,onClose,onBack,children}:{title:string;onClose:()=>void;onBack?:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDialogElement>(null),titleId=useId()
  useEffect(()=>{ref.current?.querySelector<HTMLHeadingElement>('.au-dialog-head h2')?.focus()},[title])
  useEffect(()=>{const el=ref.current;el?.showModal();return()=>el?.close()},[])
  return <dialog className="au-dialog" ref={ref} aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><section><header className="au-dialog-head">{onBack&&<button className="au-icon au-sheet-back" aria-label="返回上一页" onClick={onBack}><Glyph name="back"/></button>}<h2 id={titleId} tabIndex={-1}>{title}</h2><button className="au-icon" aria-label="关闭面板" onClick={onClose}><Glyph name="close"/></button></header>{children}</section></dialog>
}
export function PrepareAuthor({brief,author,searchId,onClose}:{brief:AuthorBrief;author:AuthorMatch;searchId:string;onClose:()=>void}){
  return <PrepareAuthorDraft key={`${searchId}:${author.authorId}`} brief={brief} author={author} searchId={searchId} onClose={onClose}/>
}
function PrepareAuthorDraft({brief,author,searchId,onClose}:{brief:AuthorBrief;author:AuthorMatch;searchId:string;onClose:()=>void}){
  const storageKey=`tp-author-draft:${searchId}:${author.authorId}`
  const [draft,setDraft]=useState(()=>{try{return restoreAuthorDraft(sessionStorage.getItem(storageKey),brief,author)}catch{return consultationDraft(brief,author)}}),[copied,setCopied]=useState(false),[notice,setNotice]=useState('')
  const draftRef=useRef(draft);draftRef.current=draft
  const profile=sourceLink(author.authorUrl),article=sourceLink(author.url),contact=profile.kind==='external'?profile:article
  useEffect(()=>{try{sessionStorage.setItem(storageKey,draft)}catch{setNotice('当前窗口无法保存草稿，请先复制需要保留的内容。')}},[storageKey,draft])
  if(isDemoSourceUrl(author.url)||isDemoSourceUrl(author.authorUrl))return <AuthorDialog title="演示资料" onClose={onClose}><div className="au-dialog-body"><p className="au-contact-note">这是演示账号中的示例资料，不代表真实作者，不提供咨询或邀请入口。</p><h3>{author.title}</h3><MarkdownMath source={author.summary}/></div></AuthorDialog>
  return <AuthorDialog title={brief.purpose==='consult'?'准备私聊内容':'准备邀请消息'} onClose={onClose}><div className="au-dialog-body"><div className="au-person-heading"><AuthorAvatar name={author.authorName} src={author.avatar} sourceUrl={author.url}/><div><h3>{author.authorName}</h3><p>{brief.purpose==='consult'?'先说清遇到的问题，再聊聊是否方便咨询':'说明想请教什么，再邀请对方分享经验'}</p></div></div><div className="au-contact-note"><Glyph name="help"/><p>已找到相关公开材料。{brief.purpose==='consult'?'是否开放咨询、费用和能提供的帮助，需要在知乎与作者确认。':'是否接受邀请、是否回答，由作者决定。'}</p></div><label className="au-field"><span>发送前，按你的情况修改</span><textarea aria-label="私聊内容草稿" className="au-draft" value={draft} onChange={e=>{setDraft(e.target.value);setCopied(false)}}/></label><p className="au-muted">根据你的问题整理，可直接修改后粘贴到知乎私聊。请确认文字符合你的情况。</p><div className="au-dialog-actions"><button className="au-primary" disabled={!draft.trim()} onClick={async()=>{try{await navigator.clipboard.writeText(draft);const current=draftRef.current===draft;setCopied(current);setNotice(current?'':'已复制修改前的内容，请重新复制。')}catch{setNotice('未能自动复制，请选中上面的文字复制。')}}}><Glyph name={copied?'check':'copy'} size={16}/>{copied?'已复制私聊内容':'复制私聊内容'}</button><>{contact.kind==='external'&&<a className="au-secondary" href={contact.href} target="_blank" rel="noopener noreferrer">{profile.kind==='external'?'去知乎了解作者':'从原文了解作者'}<Glyph name="link" size={15}/></a>}</></div>{notice&&<p className="au-save-status" role="status">{notice}</p>}</div></AuthorDialog>
}
export function AuthorDetail({author,onClose,onFeedback,initialLearningId,onImported}:{author:NetworkAuthor;onClose:()=>void;onFeedback:Feedback;initialLearningId?:string;onImported?:()=>void}){
  const [view,setView]=useState<'profile'|'reading'|'connect'>('profile'),[tab,setTab]=useState<'sources'|'history'>('sources')
  const [evidenceId,setEvidenceId]=useState<string>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const evidence=author.evidence.find(e=>e.evidenceId===evidenceId)
  const demo=isDemoSourceUrl(author.authorUrl)||author.evidence.every(e=>isDemoSourceUrl(e.url))
  const sourceView=(id:string)=>{setEvidenceId(id);setView('reading');setNotice('')}
  const save:Feedback=async(...args)=>{setBusy(true);try{await onFeedback(...args);setNotice('已保存')}catch(e){setNotice(e instanceof Error?e.message:'暂未保存，请重试。')}finally{setBusy(false)}}
  const back=()=>{setView(view==='connect'?'reading':'profile');setNotice('')}
  return <AuthorDialog title={view==='profile'?'作者资料':view==='reading'?'阅读资料':'用于学习'} onClose={onClose} onBack={view==='profile'?undefined:back}>
    {view==='connect'&&evidence?<SourceImport key={evidence.evidenceId} evidence={evidence} initialLearningId={initialLearningId} onImported={onImported} onClose={onClose}/>:<>
    <div className="au-dialog-body au-profile-body" key={`${view}:${evidenceId??''}`}>
      {view==='profile'&&<>
        <div className="au-person-heading"><AuthorAvatar name={author.name} src={author.evidence.find(e=>e.avatar)?.avatar} sourceUrl={author.evidence[0]?.url}/><div><h3>{author.name}</h3><AuthorBadge text={demo?undefined:author.evidence.find(e=>e.badge)?.badge} fallback={demo?'演示作者 · 示例资料仅供预览':'知乎内容作者'} icon={author.evidence.find(e=>e.badgeIcon)?.badgeIcon} sourceUrl={demo?undefined:author.evidence[0]?.url}/>{author.authorUrl&&sourceLink(author.authorUrl).kind==='external'&&!demo&&<a className="au-profile-link" href={author.authorUrl} target="_blank" rel="noopener noreferrer">知乎主页<Glyph name="link" size={12}/></a>}</div></div>
        <nav className="au-profile-nav" aria-label="作者资料视图"><button aria-pressed={tab==='sources'} onClick={()=>setTab('sources')}>资料 <span>{author.evidence.length}</span></button><button aria-pressed={tab==='history'} onClick={()=>setTab('history')}>学习足迹</button></nav>
        {tab==='sources'?<><p className="au-list-caption">在你的学习与找人过程中发现的资料</p><div className="au-author-sources">{author.evidence.map(source=><button className="au-source-row" key={source.evidenceId} onClick={()=>sourceView(source.evidenceId)}><span className="au-source-row-icon"><Glyph name="document" size={18}/></span><span><strong>{source.title}</strong><small>{[...new Set(source.uses.map(u=>u.topic))].join(' · ')||'知乎资料'}</small><SourceMetrics source={source}/></span><Glyph name="chevron" size={16}/></button>)}</div>{!author.evidence.length&&<p className="au-quiet-empty">还没有可阅读的资料。</p>}</>:<><p className="au-list-caption">查看作者的哪篇资料用于哪个概念，以及沿它展开的讲解与提问。</p>{author.evidence.map(source=><section className="au-history-source" key={source.evidenceId}><button onClick={()=>sourceView(source.evidenceId)} className="au-history-title"><Glyph name="document" size={16}/>{source.title}<Glyph name="chevron" size={14}/></button><SourceFootprints evidence={source} authorId={author.id} onFeedback={save} busy={busy} onClose={onClose}/></section>)}</>}
      </>}
      {view==='reading'&&evidence&&<>
        <div className="au-reading-byline"><AuthorAvatar name={author.name} src={evidence.avatar} sourceUrl={evidence.url}/><span>{author.name}</span><span>· {demo?'演示资料':'知乎资料'}</span></div>
        <h3 className="au-reading-title">{evidence.title}</h3><SourceMetrics source={evidence}/>
        <div className="au-reading-content"><SourceReading source={evidence.summary} url={evidence.url}/></div>
        <SourceComments comments={evidence.comments} total={evidence.commentCount} url={evidence.url}/>
        {evidence.uses.length>0&&<details className="au-reading-footprints"><summary>这篇资料与我的学习 <span>{new Set(evidence.uses.map(u=>u.topicId)).size} 个主题</span></summary><SourceFootprints evidence={evidence} authorId={author.id} onFeedback={save} busy={busy} onClose={onClose}/></details>}
      </>}
      {notice&&<p className="au-save-status" role="status">{notice}</p>}
    </div>
    {view==='reading'&&evidence&&<footer className="au-sheet-footer">{sourceLink(evidence.url).kind==='external'&&!demo?<a className="au-link-button" href={evidence.url} target="_blank" rel="noopener noreferrer">阅读知乎原文<Glyph name="link" size={14}/></a>:<span className="au-muted">{demo?'演示资料':'原文链接暂未提供'}</span>}<button className="au-primary" onClick={()=>setView('connect')}><Glyph name="plus" size={15}/>用于学习</button></footer>}
    </>}
  </AuthorDialog>
}
export function AuthorNetworkPanel({network,onInspect}:{network:AuthorNetwork;onInspect:(id:string)=>void}){
  const [topic,setTopic]=useState(''),[query,setQuery]=useState(''),[focus,setFocus]=useState('')
  const networkListId=useId()
  const topics=[...new Map(network.authors.flatMap(a=>a.topics).map(t=>[t.id,t])).values()]
  const filtered=network.authors.filter(a=>(!topic||a.topics.some(t=>t.id===topic))&&`${a.name} ${a.evidence.map(e=>e.title).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const graph=useMemo(()=>networkGraph({...network,authors:filtered},topic),[network,topic,query])
  const highlighted=focus?{nodeIds:[`author:${encodeURIComponent(focus)}`,...graph.edges.filter(e=>e.source===`author:${encodeURIComponent(focus)}`).map(e=>e.target)],focusId:`author:${encodeURIComponent(focus)}`}:null
  return <><div className="au-network-tools"><div><label><Glyph name="search" size={15}/><input aria-label="查找网络中的作者或文章" value={query} onChange={e=>setQuery(e.target.value)} placeholder="查找作者或文章"/></label><ChoiceMenu label="按主题查看网络" value={topic} onChange={value=>{setTopic(value);setFocus('')}} options={[{value:'',label:'所有主题'},...topics.map(t=>({value:t.id,label:t.title}))]}/></div></div>
    <div className="au-network-layout"><section className="au-network-canvas">{graph.nodes.length?<AuthorNetworkGraph describedBy={networkListId} nodes={graph.nodes} edges={graph.edges} highlight={highlighted} onSelect={node=>{if(node.kind==='author')onInspect(decodeURIComponent(node.id.slice(7)))}}/>:<div className="au-empty"><Glyph name="graph" size={36}/><h3>{network.authors.length?'没有符合筛选的来源':'你的积累，会从第一篇文章开始'}</h3><p>开始学习后，文章作者会自动记录在这里。主动追问和有帮助反馈，会让下次找人更有依据。</p><a className="au-secondary" href="#paths">去学习一个概念</a></div>}<p className="au-graph-note">拖动探索 · Tab 聚焦节点，Enter 查看作者 · Ctrl / ⌘ + 滚轮缩放</p></section>
    <aside className="au-network-list" id={networkListId} aria-label="来源网络中的作者、资料与主题"><header><h3>我的来源作者</h3><span role="status" aria-live="polite">{filtered.length} 条记录</span></header>{filtered.map(a=><button className="au-network-person" key={a.id} onPointerEnter={()=>setFocus(a.id)} onPointerLeave={()=>setFocus('')} onFocus={()=>setFocus(a.id)} onBlur={()=>setFocus('')} onClick={()=>onInspect(a.id)}><AuthorAvatar name={a.name} src={a.evidence.find(e=>e.avatar)?.avatar} sourceUrl={a.evidence[0]?.url}/><span><strong>{a.name}</strong><small>{a.evidence.length} 份材料 · {a.topics.length} 个主题</small><em>{a.topics.some(t=>t.hidden)?'有已暂停推荐的主题':a.topics.reduce((s,t)=>s+t.helpful,0)>0?'你标记过有帮助':'已发现的来源'}</em></span><Glyph name="chevron" size={15}/></button>)}<p className="au-muted">初次发现不会加分。你主动采用过什么、什么有帮助，会分别保留。</p></aside></div>

  </>
}
