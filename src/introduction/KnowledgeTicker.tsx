import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArticleCard,ARTICLE_HEIGHT,ARTICLE_WIDTH} from './ticker/ArticleCard';
import {tickerColumns} from './ticker/ticker-content';

// Bundle the same real avatars used by the video, including in the static build.
const assets=import.meta.glob<string>('./ticker/avatars/*',{
 eager:true,query:'?url',import:'default',
});
const assetSource=(path:string)=>{
 const url=assets[`./ticker/${path}`];
 if(!url)throw new Error(`知乎卡片素材缺失：${path}`);
 return url;
};
const WORLD_WIDTH=1440;
const CARD_WIDTH=320;
const CARD_HEIGHT=ARTICLE_HEIGHT*CARD_WIDTH/ARTICLE_WIDTH;
const GAP=30;

export function KnowledgeTicker(){
 const viewport=useRef<HTMLDivElement>(null);
 const[size,setSize]=useState<{scale:number;height:number}|null>(null);

 useEffect(()=>{
  const observer=new ResizeObserver(([entry])=>{
   const {width,height}=entry.contentRect;
   if(width<=0||height<=0)return;
   const next={scale:width/WORLD_WIDTH,height:height*WORLD_WIDTH/width};
   setSize(previous=>previous?.scale===next.scale&&previous.height===next.height?previous:next);
  });
  observer.observe(viewport.current!);
  return()=>observer.disconnect();
 },[]);

 return <section className="knowledge-pane" aria-label="知乎学习观点，三列立体滚动卡片">
  <div className="knowledge-viewport" ref={viewport}>
   {size&&<div className="knowledge-world" style={{width:WORLD_WIDTH,height:size.height,transform:`scale(${size.scale})`}}>
    <div className="knowledge-plane" style={{transform:`perspective(${Math.max(1000,size.height*1.4)}px) rotateX(20deg) scale(1.2)`}}>
     {tickerColumns.map(({cards,durationInSeconds,direction,phase},i)=>{
      const distance=cards.length*(CARD_HEIGHT+GAP);
      // Include the trailing gap in the wrap distance. Tracks stay mounted;
      // the next identical domain takes over without a player or React updates.
      const copies=Math.ceil(size.height/distance)+1;
      return <div className="knowledge-column" key={i} style={{width:CARD_WIDTH}}>
       <div className="knowledge-track" data-ticker-column={i} style={{
        '--ticker-distance':`${distance}px`,
        '--ticker-start':`${direction===-1?-phase*distance:(phase-1)*distance}px`,
        animationDuration:`${durationInSeconds}s`,animationDelay:`${-phase*durationInSeconds}s`,
        animationDirection:direction===-1?'normal':'reverse',
       } as CSSProperties}>
        {Array.from({length:copies},(_,copy)=><div className="knowledge-domain" data-ticker-domain key={copy} aria-hidden={copy>0?true:undefined} style={{height:distance,gap:GAP,paddingBottom:GAP}}>
         {cards.map(card=><div data-live-card={card.id} key={card.id} style={{height:CARD_HEIGHT,flexShrink:0}}>
          <ArticleCard data={card} width={CARD_WIDTH} assetSource={assetSource} nativeImages/>
         </div>)}
        </div>)}
       </div>
      </div>;
     })}
    </div>
    <div className="knowledge-fade knowledge-fade-top"/>
    <div className="knowledge-fade knowledge-fade-bottom"/>
   </div>}
  </div>
 </section>;
}
