import {pollResource} from './poll'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rankAuthorMatches, type AuthorBrief, type AuthorMatch, type AuthorNetwork, type AuthorSearchState } from '@threadpeak/contracts/authors'
import {AuthorSearchComposer} from './AuthorSearchComposer'
import { AuthorDiscoveryHero } from './AuthorDiscoveryHero'
import { PeakTabs } from '../components/PeakTabs'
import { ProductWorkspace } from '../components/Shell'
import { productRequest, type TaskView, type LearningSnapshot } from './client'
import { AuthorAvatar, AuthorBadge, AuthorDetail, AuthorMatchCard, AuthorNetworkPanel, PrepareAuthor } from './AuthorPanels'
import { Glyph, StatusPill } from './atoms'
import { AuthorCoverflow } from './AuthorCoverflow'
import '../ui/flowith-market.css'
import './authors.css'

type Snapshot={id:string;revision:number;data:AuthorSearchState;job:TaskView|null}
const defaultBrief:AuthorBrief={question:'',purpose:'consult',background:'',attempted:'',desiredOutcome:'',depth:'fast',selected:[],useNetwork:true,newOnly:false}
const phases=['查看你的学习来源','梳理需要请教的问题','寻找相关的知乎作者','核对每位作者的推荐依据','整理适合继续请教的人选']
export function DurableAuthorsPage(){
  const params=new URLSearchParams(location.hash.split('?')[1]??'')
  const [section,setSection]=useState<'search'|'network'>(params.get('view')==='network'?'network':'search')
  const [brief,setBrief]=useState<AuthorBrief>({...defaultBrief,learningId:params.get('learning')??undefined,selected:params.getAll('node')})
  const [learning,setLearning]=useState<LearningSnapshot|null>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[network,setNetwork]=useState<AuthorNetwork|null>(null)
  const [resourceId,setResourceId]=useState(()=>params.get('search')??'')
  const [notice,setNotice]=useState(''),[sending,setSending]=useState(false),[prepare,setPrepare]=useState<AuthorMatch|null>(null),[inspect,setInspect]=useState<string|null>(params.get('author'))
  const [personal,setPersonal]=useState(true),[newOnly,setNewOnly]=useState(false),[past,setPast]=useState<{id:string;question:string}[]>([])
  const [reconnect,setReconnect]=useState(0)
  const lock=useRef(false),lastLoad=useRef(''),mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{
    const followSearch=()=>{if(location.hash.split('?')[0]!=='#authors')return;const next=new URLSearchParams(location.hash.split('?')[1]??''),id=next.get('search');if(id){setResourceId(id);setSection('search')}else if(!next.get('learning')){setResourceId('');setSnapshot(null);setBrief({...defaultBrief});setLearning(null);lastLoad.current='';setNotice('');setSection(next.get('view')==='network'?'network':'search')}}
    window.addEventListener('hashchange',followSearch);return()=>window.removeEventListener('hashchange',followSearch)
  },[])
  const loadNetwork=useCallback(async()=>{const data=await productRequest<AuthorNetwork>('/api/v2/authors/network');if(data.version!==3)throw new Error('来源网络正在更新，请稍后再试。');if(mounted.current)setNetwork(data);return data},[])
  const history=useCallback(async()=>{try{const rows=await productRequest<{id:string;question:string}[]>('/api/v2/authors/history');if(mounted.current)setPast(rows)}catch{}},[])
  useEffect(()=>{void loadNetwork().catch(e=>{if(mounted.current)setNotice(e.message)});void history()},[loadNetwork,history,section])
  useEffect(()=>{
    if(!brief.learningId)return
    const abort=new AbortController()
    void productRequest<LearningSnapshot>(`/api/v2/resources/${encodeURIComponent(brief.learningId)}`,{signal:abort.signal}).then(data=>{
      if(data.kind!=='learning')throw new Error('找不到这份学习内容。')
      setLearning(data);setBrief(b=>({...b,question:b.question||data.data.conversations.find(c=>c.id===data.data.active)?.messages.filter(m=>m.role==='user').at(-1)?.text||data.data.title}))
    }).catch(e=>{if(!abort.signal.aborted)setNotice(e.message)});return()=>abort.abort()
  },[brief.learningId])
  useEffect(()=>{
    if(!resourceId)return
    const abort=new AbortController()
    void pollResource(async()=>{
      const next=await productRequest<Snapshot>(`/api/v2/resources/${encodeURIComponent(resourceId)}`,{signal:abort.signal})
      if(abort.signal.aborted)return false
      setSnapshot(old=>old&&old.id===next.id&&old.revision>next.revision?old:next)
      if(lastLoad.current!==resourceId){lastLoad.current=resourceId;if(next.data.version===3){setBrief(next.data.brief);setPersonal(next.data.brief.useNetwork);setNewOnly(next.data.brief.newOnly)}else setBrief({...defaultBrief,question:next.data.question})}
      if(!['queued','running'].includes(next.job?.status??'')){void loadNetwork().catch(()=>{});void history();return false}
    },{signal:abort.signal,onError:(_error,stopped)=>setNotice(stopped?'连接暂停，点击重新连接继续。':'正在重新连接。')})
    return()=>abort.abort()
  },[resourceId,loadNetwork,history,snapshot?.job?.status==='waiting',reconnect])
  const busy=sending||!!snapshot?.job&&['queued','running'].includes(snapshot.job.status)
  async function search(onlyNew=brief.newOnly){
    if(!brief.question.trim()||busy||lock.current)return
    lock.current=true;setSending(true);setNotice('')
    try{const next=await productRequest<Snapshot>('/api/v2/authors/search',{method:'POST',body:{...brief,newOnly:onlyNew}});lastLoad.current=next.id;setSnapshot(next);setResourceId(next.id);window.history.replaceState(null,'',`#authors?search=${encodeURIComponent(next.id)}`);setPersonal(brief.useNetwork);setNewOnly(onlyNew)}catch(e){setNotice(e instanceof Error?e.message:'问题已保留，请稍后再试。')}finally{lock.current=false;setSending(false)}
  }
  async function taskAction(action:'resume'|'cancel'){if(!snapshot)return;try{setSnapshot(await productRequest(`/api/v2/resources/${snapshot.id}/${action}`,{method:'POST',body:{}}));setNotice('')}catch(e){setNotice(e instanceof Error?e.message:'暂未连接。')}}
  async function feedback(authorId:string,topicId:string,kind:'helpful'|'pinned'|'hidden',value:boolean,evidenceId?:string){setNetwork(await productRequest<AuthorNetwork>('/api/v2/authors/feedback',{method:'POST',body:{authorId,topicId,kind,value,evidenceId}}))}
  const pool=useMemo(()=>snapshot?.data.version===3?snapshot.data.candidates.map(c=>({...c,topic:network?.authors.find(a=>a.id===c.authorId)?.topics.find(t=>t.id===c.topic.id)??c.topic})):[],[snapshot,network])
  const results=rankAuthorMatches(pool,personal,newOnly),baseline=rankAuthorMatches(pool,false,newOnly)
  const changed=results.map(a=>a.authorId).join('|')!==baseline.map(a=>a.authorId).join('|')
  const selectedAuthor=network?.authors.find(a=>a.id===inspect)
  const completed=snapshot?.job?.status==='completed',legacy=!!snapshot&&snapshot.data.version!==3
  const phaseIndex=Math.max(0,phases.indexOf(snapshot?.job?.phase??''))
  const patch=(values:Partial<AuthorBrief>)=>setBrief(b=>({...b,...values}))
  return <ProductWorkspace active="authors" page="authors"><main className="ux-flowith peak-market au-page" tabIndex={0} aria-label="博主搜索与网络">
    <AuthorDiscoveryHero/>
    <div className="tabs-wrap au-market-tabs"><PeakTabs items={[{id:'search' as const,label:'搜索博主',icon:'search'},{id:'network' as const,label:'我的博主网络',icon:'network'}]} active={section} onChange={setSection}/><details className="au-history"><summary><Glyph name="clock" size={16}/>搜索历史</summary><div>{past.length?past.map(item=><button key={item.id} onClick={e=>{setResourceId(item.id);setSection('search');e.currentTarget.closest('details')?.removeAttribute('open')}}>{item.question}</button>):<p>还没有搜索记录</p>}</div></details></div>
    <section className="panel"><div className="sec au-content">
    {notice&&<div className="au-notice" role="status"><span>{notice}</span><button onClick={()=>{setReconnect(n=>n+1);void loadNetwork().then(()=>setNotice('')).catch(e=>setNotice(e.message))}}>重新连接</button><button aria-label="关闭提示" onClick={()=>setNotice('')}><Glyph name="close" size={14}/></button></div>}
    {section==='network'?<><h3>我的博主网络</h3><p className="sec-sub">文章与学习记录自动汇集；使用次数和有帮助反馈分别保留。</p>{network?<AuthorNetworkPanel network={network} onInspect={setInspect}/>:<div className="au-loading"><StatusPill busy>正在读取学习来源</StatusPill></div>}</>:<>
      <div className="au-search-title"><h3>找人请教</h3><p className="sec-sub">描述 AI 还没帮你解决的问题，找到值得进一步了解的博主。</p></div>
      <AuthorSearchComposer brief={brief} onChange={patch} onSend={()=>void search()} onStop={()=>void taskAction('cancel')} busy={busy} sending={sending}
        context={<>{brief.learningId&&learning&&<div className="au-learning-context"><Glyph name="graph" size={15}/><div><b>来自「{learning.data.title}」</b><span>{brief.selected.length?` · 带入 ${brief.selected.length} 张选中的卡片`:' · 仅带入问题与概念'}</span>{brief.selected.length>0&&<details><summary>查看带入的卡片</summary>{brief.selected.map(id=><p key={id}>{learning.data.nodes.find(n=>n.id===id)?.title??'卡片已不可用'}</p>)}</details>}</div><button type="button" aria-label="移除学习上下文" onClick={()=>{patch({learningId:undefined,selected:[]});setLearning(null)}}><Glyph name="close" size={14}/></button></div>}</>}/>
      <section className="au-results-panel" aria-label="博主推荐结果">
        {!snapshot&&!sending?<><div className="au-directory-heading"><div><h3>学习中发现的作者</h3><p>先了解他们的文章，或从一个问题开始查找。</p></div><button className="au-link-button" onClick={()=>setSection('network')}>查看全部来源<Glyph name="link" size={14}/></button></div>{network?.authors.length?<AuthorCoverflow onOpen={index=>setInspect(network.authors[index].id)} labels={network.authors.slice(0,6).map(a=>a.name)} portraits={network.authors.slice(0,6).map(a=>({name:a.name,src:a.evidence.find(e=>e.avatar)?.avatar,url:a.evidence[0]?.url,title:a.evidence[0]?.title,badge:a.evidence.find(e=>e.badge)?.badge,badgeIcon:a.evidence.find(e=>e.badgeIcon)?.badgeIcon,subtitle:`${a.evidence.length} 篇文章 · ${a.topics.length} 个主题`}))}>{network.authors.slice(0,6).map(a=><button key={a.id} className="au-directory-card" onClick={()=>setInspect(a.id)}><div><AuthorAvatar name={a.name} src={a.evidence.find(e=>e.avatar)?.avatar} sourceUrl={a.evidence[0]?.url}/><span><strong>{a.name}</strong><AuthorBadge text={a.evidence.find(e=>e.badge)?.badge} icon={a.evidence.find(e=>e.badgeIcon)?.badgeIcon} sourceUrl={a.evidence[0]?.url}/></span><Glyph name="chevron" size={14}/></div><p>{a.evidence[0]?.title}</p><footer><span>{a.evidence.length} 篇文章</span><span>{a.topics.length} 个主题</span>{a.topics.reduce((s,t)=>s+t.helpful,0)>0&&<span>你标记过有帮助</span>}</footer></button>)}</AuthorCoverflow>:<div className="au-empty"><Glyph name="search" size={28}/><h3>从一个具体问题开始</h3><p>每次最多推荐 3 位，依据来自真实文章。已有学习来源也会在这里出现。</p></div>}</>:<>
          {(busy||snapshot?.job?.status==='waiting'||snapshot?.job?.status==='cancelled')&&<div className="au-progress" aria-live="polite"><h3>{busy?'正在为这个问题找人':snapshot?.job?.status==='waiting'?'已找到的线索会保留':'这次搜索已停止'}</h3><p>{snapshot?.data.question||brief.question}</p>{phases.map((p,i)=><div key={p} className={i>phaseIndex?'is-next':''}><StatusPill busy={busy&&i===phaseIndex}>{p}</StatusPill></div>)}<div className="au-progress-actions">{busy?<button className="au-link-button" onClick={()=>void taskAction('cancel')} disabled={sending}>停止本次搜索</button>:snapshot?.job?.recoverable?<button className="au-secondary" onClick={()=>void taskAction('resume')}>继续完成</button>:<span>本次重试次数已用完。</span>}</div></div>}
          {completed&&legacy?<div className="au-empty"><h3>这条搜索使用旧版记录</h3><p>问题已填回上方，重新寻找可获得推荐依据与请教简报。</p></div>:completed&&<><header className="au-results-heading"><div><h3>{results.length?`相关博主 · ${results.length} 位`:'暂时没有足够依据推荐人选'}</h3><p>{snapshot!.data.question}</p></div><div className="au-results-switches"><label><input type="checkbox" checked={personal} onChange={e=>setPersonal(e.target.checked)}/>使用积累排序</label><label><input type="checkbox" checked={newOnly} onChange={e=>setNewOnly(e.target.checked)}/>只看新发现</label></div></header><p className="au-ranking-note">{personal?(changed?'同等相关材料中，你的使用与反馈改变了推荐顺序。':'已参考积累；本次暂无足以改变顺序的主题偏好。'):'按本次材料的适配程度排序，不使用偏好加权。'}</p>
            <AuthorCoverflow onOpen={index=>setInspect(results[index].authorId)} labels={results.map(a=>a.authorName)} portraits={results.map(a=>({name:a.authorName,src:a.avatar,url:a.url,title:a.title,badge:a.badge,badgeIcon:a.badgeIcon}))}>{results.map((a,i)=><AuthorMatchCard key={a.authorId} author={a} index={i} onPrepare={()=>setPrepare(a)} onInspect={()=>setInspect(a.authorId)}/>)}</AuthorCoverflow>
            {!results.length&&<div className="au-empty"><Glyph name="search" size={28}/><p>{newOnly?'当前候选中没有新的相关作者，可以继续寻找新的公开材料。':'补充具体情境、已尝试的方法或希望获得的帮助，再找一次。'}</p></div>}
            {!!snapshot!.data.unresolved&&<div className="au-unresolved"><Glyph name="help" size={16}/><p>{snapshot!.data.unresolved}</p></div>}<button className="au-secondary au-explore" onClick={()=>void search(true)} disabled={busy}><Glyph name="refresh" size={15}/>继续寻找新作者</button>
          </>}
        </>}
      </section>
    </>}
    </div></section>{prepare&&snapshot?.data.version===3&&<PrepareAuthor searchId={snapshot.id} author={prepare} brief={snapshot.data.brief} onClose={()=>setPrepare(null)}/>} {selectedAuthor&&<AuthorDetail key={selectedAuthor.id} author={selectedAuthor} onClose={()=>setInspect(null)} onFeedback={feedback} onImported={()=>void loadNetwork().catch(e=>setNotice(e.message))} initialLearningId={brief.learningId}/>}
  </main></ProductWorkspace>
}
