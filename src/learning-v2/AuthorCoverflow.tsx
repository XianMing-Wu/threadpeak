import {Children,isValidElement,useState,useRef,type ReactNode} from 'react'
import {CoverFlow} from '../vendor/coverflow/Coverflow'
import {AuthorAvatar,AuthorBadge} from './AuthorPanels'
import {Glyph} from './atoms'

type Portrait={name:string;src?:string;url?:string;subtitle?:string;title?:string;badge?:string;badgeIcon?:string}
export function AuthorCoverflow({children,labels=[],portraits=[],onOpen}:{children:ReactNode;labels?:string[];portraits?:Portrait[];onOpen?:(index:number)=>void}){
  const cards=Children.toArray(children)
  const keys=cards.map((card,i)=>isValidElement(card)?card.key??i:i)
  const [selectedKey,setSelectedKey]=useState(()=>keys[cards.length>3?Math.floor((cards.length-1)/2):0])
  const detail=useRef<HTMLDivElement>(null)
  const active=Math.max(0,keys.indexOf(selectedKey))
  const setIndex=(index:number)=>setSelectedKey(keys[Math.max(0,Math.min(index,keys.length-1))])
  if(!cards.length)return null
  const items=cards.map((_,i)=>({id:keys[i],image:String(i),title:labels[i]??'来源作者',subtitle:`${i+1} / ${cards.length} · 拖动切换 · 点击查看文章`} ))
  return <section className="au-coverflow" aria-label="推荐博主"><div className="au-coverflow-vendor"><CoverFlow items={items} index={active} onIndexChange={setIndex} itemWidth={270} itemHeight={310} centerGap={215} stackSpacing={72} rotation={50} enableReflection enableScroll enableAudio={false} onItemClick={(_,index)=>{if(onOpen){onOpen(index);return}detail.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'})}} renderImage={props=>{
    const i=Number(props.src),p=portraits[i]
    return <div className="cf-portrait" aria-hidden={props.alt===''||i!==active}><AuthorAvatar name={p?.name??labels[i]??''} src={p?.src} sourceUrl={p?.url}/><strong>{p?.name??labels[i]}</strong><AuthorBadge text={p?.badge} icon={p?.badgeIcon} sourceUrl={p?.url}/><small>{p?.subtitle??'查看作者资料 →'}</small><p>{p?.title??'查看文章与推荐依据'}</p></div>
  }}/></div><div className="au-coverflow-controls"><button aria-label="上一位博主" disabled={!active} onClick={()=>setIndex(active-1)}><Glyph name="back" size={15}/></button><span role="status">{active+1} / {cards.length} · {labels[active]}</span><button aria-label="下一位博主" disabled={active===cards.length-1} onClick={()=>setIndex(active+1)}><Glyph name="back" size={15}/></button></div><div ref={detail} className="au-coverflow-detail">{cards[active]}</div></section>
}
