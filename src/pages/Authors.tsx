import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthorNetworkGraph } from '../components/AuthorNetworkGraph'
import { ProductWorkspace } from '../components/Shell'
import { authorSkies, consultationContexts, type ConstellationAuthor, type ConsultationRecommendation } from '../data'
import { Icon } from '../icons'
import { runAuthorGraphRag, type GraphRagResult } from '../session/author-graph-rag'
import { readAnnotationStore } from '../session/ask-authors'
import { hydrateNetworkFromAnnotations, useAuthorNetwork, type AuthorNetworkStore } from '../session/author-network'

type ScanPhase = 'idle' | 'scanning' | 'complete'
type AuthorSection = 'search' | 'network'

type AdvisorProfile = ConstellationAuthor & {
  tags:string[]
  match:number
  trust:number
  evidence:number
  rank:number
  recommendation?:ConsultationRecommendation
  x:number
  y:number
}

type RelatedArticle = { title:string; summary:string; href:string }

const tagPalette=['#1772f6','#3f8cff','#6aa6f8','#8ab9f5']
const center={x:390,y:236}

function hashOffset(value:string) {
  return [...value].reduce((sum,char)=>sum+char.charCodeAt(0),0)%29-14
}

function advisorPosition(tagIndex:number,tagCount:number,score:number,id:string,groupIndex:number,groupSize:number) {
  const baseAngle=-140+(tagCount===1?140:tagIndex*(280/(tagCount-1)))
  const fan=(groupIndex-(groupSize-1)/2)*16
  const angle=baseAngle+fan+hashOffset(id)*.18
  const radius=Math.min(225,166+(100-score)*1.7+(groupIndex%2)*24)
  const radians=angle*Math.PI/180
  return {
    x:Math.max(46,Math.min(734,center.x+Math.cos(radians)*radius)),
    y:Math.max(48,Math.min(424,center.y+Math.sin(radians)*radius)),
  }
}

function relatedArticles(author:AdvisorProfile):RelatedArticle[] {
  const candidates=[
    {title:author.work,summary:author.description},
    ...author.tags.slice(1,2).map((tag)=>({title:`${author.name}：${tag}相关内容`,summary:`继续查看 ${author.name} 在「${tag}」下的公开知乎内容。`})),
  ]
  return candidates.map((article)=>({
    ...article,
    href:`https://www.zhihu.com/search?type=content&q=${encodeURIComponent(article.title)}`,
  }))
}

export function AuthorsPage() {
  const [section,setSection]=useState<AuthorSection>('search')
  const [rag,setRag]=useState<GraphRagResult|null>(null)
  const network=useAuthorNetwork()
  const ragToken=useRef(0)
  useEffect(()=>{hydrateNetworkFromAnnotations(readAnnotationStore().items)},[])

  const searchRelatedAuthors=(query:string)=>{
    const token=ragToken.current+1
    ragToken.current=token
    void runAuthorGraphRag(query,network,(next)=>{
      if(ragToken.current!==token)return
      setRag(next)
    })
  }

  return <ProductWorkspace active="authors" page="authors">
    <main className="consultation-page">
      <header className="consultation-header">
        <h1>博主网络</h1>
        <p>{section==='network'?'载体层下是概念层，概念层下是问题层；博主可以挂在不同的载体层、概念层或问题层':'从一个具体问题出发，逐步找到最值得咨询的知乎博主'}</p>
      </header>
      <div className="square-tabs author-tabs">
        <button type="button" className={section==='search'?'is-active':''} onClick={()=>setSection('search')}>搜索博主</button>
        <button type="button" className={section==='network'?'is-active':''} onClick={()=>setSection('network')}>博主网络</button>
      </div>
      {section==='search'?<AuthorSearchPane onGraphRagSearch={searchRelatedAuthors}/>:<AuthorNetworkPane store={network} rag={rag}/>}
    </main>
  </ProductWorkspace>
}

function AuthorSearchPane({onGraphRagSearch}:{onGraphRagSearch:(query:string)=>void}) {
  const sky=authorSkies[0]
  const context=consultationContexts[0]
  const [hovered,setHovered]=useState('')
  const [selected,setSelected]=useState('')
  const [query,setQuery]=useState('')
  const [searchOpen,setSearchOpen]=useState(true)
  const [scanPhase,setScanPhase]=useState<ScanPhase>('idle')
  const [revealedCount,setRevealedCount]=useState(0)

  const recommendationMap=useMemo(()=>new Map(context.recommendations.map((item,index)=>[item.authorId,{...item,rank:index+1}])),[context])
  const advisors=useMemo<AdvisorProfile[]>(()=>{
    const candidates=sky.authors.filter((author)=>author.carrierId!=='self')
    const primaryTagIndexes=candidates.map((author)=>Math.max(0,sky.concepts.findIndex((concept)=>concept.authors.includes(author.id))))
    const groupCounts=primaryTagIndexes.reduce((counts,index)=>counts.set(index,(counts.get(index)??0)+1),new Map<number,number>())
    const groupSeen=new Map<number,number>()
    return candidates.map((author,index)=>{
      const tags=sky.concepts.filter((concept)=>concept.authors.includes(author.id)).map((concept)=>concept.title)
      const recommendation=recommendationMap.get(author.id)
      const trust=recommendation?.trust??Math.min(82,38+author.size*4+tags.length*4)
      const match=recommendation?.match??Math.max(56,84-index*1.45+tags.length*2)
      const tagIndex=primaryTagIndexes[index]
      const groupIndex=groupSeen.get(tagIndex)??0
      groupSeen.set(tagIndex,groupIndex+1)
      return {
        ...author,
        tags,
        match:Math.round(match),
        trust:Math.round(trust),
        evidence:recommendation?.evidence??Math.max(1,tags.length+1),
        rank:recommendation?.rank??99,
        recommendation,
        ...advisorPosition(tagIndex,sky.concepts.length,match,author.id,groupIndex,groupCounts.get(tagIndex)??1),
      }
    })
  },[recommendationMap,sky])

  const revealOrder=useMemo(()=>[...advisors].sort((a,b)=>b.match-a.match),[advisors])
  const mapAdvisors=scanPhase==='complete'?advisors:scanPhase==='scanning'?revealOrder.slice(0,revealedCount):[]
  const ranking=revealOrder.slice(0,3)
  const selectedAuthor=advisors.find((author)=>author.id===selected)
  const activeId=hovered||selected
  const conceptCount=scanPhase==='complete'?sky.concepts.length:scanPhase==='scanning'?Math.min(sky.concepts.length,Math.ceil(revealedCount/3)):0
  const dynamicConcepts=sky.concepts.slice(0,conceptCount)

  useEffect(()=>{
    if(scanPhase!=='scanning')return
    const timer=window.setInterval(()=>{
      setRevealedCount((count)=>{
        if(count>=advisors.length){
          window.clearInterval(timer)
          setScanPhase('complete')
          return count
        }
        return count+1
      })
    },260)
    return()=>window.clearInterval(timer)
  },[advisors.length,scanPhase])

  const openSearch=()=>{
    if(scanPhase==='scanning')return
    setSelected('')
    setHovered('')
    setRevealedCount(0)
    setScanPhase('idle')
    setQuery('')
    setSearchOpen(true)
  }

  const startRadar=()=>{
    if(!query.trim()||scanPhase==='scanning')return
    const asked=query
    setSelected('')
    setHovered('')
    setRevealedCount(0)
    setSearchOpen(false)
    setQuery('')
    setScanPhase('scanning')
    onGraphRagSearch(asked)
  }

  return <section className="consultation-body">
    <section className="consultation-map-panel">
      <div className="consultation-map-wrap">
        <svg className="consultation-map" viewBox="0 0 780 470" role="img" aria-label="博主网络雷达图" onClick={()=>setSelected('')}>
          <defs>
            <radialGradient id="consultation-bg" cx="50%" cy="50%"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#f7f9fc"/></radialGradient>
            <filter id="advisor-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#2f6fb6" floodOpacity=".17"/></filter>
          </defs>
          <rect width="780" height="470" rx="14" fill="url(#consultation-bg)"/>
          <g className="consultation-radar" aria-hidden="true">
            {[72,142,212].map((radius)=><circle key={radius} cx={center.x} cy={center.y} r={radius}/>) }
            {dynamicConcepts.map((concept)=>{
              const originalIndex=sky.concepts.findIndex((item)=>item.id===concept.id)
              const angle=(-140+(sky.concepts.length===1?140:originalIndex*(280/(sky.concepts.length-1))))*Math.PI/180
              const x=center.x+Math.cos(angle)*224
              const y=center.y+Math.sin(angle)*224
              return <g key={concept.id} className="radar-concept is-visible"><line x1={center.x} y1={center.y} x2={x} y2={y}/><text x={center.x+Math.cos(angle)*243} y={center.y+Math.sin(angle)*243}>{concept.title}</text></g>
            })}
          </g>

          {scanPhase==='scanning'&&<g className="radar-sweep" aria-hidden="true">
            <path d="M390 236 L390 24 A212 212 0 0 1 540 86 Z"/>
            <line x1="390" y1="236" x2="390" y2="24"/>
          </g>}

          <g className="consultation-evidence-lines">
            {mapAdvisors.map((author)=>activeId===author.id&&<g key={author.id} className="is-visible">
              <line x1={center.x} y1={center.y} x2={author.x} y2={author.y}/>
            </g>)}
          </g>

          <g className="consultation-advisors">
            {mapAdvisors.map((author)=>{
              const active=activeId===author.id
              const dimmed=Boolean(activeId)&&!active
              const radius=12+author.trust/20
              return <g
                key={author.id}
                role="button"
                tabIndex={0}
                aria-label={`${author.name}，${author.match}%问题匹配`}
                className={`consultation-advisor is-revealed ${active?'is-active':''} ${dimmed?'is-dimmed':''} ${author.rank<=3?'is-recommended':''}`}
                transform={`translate(${author.x} ${author.y})`}
                onClick={(event)=>{event.stopPropagation();setSelected(author.id)}}
                onMouseEnter={()=>setHovered(author.id)}
                onMouseLeave={()=>setHovered('')}
                onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();setSelected(author.id)}}}
              >
                <circle className="advisor-aura" r={radius+10}/>
                {author.tags.slice(0,3).map((tag,index)=>{
                  const segment=82/Math.min(3,author.tags.length)
                  return <circle key={tag} className="advisor-tag-ring" r={radius+5} pathLength="100" stroke={tagPalette[index]} strokeDasharray={`${segment} ${100-segment}`} strokeDashoffset={-index*(100/Math.min(3,author.tags.length))}/>
                })}
                <circle className="advisor-core" r={radius} filter="url(#advisor-shadow)"/>
                <text className="advisor-short" y="4">{author.short}</text>
                {author.rank<=3&&<g className="advisor-rank" transform={`translate(${radius+5} ${-radius-5})`}><circle r="8"/><text y="3">{author.rank}</text></g>}
                <text className="advisor-name" y={radius+19}>{author.name}</text>
                <text className="advisor-score" y={-radius-12}>{author.match}% 匹配</text>
              </g>
            })}
          </g>
        </svg>

        {searchOpen?<form className="radar-query" onSubmit={(event)=>{event.preventDefault();startRadar()}}>
          <Icon name="search" size={20}/>
          <input autoFocus aria-label="输入想咨询博主的问题" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="你想找博主咨询什么？"/>
          <button type="button" aria-label="开始找博主" disabled={!query.trim()} onClick={startRadar}><Icon name="send" size={19}/></button>
        </form>:<button
          className={`radar-search-trigger ${scanPhase==='scanning'?'is-scanning':''}`}
          aria-label={scanPhase==='scanning'?'正在找博主':'输入问题找博主'}
          disabled={scanPhase==='scanning'}
          onClick={openSearch}
        ><Icon name="search" size={24}/></button>}
      </div>
    </section>

    <aside className="consultation-sidebar">
      {selectedAuthor?<AdvisorDetail author={selectedAuthor} onBack={()=>setSelected('')}/>:scanPhase!=='complete'?<section className="radar-search-status" aria-live="polite">
        <span className={`radar-status-icon ${scanPhase==='scanning'?'is-scanning':''}`}><Icon name={scanPhase==='scanning'?'search':'network'} size={21}/></span>
        <small>{scanPhase==='scanning'?'雷达搜索中':'从一个具体问题开始'}</small>
        <h2>{scanPhase==='scanning'?`已找到 ${revealedCount} 位可咨询博主`:'你想咨询谁，先由问题来决定'}</h2>
        <p>{scanPhase==='scanning'?'正在对齐问题中的概念、公开内容与博主专长。':'问题越具体，找到的博主和原文证据就越准确。发送后，雷达会按匹配度逐个显露博主。'}</p>
        {scanPhase==='scanning'&&<div className="radar-found-list">{mapAdvisors.slice(0,4).map((author)=><span key={author.id}><i>{author.short}</i>{author.name}<b>{author.match}%</b></span>)}</div>}
      </section>:<>
        <header><span>优先推荐</span><h2>最值得咨询的3位博主</h2><p>综合本次问题、相关公开内容和作者擅长领域排序。</p></header>
        <div className="consultation-ranking">
          {ranking.map((author,index)=><button key={author.id} onClick={()=>setSelected(author.id)}>
            <span className="ranking-index">{index+1}</span><span className="ranking-avatar">{author.short}</span>
            <span className="ranking-copy"><b>{author.name}</b><small>{author.tags.slice(0,2).join(' · ')}</small><em>{author.recommendation?.reason??author.description}</em></span>
            <strong>{author.match}<small>%</small></strong>
          </button>)}
        </div>
      </>}
    </aside>
  </section>
}

function AuthorNetworkPane({store,rag}:{store:AuthorNetworkStore;rag:GraphRagResult|null}) {
  const highlight=rag&&(rag.stage==='ready'||rag.stage==='ranking'||rag.stage==='expanding')
    ?{nodeIds:rag.subgraph.nodeIds,edgeIds:rag.subgraph.edgeIds}
    :null
  return <section className="consultation-body is-network">
    <div className="author-network-pane">
      <AuthorNetworkGraph nodes={store.nodes} edges={store.edges} highlight={highlight}/>
    </div>
  </section>
}

function AdvisorDetail({author,onBack}:{author:AdvisorProfile;onBack:()=>void}) {
  const articles=relatedArticles(author)
  const profile=author.recommendation
    ? `${author.description}${author.recommendation.reason}`
    : `他曾帮助解释 ${author.tags.join('、')} 等问题。${author.description}`
  return <section className="advisor-detail" aria-label={`${author.name}的咨询卡片`}>
    <button className="advisor-detail-back" onClick={onBack}><Icon name="back" size={16}/>返回推荐</button>
    <div className="advisor-detail-person"><span>{author.short}</span><div><small>{author.role}</small><h2>{author.name}</h2></div><strong>{author.match}%<small>问题匹配</small></strong></div>
    <section className="advisor-profile"><h3>角色简介</h3><p>{profile}</p></section>
    <section className="advisor-related"><h3>相关内容</h3><div>{articles.map((article)=><a key={article.title} href={article.href} target="_blank" rel="noreferrer">
      <Icon name="book" size={17}/><span><b>{article.title}</b><small>{article.summary}</small><em>知乎相关内容</em></span><Icon name="arrow-right" size={15}/>
    </a>)}</div></section>
  </section>
}
