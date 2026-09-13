import {projectScenario} from './learning-story-content';
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {ScrollTransition} from './scroll-transition';
import {CardAvatar} from './LearningCardModel';
import {lerp,part} from './learning-motion';
import {consultationAt,consultationLens,consultationAvatar,consultationFit,consultationPointer,CONSULTATION_START,CONSULTATION_END,type AvatarOrigin} from './consultation-motion';
import {consultationAuthors,consultationDraftFor,consultationQuestion} from './consultation-content';
import {seekStory} from './scroll-transition';
import heading from './assets/consultation-heading.svg';
import './consultation.css';
import {ConsultationGlyph} from './ConsultationGlyph';
import {ConsultationAuthorDetails,type AuthorDetailTab} from './ConsultationAuthorDetails';
import {clampConsultationIndex,consultationOrbitCard} from './consultation-motion';

function Mark({kind='book'}:{kind?:string}){
 const paths:Record<string,string>={book:'M3 5Q8 3 12 6Q17 3 21 5V20Q17 18 12 21Q8 18 3 20ZM12 6V21',message:'M4 4H20V17H11L6 21V17H4Z',arrow:'M5 12H19M13 6L19 12L13 18',search:'M15 15L21 21M17 10A7 7 0 1 0 3 10A7 7 0 1 0 17 10',check:'M5 12L10 17L20 6',copy:'M8 4H20V18H8ZM4 8V22H15',plus:'M12 4V20M4 12H20',close:'M5 5L19 19M19 5L5 19'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]??paths.book}/></svg>;
}
function Shell({id='profile'}:{id?:string}){
 return <svg className="consult-shell" viewBox="0 0 300 320" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={`consult-paper-${id}`} x2=".35" y2="1"><stop stopColor="#f8fbff"/><stop offset=".42" stopColor="#fff"/></linearGradient><linearGradient id={`consult-rim-${id}`}><stop stopColor="#b4f2e0"/><stop offset=".65" stopColor="#477fe3"/><stop offset="1" stopColor="#f2ffff"/></linearGradient></defs><rect className="consult-paper-face" x="1" y="1" width="298" height="318" rx="18" fill={`url(#consult-paper-${id})`} stroke="#dce3eb" vectorEffect="non-scaling-stroke"/><rect className="consult-rim" x="1" y="1" width="298" height="318" rx="18" fill="none" stroke={`url(#consult-rim-${id})`} pathLength="100" vectorEffect="non-scaling-stroke"/></svg>;
}
function Profile({i,mirror=false,onSelect}:{i:number;mirror?:boolean;onSelect?:(i:number)=>void}){
 const a=consultationAuthors[i],Tag=mirror?'div':'button';
 return <Tag className="consult-profile" data-consult-profile={i} data-author-evidence={a.evidenceId} {...(!mirror?{type:'button' as const,onClick:()=>onSelect?.(i),'aria-label':`查看${a.name}的作者卡片`}:{})}>
  <Shell id={`${mirror?'mirror':'source'}-${i}`}/>
  <div className="consult-profile-ink"><span className="consult-avatar"><CardAvatar name={a.name} src={a.avatar}/></span><strong className="consult-author-name">{a.name}</strong><span className="consult-author-topic">{a.topic}</span><span className="consult-profile-rule"/><span className="consult-source-title">{a.title}</span><ConsultationGlyph i={i} mirror={mirror}/><span className="consult-source-kicker"><Mark/>知乎 · 公开文章</span><span className="consult-fit"><Mark kind="check"/>公开资料</span></div>
 </Tag>;
}
const show=(el:HTMLElement,value:number)=>{el.style.opacity=String(value);el.style.visibility=value>.001?'visible':'hidden';el.setAttribute('aria-hidden',String(value<=.001));};
const place=(el:HTMLElement,b:{x:number;y:number;w:number;h:number})=>{el.style.left=`${b.x}px`;el.style.top=`${b.y}px`;el.style.width=`${b.w}px`;el.style.height=`${b.h}px`;};
const seek=seekStory;
export function ConsultationStoryScene({transition}:{transition:RefObject<ScrollTransition>}){
 const host=useRef<HTMLElement>(null),[selected,setSelected]=useState(2),[expanded,setExpanded]=useState(false),[copied,setCopied]=useState(''),[purpose,setPurpose]=useState('consult');
 const selection=useRef(selected),intent=useRef(purpose),edits=useRef(new Map<string,string>()),a=consultationAuthors[selected];selection.current=selected;intent.current=purpose;
 const draftRef=useRef<HTMLTextAreaElement>(null);
 const [detailTab,setDetailTab]=useState<AuthorDetailTab>('sources'),expandedRef=useRef(false);expandedRef.current=expanded;
 const openDetails=(tab:AuthorDetailTab='sources')=>{manual.current={mode:'evidence',since:performance.now()};setDetailTab(tab);setExpanded(true);};
 const closeDetails=()=>{manual.current={mode:'evidence',since:performance.now()};setExpanded(false);};
 const visualIndex=useRef(2),drag=useRef({active:false,suppress:false,x:0,start:2,lastX:0,lastTime:0,velocity:0}),manual=useRef<{mode:'evidence'|'draft';since:number}|null>(null);
 const choose=(i:number)=>{const next=clampConsultationIndex(i);if(next===selection.current)return;selection.current=next;setSelected(next);setExpanded(false);setCopied('');manual.current={mode:'evidence',since:performance.now()};};
 const openCard=(i:number)=>{if(drag.current.suppress)return;if(i===selection.current)openDetails();else choose(i);};
 const prepare=()=>{setExpanded(false);setCopied('');manual.current={mode:'draft',since:performance.now()};};
 useEffect(()=>{
  const el=host.current!,stage=el.querySelector<HTMLElement>('.consult-stage')!,deck=el.querySelector<HTMLElement>('.consult-deck')!;
  const cards=[...deck.querySelectorAll<HTMLElement>('[data-consult-profile]')],copies=[...el.querySelectorAll<HTMLElement>('.consult-lens-copy [data-consult-profile]')];
  const travelers=[...el.querySelectorAll<HTMLElement>('.consult-traveler')],title=el.querySelector<HTMLElement>('.consult-heading')!,composer=el.querySelector<HTMLElement>('.consult-composer')!,question=el.querySelector<HTMLElement>('.consult-question-text')!;
  const panel=el.querySelector<HTMLElement>('.consult-detail')!,evidence=el.querySelector<HTMLElement>('.consult-evidence')!,draft=el.querySelector<HTMLElement>('.consult-draft')!,lens=el.querySelector<HTMLElement>('.consult-lens')!,lensCopy=el.querySelector<HTMLElement>('.consult-lens-copy')!,pointer=el.querySelector<HTMLElement>('.consult-pointer')!,context=el.querySelector<HTMLElement>('.consult-context')!;
  const introduction=title.querySelector<HTMLElement>('p')!;
  let width=0,height=0,frame=0,last=0,time=0,orbitTime=0,wasActive=false,realOrigins=false,origins:AvatarOrigin[]=[],lastAutoView='';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const resize=new ResizeObserver(()=>{width=el.clientWidth;height=el.clientHeight;});resize.observe(el);
  function tick(now:number){
   const raw=transition.current.progress,active=raw>=CONSULTATION_START&&raw<CONSULTATION_END,dt=last?Math.min(.05,(now-last)/1000):0;last=now;
   el.dataset.active=String(active);
   if(!active){el.inert=true;el.style.visibility='hidden';el.setAttribute('aria-hidden','true');if(wasActive){origins=[];realOrigins=false;lastAutoView='';manual.current=null;setExpanded(false);}wasActive=false;frame=requestAnimationFrame(tick);return;}
   wasActive=true;
   if(width&&height&&!document.hidden){
    el.inert=false;el.style.visibility='visible';el.setAttribute('aria-hidden','false');
    const f=consultationFit(width,height),s=consultationAt(raw,f.narrow,selection.current),cur=consultationPointer(raw,f.narrow);
    if(raw<48.2){if(selection.current!==2)setSelected(2);selection.current=2;visualIndex.current=2;manual.current=null;}
    if(!drag.current.active)visualIndex.current=reduced.matches?selection.current:lerp(visualIndex.current,selection.current,1-Math.exp(-dt*10));
    const lower=Math.floor(visualIndex.current),upper=Math.min(5,lower+1),blend=visualIndex.current-lower,lo=consultationAt(raw,f.narrow,lower),hi=consultationAt(raw,f.narrow,upper);
    s.cards=s.cards.map((card,i)=>({...card,...Object.fromEntries(['x','y','w','h','angle','opacity'].map(k=>[k,lerp(lo.cards[i][k as 'x'],hi.cards[i][k as 'x'],blend)]))}));
    const override=manual.current,manualAge=override?(now-override.since)/1000:0,isDraft=override?override.mode==='draft':raw>=55.5;
    if(!override){const view=raw>=51.15&&raw<52.15?'sources':raw>=52.15&&raw<53.2?'footprints':raw>=53.2&&raw<54.35?'reading':'evidence';if(view!==lastAutoView){lastAutoView=view;setExpanded(view!=='evidence');if(view!=='evidence')setDetailTab(view as AuthorDetailTab);}}
    const draftInk=override?Math.min(1,manualAge/3.2):s.draftInk,evidenceInk=override?1:s.evidenceInk;
    const draftVisible=isDraft?(override?Math.min(1,manualAge*4):part(raw,55.5,56)):0;
    if(!origins.length||(!realOrigins&&raw<42.2)){
     const root=el.getBoundingClientRect();
     let captured=0;origins=consultationAuthors.slice(0,3).map((author,i)=>{const n=document.querySelector<HTMLElement>(`.space-author[data-author-id="${author.id}"] .space-portrait`),r=n?.getBoundingClientRect();if(r&&r.width>2)captured++;
      return r&&r.width>2?{x:(r.x+r.width/2-root.x)/width,y:(r.y+r.height/2-root.y)/height,size:r.width/width}:{x:.68+i*.06,y:.26+(i%2)*.04,size:.026};});
     realOrigins=captured===3;el.dataset.avatarOriginSource=realOrigins?'network':'deep-link';el.dataset.avatarCapture=origins.map(o=>`${o.x.toFixed(4)},${o.y.toFixed(4)},${o.size.toFixed(4)}`).join(';');
    }
    if(!reduced.matches){time+=dt;if(raw>=44.6&&raw<47.7)orbitTime+=dt*part(raw,44.6,44.9)*(1-part(raw,47.0,47.7));}
    el.dataset.raw=raw.toFixed(4);el.dataset.phase=raw<42.6?'handoff':raw<43.75?'discover':raw<46.08?'question':raw<48.2?'scan':raw<55.3?'evidence':'draft';el.dataset.selected=String(selection.current);el.dataset.narrow=String(f.narrow);
    stage.style.width=`${f.W}px`;stage.style.height=`${f.H}px`;stage.style.transform=`translate3d(${f.x}px,${f.y}px,0) scale(${f.s})`;
    el.style.background=`rgb(255 255 255 / ${part(raw,40.75,42.25)})`;el.style.opacity=String(1-part(raw,58.75,59.5));
    if(raw<48.2&&expandedRef.current)setExpanded(false);
    title.style.left=f.narrow?'52px':'90px';title.style.top=f.narrow?'25px':'26px';show(title,s.title);title.style.transform=`translateY(${(1-s.title)*12}px)`;
    cards.forEach((n,i)=>{
     const c=s.cards[i],orbitMix=f.narrow?0:part(raw,43.32,43.72)*(1-s.focus);
     if(orbitMix>0){const o=consultationOrbitCard(i,orbitTime*part(raw,44.6,44.9),raw);for(const k of ['x','y','w','h','angle'] as const)c[k]=lerp(c[k],o[k],orbitMix);}
     const breathe=reduced.matches?0:Math.sin(time*.76+i*.95)*1.6*c.ink*(1-s.focus)*part(raw,43.2,43.8);
     for(const element of[n,copies[i]]){place(element,c);element.style.transform=`perspective(1100px) rotateY(${c.angle}deg) translateY(${breathe}px) scale(${1-(i===2?s.cardPress:0)*.018})`;element.style.zIndex=String(Math.round(lerp(30-Math.abs(i-visualIndex.current)*2,30-Math.abs(c.x+c.w/2-700)/100,orbitMix)));element.style.setProperty('--consult-card-width',`${c.w}px`);element.style.setProperty('--consult-card-height',`${c.h}px`);element.style.setProperty('--consult-focus',String(s.focus));element.style.setProperty('--consult-nearness',String(Math.max(0,Math.min(1,(c.w-(f.narrow?172:180))/(f.narrow?108:120)))));show(element,c.opacity*Math.min(1,c.shell*4));element.style.setProperty('--consult-shell-x',String(lerp(.20,1,part(c.shell,0,.77))));element.style.setProperty('--consult-shell-y',String(lerp(.04,1,part(c.shell,.12,1))));element.style.setProperty('--consult-ink',String(c.ink));element.style.setProperty('--consult-rise',`${(1-c.ink)*9}px`);element.style.setProperty('--consult-light',String(part(c.shell,.1,.25)*(1-part(c.shell,.88,1))));element.style.setProperty('--consult-lap',String(-c.shell*125));element.dataset.settled=String(c.shell>.99);element.dataset.selected=String(c.selected&&raw>48.18);element.dataset.interactive=String(raw>=49.5);element.style.setProperty('--consult-result',String(s.results));element.querySelector<HTMLElement>('.consult-avatar')!.style.opacity=String(i<3?part(raw,42.05+i*.09,42.19+i*.09):c.ink);}
     n.inert=raw<49.4;n.tabIndex=raw>=49.4?0:-1;n.setAttribute('aria-pressed',String(c.selected&&raw>48.18));
     if(i>=3)return;
     const origin=origins[i],target={x:f.x+(c.x+c.w/2)*f.s,y:f.y+(c.y+(f.narrow?44:53))*f.s,size:(f.narrow?52:62)*f.s},from={x:origin.x*width,y:origin.y*height,size:origin.size*width},av=consultationAvatar(raw,i,from,target);
     place(travelers[i],{x:av.x-av.size/2,y:av.y-av.size/2,w:av.size,h:av.size});show(travelers[i],part(raw,40.4,40.46)*(1-part(raw,42.05+i*.09,42.19+i*.09)));
    });
    place(composer,s.composer);show(composer,s.composerIn);composer.inert=s.composerIn<.95;composer.style.transform=`translateY(${(1-part(raw,43.1,43.6))*17}px)`;composer.dataset.focused=String(s.fieldFocus>.1);composer.style.setProperty('--press',String(s.searchPress));question.textContent=consultationQuestion.slice(0,Math.floor(consultationQuestion.length*s.question));question.dataset.typing=String(raw>=43.82&&raw<45.8);
    const searchButton=el.querySelector<HTMLElement>('.consult-search')!;searchButton.dataset.busy=String(s.searching);searchButton.setAttribute('aria-label',s.searching?'正在核对公开材料':'找博主');
    const status=el.querySelector<HTMLElement>('.consult-search-status')!;status.textContent=s.searching?'结合卡点核对公开材料':s.results>.5?'查看适配依据与覆盖边界':'从学习记录里，接着找人';
    show(introduction,1-part(raw,47.9,48.15));introduction.setAttribute('aria-hidden',String(raw>=48.15));
    context.style.left=`${f.narrow?52:90}px`;context.style.top=`${f.narrow?155:169}px`;context.style.width=`${f.narrow?594:1150}px`;show(context,part(raw,48.25,49.1));
    place(panel,s.panel);show(panel,s.panelIn);panel.style.setProperty('--panel-grow',String(lerp(.92,1,s.panelIn)));panel.style.setProperty('--prepare-press',String(s.preparePress));panel.dataset.draft=String(isDraft);panel.inert=s.panelIn<.95;
    const detail=el.querySelector<HTMLElement>('.consult-author-details')!,detailsOpen=expandedRef.current&&!isDraft;show(evidence,detailsOpen?0:1-draftVisible);evidence.inert=isDraft||detailsOpen;show(detail,detailsOpen?1:0);detail.inert=!detailsOpen;show(draft,draftVisible);draft.inert=!isDraft;el.dataset.panelMode=isDraft?'draft':detailsOpen?'details':'evidence';
    const streams=[...evidence.querySelectorAll<HTMLElement>('[data-consult-stream]')];const total=streams.reduce((n,e)=>n+(e.dataset.full?.length??0),0),limit=Math.floor(total*evidenceInk);let used=0;
    streams.forEach(e=>{const full=e.dataset.full??'',count=Math.max(0,Math.min(full.length,limit-used));if(e.textContent!==full.slice(0,count))e.textContent=full.slice(0,count);e.dataset.typing=String(count>0&&count<full.length);used+=full.length;});
    if(draftRef.current){const full=consultationDraftFor(selection.current,intent.current),text=edits.current.get(`${selection.current}:${intent.current}`)??full.slice(0,Math.floor(full.length*draftInk));if(draftRef.current.value!==text){draftRef.current.value=text;if(isDraft&&draftInk<1)draftRef.current.scrollTop=draftRef.current.scrollHeight;}draftRef.current.readOnly=draftInk<1;draftRef.current.dataset.streaming=String(isDraft&&draftInk<1);}
    const wire=el.querySelector<SVGSVGElement>('.consult-evidence-wire')!,card=s.cards[selection.current],path=f.narrow?`M${card.x+card.w/2} ${card.y+card.h} V${s.panel.y}`:`M${card.x+card.w} ${card.y+card.h-25} H${s.panel.x}`;wire.setAttribute('viewBox',`0 0 ${f.W} ${f.H}`);wire.querySelectorAll('path').forEach(p=>p.setAttribute('d',path));wire.style.opacity=String(part(raw,49.65,49.95));wire.style.setProperty('--wire-progress',String(1-part(raw,49.65,49.95)));wire.style.setProperty('--wire-travel',String(-part(raw,49.65,50.1)*120));
    const footer=el.querySelector<HTMLElement>('.consult-draft-footer')!;show(footer,draftInk===1?1:0);footer.inert=draftInk<1;
    const nav=el.querySelector<HTMLElement>('.consult-deck-nav')!;nav.style.left=f.narrow?'210px':'150px';nav.style.top=f.narrow?'663px':'679px';show(nav,part(raw,49.2,49.45));nav.inert=raw<49.5;deck.tabIndex=raw>=49.5?0:-1;deck.dataset.interactive=String(raw>=49.5);
    const sample=consultationLens(raw,s.cards);s.lens.x=sample.x;s.lens.y=sample.y;lens.dataset.author=String(sample.index+1);
    lens.style.transform=`translate3d(${s.lens.x-78}px,${s.lens.y-78}px,0)`;show(lens,s.lens.opacity);lensCopy.style.width=`${f.W}px`;lensCopy.style.height=`${f.H}px`;lensCopy.style.transform=`translate3d(${70-s.lens.x*1.55}px,${70-s.lens.y*1.55}px,0) scale(1.55)`;lens.dataset.zoom='1.55';lens.dataset.sample=`${s.lens.x.toFixed(3)},${s.lens.y.toFixed(3)}`;
    if(raw>=47.8&&raw<49){const selectedCard=s.cards[2];cur.x=selectedCard.x+selectedCard.w*.58;cur.y=selectedCard.y+selectedCard.h*.47;}
    pointer.style.transform=`translate3d(${cur.x}px,${cur.y}px,0) scale(${1-cur.press*.12})`;show(pointer,override?0:Math.min(1,cur.opacity));
    const clickAt=(at:number)=>override?0:part(raw,at-.1,at)*(1-part(raw,at+.03,at+.19));
    evidence.querySelector<HTMLElement>('.consult-text-button')!.style.setProperty('--demo-press',String(clickAt(51.15)));
    el.querySelectorAll<HTMLElement>('.consult-inline-tabs button').forEach((n,i)=>n.style.setProperty('--demo-press',String(i===1?clickAt(52.15):0)));
    el.querySelector<HTMLElement>('.consult-author-details header button')!.style.setProperty('--demo-press',String(clickAt(54.35)));
    el.querySelector<HTMLElement>('.consult-footprint-path li:last-child button')?.style.setProperty('--demo-press',String(clickAt(53.2)));
   }
   frame=requestAnimationFrame(tick);
  }
  const interactive=()=>transition.current.progress>=49.5;
  const pointerDown=(e:PointerEvent)=>{if(!interactive()||e.button!==0)return;drag.current={active:false,suppress:false,x:e.clientX,start:visualIndex.current,lastX:e.clientX,lastTime:e.timeStamp,velocity:0};};
  const pointerMove=(e:PointerEvent)=>{if(!interactive()||e.buttons!==1)return;const d=drag.current,scale=consultationFit(width,height).s;
   if(!d.active&&Math.abs(e.clientX-d.x)>7){d.active=true;d.suppress=true;deck.setPointerCapture(e.pointerId);}
   if(d.active){visualIndex.current=clampConsultationIndex(d.start-(e.clientX-d.x)/(190*scale));d.velocity=(e.clientX-d.lastX)/Math.max(1,e.timeStamp-d.lastTime);d.lastX=e.clientX;d.lastTime=e.timeStamp;deck.dataset.dragging='true';}
  };
  const pointerUp=(e:PointerEvent)=>{const d=drag.current;if(d.active){d.active=false;const momentum=e.type==='pointercancel'?0:Math.max(-.65,Math.min(.65,d.velocity*.55));choose(Math.round(visualIndex.current-momentum));deck.dataset.dragging='false';if(deck.hasPointerCapture(e.pointerId))deck.releasePointerCapture(e.pointerId);}};
  const keyDown=(e:KeyboardEvent)=>{if(!interactive())return;const current=selection.current;let next:number|undefined;
   if(e.key==='ArrowRight')next=current+1;if(e.key==='ArrowLeft')next=current-1;if(e.key==='Home')next=0;if(e.key==='End')next=5;
   if(next!==undefined){e.preventDefault();choose(next);}
   if((e.key==='Enter'||e.key===' ')){e.preventDefault();openDetails();}
  };
  let wheelTotal=0,wheelAt=0,wheelJump=0;
  const wheel=(e:WheelEvent)=>{if(!interactive()||Math.abs(e.deltaY)>Math.abs(e.deltaX))return;e.preventDefault();const now=performance.now();if(now-wheelAt>200)wheelTotal=0;wheelAt=now;wheelTotal+=e.deltaX;if(Math.abs(wheelTotal)>100&&now-wheelJump>150){choose(selection.current+Math.sign(wheelTotal));wheelTotal=0;wheelJump=now;}};
  deck.addEventListener('pointerdown',pointerDown);deck.addEventListener('pointermove',pointerMove);deck.addEventListener('pointerup',pointerUp);deck.addEventListener('pointercancel',pointerUp);deck.addEventListener('keydown',keyDown);deck.addEventListener('wheel',wheel,{passive:false});
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);resize.disconnect();deck.removeEventListener('pointerdown',pointerDown);deck.removeEventListener('pointermove',pointerMove);deck.removeEventListener('pointerup',pointerUp);deck.removeEventListener('pointercancel',pointerUp);deck.removeEventListener('keydown',keyDown);deck.removeEventListener('wheel',wheel);};
 },[transition]);
 const copy=async()=>{try{await navigator.clipboard.writeText(draftRef.current?.value??'');setCopied('已复制');}catch{draftRef.current?.focus();draftRef.current?.select();setCopied('请手动复制已选中的草稿');}};
 return <section ref={host} className="consultation-scene" data-active="false" aria-label="问博主：从问题到请教草稿" aria-hidden="true" inert>
  <div className="consult-stage">
   <header className="consult-heading"><span>问博主</span><h2><img src={heading} alt="AI 解不开，向行家请教。"/></h2><p>AI 已给过方案，真实试用却仍然出错。<br/>带着项目约束与失败记录，找到能共同排查、评审落地的人。</p></header>
   <p className="consult-context"><Mark kind="message"/>{projectScenario.context}</p>
   <svg className="consult-evidence-wire" aria-hidden="true" fill="none"><path pathLength="1" className="consult-wire-base"/><path pathLength="100" className="consult-wire-light"/></svg>
   <div className="consult-deck" role="region" aria-roledescription="轮播" aria-label="博主卡片轮播" tabIndex={-1}>{consultationAuthors.map((v,i)=><Profile key={v.id} i={i} onSelect={openCard}/>)}</div>
   <nav className="consult-deck-nav" aria-label="切换博主"><button aria-label="上一位博主" disabled={selected===0} onClick={()=>choose(selected-1)}>←</button><span aria-live="polite">{selected+1} / 6</span><button aria-label="下一位博主" disabled={selected===5} onClick={()=>choose(selected+1)}>→</button><small>点侧卡切换 · 点中央看资料</small></nav>
   <section className="consult-composer" aria-label="想请教的问题"><div className="consult-settings"><div className="consult-purpose" aria-label="找人的目的"><button type="button" aria-pressed={purpose==='consult'} onClick={()=>setPurpose('consult')}><Mark kind="message"/>咨询人选</button><button type="button" aria-pressed={purpose==='invite'} onClick={()=>setPurpose('invite')}><Mark kind="plus"/>邀请回答</button></div><span className="consult-learning-check"><Mark kind="check"/>带上学习与实践记录</span></div><div className="consult-question" role="textbox" aria-label="演示输入的问题" aria-readonly="true"><span className="consult-question-text"/><span className="consult-field-placeholder">你具体卡在哪里，想获得什么帮助？</span></div><footer><span className="consult-search-status"/><button className="consult-search" type="button" aria-label="找博主" onClick={()=>seek(50.8)}><Mark kind="arrow"/><span className="consult-search-ellipsis">···</span></button></footer></section>
   <div className="consult-detail">
    <Shell id="detail"/>
    <article className="consult-evidence" aria-label={`${a.name}的推荐依据`}><header><span className="consult-detail-avatar"><CardAvatar name={a.name} src={a.avatar}/></span><div><strong>{a.name}</strong><small>{a.badge}</small></div><span className="consult-match-label">相关切入点</span></header><h3 data-consult-stream data-full={a.lead}/><p className="consult-reason" data-consult-stream data-full={a.summary}/><div className="consult-source-reference"><Mark/><span>{a.title}</span></div><blockquote><small>检索材料中的依据</small><p data-consult-stream data-full={a.quote}/></blockquote><p className="consult-limitation" data-consult-stream data-full={a.limitation}/><footer><button className="consult-text-button" onClick={()=>openDetails()}>了解依据与学习足迹 <Mark kind="arrow"/></button><button className="consult-prepare" onClick={prepare}>准备请教 <Mark kind="message"/></button></footer></article>
    <ConsultationAuthorDetails index={selected} tab={detailTab} onTab={openDetails} onClose={closeDetails} onPrepare={prepare}/>
    <section className="consult-draft" aria-label="准备私聊内容"><header><span className="consult-detail-avatar"><CardAvatar name={a.name} src={a.avatar}/></span><div><small>{purpose==='consult'?'准备私聊内容':'准备邀请消息'}</small><h3>向 {a.name} 请教</h3></div><Mark kind="message"/></header><label htmlFor="consult-draft-editor">说清试过什么，约定希望获得的帮助。</label><textarea id="consult-draft-editor" aria-label="私聊内容草稿" ref={draftRef} spellCheck={false} onChange={e=>{edits.current.set(`${selected}:${purpose}`,e.target.value);setCopied('');}}/><footer className="consult-draft-footer"><span>{copied||'可编辑 · 确认后自行联系'}</span><button onClick={copy} className="consult-copy"><Mark kind="copy"/>{copied==='已复制'?'已复制':'复制私聊内容'}</button></footer></section>
   </div>
   <div className="consult-lens" aria-hidden="true" inert><span className="consult-lens-handle"/><div className="consult-lens-rim"><div className="consult-lens-glass"><div className="consult-lens-copy">{consultationAuthors.map((v,i)=><Profile key={v.id} i={i} mirror/>)}</div></div><span className="consult-lens-glint"/></div></div>
   <svg className="consult-pointer" viewBox="0 0 30 40" width="28" height="38" aria-hidden="true"><path d="M3 2L26 22L16 23L22 36L17 38L11 25L4 32Z" fill="#fff" stroke="#253842" strokeWidth="1.4" strokeLinejoin="round"/><path d="M7 9L8 24M17 26L21 34" stroke="#2c6ddd" strokeWidth="1.6" strokeLinecap="round"/></svg>
   <span className="consult-demo-note">产品演示 · 基于已保存的公开文章</span>
  </div>
  {consultationAuthors.slice(0,3).map(v=><div className="consult-traveler" key={v.id} aria-hidden="true"><CardAvatar name={v.name} src={v.avatar}/></div>)}
 </section>;
}
