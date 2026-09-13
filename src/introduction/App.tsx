import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import {CenterDialogue} from './CenterDialogue';
import {SpeechBubble,speechPath} from './SpeechBubble';
import {advanceSpeech,speechEnvelope,createSpeechCycle} from './speech-cycle';
import {SCENE,WIDE_SCENE,CHARACTER_SIZE,SPEECH_WIDTH,SPEECH_HEIGHT,placeSpeech,portraitBox} from './layout';
import {characters,type CharacterPlayer} from './characters';
import {ENTRANCE_DURATION,ORBIT_PERIOD,clamp,orbitPoint} from './orbit';
import {KnowledgeTicker} from './KnowledgeTicker';
import answerLettering from './assets/answer-lettering.svg';
import {GoalPanel} from './GoalPanel';
import {InterviewScene} from './InterviewScene';
import {FinaleStoryScene} from './FinaleStoryScene';
import {ShowcaseNavigation} from './ShowcaseNavigation';
import {ConsultationStoryScene} from './ConsultationStoryScene';
import {AuthorNetworkStoryScene} from './AuthorNetworkStoryScene';
import {LearningStoryScene} from './LearningStoryScene';
import {choreographyAt,storyAt} from './route-choreography';
import {SCROLL_SCREENS,scrollScreensAt} from './scroll-pacing';
import {initialStory,interviewLayout,interviewTurns,type StoryState} from './interview';
import {characterGoals,columnLayout,goals,mix,segment,useScrollTransition,type GoalId,type ScrollTransition} from './scroll-transition';

function useReducedMotion(){
  const[value,setValue]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const changed=()=>setValue(media.matches);
    media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
  return value;
}

export function OrbitScene({transition,frame,activeGoal,onGoal,onStory,beat}:{transition:RefObject<ScrollTransition>;frame:RefObject<HTMLDivElement|null>;activeGoal:GoalId;onGoal:(goal:GoalId)=>void;onStory:(state:StoryState)=>void;beat:number}){
  const reduced=useReducedMotion();
  const stage=useRef<HTMLDivElement>(null);
  const nodes=useRef<(HTMLButtonElement|null)[]>([]);
  const players=useRef(new Map<number,CharacterPlayer>());
  const pointer=useRef<{x:number;y:number}|null>(null);
  const canvas=useRef<HTMLDivElement>(null);
  const labels=useRef<(HTMLSpanElement|null)[]>([]);
  const center=useRef<HTMLDivElement>(null);
  const[view,setView]=useState<'orbit'|'transition'|'column'|'interview'>('orbit');
  const viewRef=useRef(view);
  const[goalQuestion,setGoalQuestion]=useState(false);
  const goalQuestionRef=useRef(false);
  const[interviewQuestion,setInterviewQuestion]=useState(false);
  const interviewQuestionRef=useRef(false);
  const onStoryRef=useRef(onStory);onStoryRef.current=onStory;
  const goalRef=useRef(activeGoal);goalRef.current=activeGoal;
  const[scene,setScene]=useState(SCENE);
  const sceneRef=useRef(scene);
  const phase=useRef({angle:0,entrance:0});
  const[complete,setComplete]=useState(false);
  const[run,setRun]=useState(0);
  const[ready,setReady]=useState<number[]>([]);
  const[errors,setErrors]=useState<Record<number,string>>({});
  const[hover,setHover]=useState<number|null>(null);
  const[focus,setFocus]=useState<number|null>(null);
  const[pinned,setPinned]=useState<number|null>(null);
  const[paused,setPaused]=useState(false);
  const manual=hover??focus??pinned;
  const manualRef=useRef(manual);manualRef.current=manual;
  const cycle=useRef(createSpeechCycle());
  const [automatic,setAutomatic]=useState<number|null>(null);
  const active=manual??automatic;
  const activeRef=useRef(active);activeRef.current=active;
  const completeRef=useRef(complete);completeRef.current=complete;
  const pausedRef=useRef(paused);pausedRef.current=paused;
  const onComplete=useCallback(()=>setComplete(true),[]);

  useEffect(()=>{
    const root=stage.current!;
    const observer=new ResizeObserver(([entry])=>{
      const fit=(candidate:typeof SCENE)=>Math.min(entry.contentRect.width/candidate.width,entry.contentRect.height/candidate.height,1.3);
      const chosen=fit(WIDE_SCENE)>fit(SCENE)?WIDE_SCENE:SCENE;
      sceneRef.current=chosen;setScene(chosen);
      const scale=fit(chosen);
      canvas.current!.style.setProperty('--scene-scale',String(scale));
    });
    observer.observe(root);
    const move=(event:PointerEvent)=>{if(event.pointerType!=='touch')pointer.current={x:event.clientX,y:event.clientY};};
    const leave=()=>{pointer.current=null;setHover(null);};
    root.addEventListener('pointerenter',move,{passive:true});
    root.addEventListener('pointermove',move,{passive:true});
    root.addEventListener('pointerleave',leave);
    window.addEventListener('blur',leave);
    return()=>{observer.disconnect();root.removeEventListener('pointerenter',move);root.removeEventListener('pointermove',move);
      root.removeEventListener('pointerleave',leave);window.removeEventListener('blur',leave);};
  },[]);

  useEffect(()=>{
    let id=0,last=0;
    const main=frame.current!;
    const goalScene=main.querySelector<HTMLElement>('.goal-scene')!;
    const intro=main.querySelector<HTMLElement>('.hero-copy')!;
    const ticker=main.querySelector<HTMLElement>('.knowledge-pane')!;
    const links=[...main.querySelectorAll<SVGPathElement>('[data-goal-link]')];
    const connectionGroups=[...main.querySelectorAll<SVGGElement>('[data-connection]')];
    const starts=[...main.querySelectorAll<SVGCircleElement>('[data-link-start]')];
    const networks=[...main.querySelectorAll<SVGGElement>('[data-goal-network]')];
    const papers=[...main.querySelectorAll<HTMLElement>('[data-goal]')];
    let lastStory='';
    const suspendedPlayers=new WeakMap<CharacterPlayer,boolean>();
    let lastWidth=0,lastHeight=0;
    let labelWidths:number[]=[];
    const draw=(now:number)=>{
      const scene=sceneRef.current;
      const dt=last?Math.min((now-last)/1000,.05):0;last=now;
      const motion=transition.current;
      const raw=motion.progress,p=Math.min(1,raw),q=segment(raw,1.22,1.74);
      const story=storyAt(raw);
      const choreography=choreographyAt(raw);
      const storyKey=JSON.stringify(story);if(storyKey!==lastStory){lastStory=storyKey;onStoryRef.current(story);}
      main.dataset.learning=String(raw>=7.4);
      if(raw>=7.4){
        stage.current!.inert=true;stage.current!.setAttribute('aria-hidden','true');
        for(const hidden of [goalScene,intro,ticker]){hidden.inert=true;hidden.setAttribute('aria-hidden','true');}
        // Keep the shared scroll clock alive without laying out hidden portraits.
        for(const player of players.current.values())if(suspendedPlayers.get(player)!==true){player.pause();suspendedPlayers.set(player,true);}
        main.dataset.transition=raw.toFixed(4);
        id=requestAnimationFrame(draw);return;
      }
      stage.current!.inert=false;stage.current!.removeAttribute('aria-hidden');intro.inert=false;
      if((raw>1.58)!==interviewQuestionRef.current){interviewQuestionRef.current=raw>1.58;setInterviewQuestion(raw>1.58);}
      if((p>.48)!==goalQuestionRef.current){goalQuestionRef.current=p>.48;setGoalQuestion(p>.48);}
      const mainRect=main.getBoundingClientRect();
      const pageRect=stage.current!.parentElement!.getBoundingClientRect();
      const canvasRect=canvas.current!.getBoundingClientRect();
      const scale=canvasRect.width/scene.width;
      if(!(scale>0)||mainRect.height<=0){id=requestAnimationFrame(draw);return;}
      const layout=columnLayout(mainRect.width,mainRect.height);
      if(mainRect.width!==lastWidth||mainRect.height!==lastHeight){
        lastWidth=mainRect.width;lastHeight=mainRect.height;
        main.style.setProperty('--column-top',`${layout.top}px`);
        main.style.setProperty('--column-bottom',`${mainRect.height-layout.goalBottom}px`);
        main.style.setProperty('--goal-left',`${layout.goalX}px`);
        main.style.setProperty('--answer-size',`${layout.answerSize}px`);
        const dialogue=interviewLayout(mainRect.width,mainRect.height);
        main.style.setProperty('--interview-font-size',`${dialogue.dialogueFontSize}px`);
        labelWidths=labels.current.map(label=>label?.offsetWidth??0);
      }
      const baseCenter={x:canvasRect.left+(scene.width/2-60)*scale,y:canvasRect.top+scene.originY*scale};
      const centerProgress=segment(p,.28,.75);
      const interview=interviewLayout(mainRect.width,mainRect.height);
      const centerLook={x:mix(mix(baseCenter.x,mainRect.left+layout.centerX,centerProgress),mainRect.left+interview.x,q),y:mix(mix(baseCenter.y,mainRect.top+layout.centerY,centerProgress),mainRect.top+interview.y,q)};
      const centerScale=mix(1+.45*segment(p,.82,1),interview.size/(300*scale),q);
      // Compensate the live portrait scale in every chapter, including the goal bubble.
      center.current!.style.setProperty('--dialogue-svg-font-size',`${interview.dialogueFontSize*416/(180*scale*centerScale)}px`);
      center.current!.style.transformOrigin='50% 58.333%';
      center.current!.style.transform=`translate(${(centerLook.x-baseCenter.x)/scale}px,${(centerLook.y-baseCenter.y)/scale}px) scale(${centerScale})`;
      // Change the thought while the portrait is invisible, then return the same
      // character with a more specific question. Neither player is restarted.
      center.current!.style.opacity=String(mix(1-segment(p,.04,.2)+(mainRect.width<=940?0:segment(p,.86,1)),1,q)*choreography.leftOpacity);
      // Capture the live circular order once. Sorting by current height lets the
      // six existing canvases unfold without crossing or remounting each other.
      if(motion.target>.001&&!motion.locked){
        const order=Array.from({length:6},(_,i)=>({i,y:orbitPoint(i,phase.current.angle,scene.rx,scene.ry,1).y})).sort((a,b)=>a.y-b.y||a.i-b.i);
        order.forEach(({i},slot)=>motion.slots[i]=slot);motion.locked=true;
      }
      if(p===0&&motion.target===0)motion.locked=false;
      const nextView=raw>1.22?'interview':p<.025?'orbit':p>.94?'column':'transition';
      if(nextView!==viewRef.current){viewRef.current=nextView;setView(nextView);setHover(null);setFocus(null);setPinned(null);}
      main.dataset.transition=raw.toFixed(4);main.dataset.scene=nextView;
      main.style.setProperty('--second-remain',String(1-segment(raw,1.22,1.46)));
      main.style.setProperty('--interview-open',String(segment(raw,1.49,1.74)));
      main.style.setProperty('--interview-rise',`${20*(1-segment(raw,1.49,1.74))}px`);
      main.style.setProperty('--route-expand',String(choreography.expand));
      main.style.setProperty('--interview-remain',String(choreography.leftOpacity));
      main.style.setProperty('--route-shift',`${45*(1-segment(raw,2.35,2.55))}px`);
      main.style.setProperty('--intro-opacity',String(1-segment(p,.04,.28)));
      main.style.setProperty('--intro-rise',`${-24*segment(p,.04,.28)}px`);
      main.style.setProperty('--cards-exit',String(segment(p,.08,.53)));
      main.style.setProperty('--cards-opacity',String(1-segment(p,.12,.52)));
      main.style.setProperty('--goals-opacity',String(segment(p,.74,.98)));
      papers.forEach((paper,i)=>paper.style.setProperty('--paper-open',String(segment(p,.73+i*.035,.90+i*.035))));
      main.style.setProperty('--goals-shift',`${16*(1-segment(p,.74,.98))}px`);
      main.style.setProperty('--goal-heading-opacity',String(segment(p,.22,.48)));
      goalScene.inert=p<.94||raw>1.22;goalScene.setAttribute('aria-hidden',String(p<.48||raw>1.56));
      intro.setAttribute('aria-hidden',String(p>.28));
      ticker.inert=p>.45;ticker.setAttribute('aria-hidden',String(p>.52));
      const canRun=completeRef.current&&!document.hidden;
      if(canRun){
        phase.current.entrance=reduced?ENTRANCE_DURATION:phase.current.entrance+dt;
        if(!motion.locked&&manualRef.current===null&&!pausedRef.current&&!reduced)phase.current.angle+=dt*Math.PI*2/ORBIT_PERIOD;
      }
      const speechReady=canRun&&nextView==='orbit'&&phase.current.entrance>=ENTRANCE_DURATION;
      if(speechReady){
        advanceSpeech(cycle.current,dt,characters.length,manualRef.current!==null||pausedRef.current);
        if(cycle.current.index!==cycle.current.displayed){cycle.current.displayed=cycle.current.index;setAutomatic(cycle.current.index);}
      }
      stage.current!.dataset.speechMode=manualRef.current===null?'automatic':'manual';
      stage.current!.dataset.speechIndex=String(cycle.current.index);
      stage.current!.dataset.speechElapsed=cycle.current.elapsed.toFixed(3);
      const originX=scene.width/2,originY=scene.originY;
      const characterSize=CHARACTER_SIZE;
      const orbit=scene;
      const points=nodes.current.map((_,i)=>{
        const point=orbitPoint(i,phase.current.angle,orbit.rx,orbit.ry,phase.current.entrance);
        const rowY=layout.top+(motion.slots[i]+.5)*layout.step;
        const targetX=(mainRect.left+layout.x-canvasRect.left)/scale-originX;
        const targetY=(mainRect.top+rowY-canvasRect.top)/scale-originY;
        // Spread vertically first, then align horizontally along soft arcs.
        return {...point,x:mix(point.x,targetX,segment(p,.20,.64)),y:mix(point.y+orbit.cy,targetY,segment(p,.08,.56)),
          scale:mix(point.scale,layout.size/(CHARACTER_SIZE*scale),segment(p,.12,.63)),tilt:point.tilt*(1-segment(p,.1,.7))};
      });
      const goalHeight=(layout.goalBottom-layout.goalTop-28)/3;
      const wireStart=layout.labelX+Math.max(...labelWidths,layout.answerSize*5)+12;
      const wireEnd=layout.goalX-9;
      const busX=mix(wireStart,wireEnd,.57);
      networks.forEach((network,goalIndex)=>{
        const endY=layout.goalTop+goalHeight/2+goalIndex*(goalHeight+14);
        const rows=characterGoals.flatMap((goal,i)=>goal===goals[goalIndex].id?[layout.top+(motion.slots[i]+.5)*layout.step]:[]);
        const selected=goals[goalIndex].id===goalRef.current;
        network.dataset.active=String(selected);
        network.style.opacity=String(selected?segment(p,.67,.84):0);
        const spine=network.querySelector<SVGPathElement>('[data-network-spine]')!;
        const minY=Math.min(endY,...rows),maxY=Math.max(endY,...rows);
        const radius=Math.max(0,Math.min(7,(maxY-minY)/2,(busX-wireStart)*.6,(wireEnd-busX)*.6));
        spine.setAttribute('d',`M${busX} ${minY+radius}V${maxY-radius}`);
        spine.style.strokeDashoffset=String(1-segment(p,.7,.86));
        const outlet=network.querySelector<SVGPathElement>('[data-network-out]')!;
        const corner=endY===minY?`M${busX} ${endY+radius}Q${busX} ${endY} ${busX+radius} ${endY}`:
          endY===maxY?`M${busX} ${endY-radius}Q${busX} ${endY} ${busX+radius} ${endY}`:`M${busX} ${endY}`;
        outlet.setAttribute('d',`${corner}H${wireEnd}m-5 -3 5 3-5 3`);
        outlet.style.strokeDashoffset=String(1-segment(p,.78,.9));
      });
      const portraits=points.map(p=>portraitBox(originX+p.x,originY+p.y,characterSize,p.scale));
      nodes.current.forEach((node,i)=>{
        if(!node)return;
        const point=points[i];
        node.style.transform=`translate(-50%,-50%) translate(${point.x}px,${point.y}px) scale(${point.scale})`;
        node.style.opacity=completeRef.current?String(point.opacity*(1-segment(raw,1.22,1.52))):'0';
        node.disabled=!completeRef.current||point.opacity<1||nextView==='transition'||nextView==='interview';
        node.tabIndex=node.disabled?-1:0;
        node.style.setProperty('--tilt',`${point.tilt}deg`);
        if(activeRef.current===i&&nextView==='orbit'){
          const bubble=node.querySelector<HTMLElement>('.speech-bubble');
          const w=SPEECH_WIDTH*point.scale,h=SPEECH_HEIGHT*point.scale;
          const placement=placeSpeech(portraits[i],w,h,{left:6,top:0,right:scene.width-6,bottom:scene.height});
          const half=characterSize/2;
          const x=(placement.x-(originX+point.x))/point.scale+half;
          const y=(placement.y-(originY+point.y))/point.scale+half;
          node.dataset.bubbleSide=placement.side;
          node.style.setProperty('--speech-x',`${x}px`);
          node.style.setProperty('--speech-y',`${y}px`);
          if(bubble){
            const reveal=manualRef.current!==null?1:speechEnvelope(cycle.current.elapsed);
            bubble.style.opacity=String(reveal);
            bubble.style.transform=reduced?'none':`translateY(${(1-reveal)*5}px) scale(${.94+.06*reveal})`;
          }
          bubble?.querySelector(`.speech-outline-${placement.side} path`)?.setAttribute('d',speechPath(placement.side,placement.shift));
        }
        const rowY=layout.top+(motion.slots[i]+.5)*layout.step;
        const label=labels.current[i];
        if(label){
          label.style.left=`${mainRect.left-pageRect.left+layout.labelX}px`;
          label.style.top=`${mainRect.top-pageRect.top+rowY}px`;
          label.style.opacity=String(segment(p,.59,.75)*(1-segment(raw,1.22,1.52)));
          label.dataset.highlight=String(characterGoals[i]===goalRef.current);
        }
        const goalIndex=goals.findIndex(goal=>goal.id===characterGoals[i]);
        const endY=layout.goalTop+goalHeight/2+goalIndex*(goalHeight+14);
        const relatedRows=characterGoals.flatMap((goal,j)=>goal===characterGoals[i]?[layout.top+(motion.slots[j]+.5)*layout.step]:[]);
        const minY=Math.min(endY,...relatedRows),maxY=Math.max(endY,...relatedRows),radius=Math.max(0,Math.min(7,(maxY-minY)/2,(busX-wireStart)*.6,(wireEnd-busX)*.6));
        const turn=rowY===minY?`H${busX-radius}Q${busX} ${rowY} ${busX} ${rowY+radius}`:
          rowY===maxY?`H${busX-radius}Q${busX} ${rowY} ${busX} ${rowY-radius}`:`H${busX}`;
        links[i]?.setAttribute('d',`M${wireStart} ${rowY}${turn}`);
        const selected=characterGoals[i]===goalRef.current;
        if(links[i]){
          connectionGroups[i].style.opacity=String(selected?segment(p,.64,.8):0);
          connectionGroups[i].dataset.active=String(selected);
          links[i].style.strokeDashoffset=String(1-segment(p,.64,.8));
          starts[i].setAttribute('cx',String(wireStart));starts[i].setAttribute('cy',String(rowY));
        }
        const player=players.current.get(i);
        if(player&&player.status==='ready'){
          const suspended=raw>=1.56||document.hidden;
          if(suspendedPlayers.get(player)!==suspended){
            if(suspended)player.pause();else player.play();
            suspendedPlayers.set(player,suspended);node.dataset.suspended=String(suspended);
          }
          // Preserve the six instances for reverse scrolling while giving the
          // third screen's WebGL scene the rendering budget.
          if(suspended)return;
          const followingPointer=!reduced&&pointer.current!==null;
          const relative=followingPointer?pointer.current!:p>.9?{x:mainRect.left+layout.goalX,y:mainRect.top+endY}:centerLook;
          const reach=Math.max(characterSize*scale*.8,70);
          const x=clamp((relative.x-(canvasRect.left+(originX+point.x)*scale))/reach,-1,1);
          const y=clamp((relative.y-(canvasRect.top+(originY+point.y)*scale))/reach,-1,1);
          // Recompute toward the central portrait as the ring moves. Pointer
          // tracking is enabled only while the mouse is inside this stage.
          player.lookAt(x,y);
          node.dataset.lookMode=followingPointer?'pointer':p>.9?'goal':'center';
          node.dataset.lookX=x.toFixed(3);node.dataset.lookY=y.toFixed(3);
        }
      });
      stage.current!.dataset.angle=phase.current.angle.toFixed(5);
      id=requestAnimationFrame(draw);
    };
    id=requestAnimationFrame(draw);return()=>cancelAnimationFrame(id);
  },[reduced,frame,transition]);

  const replay=()=>{cycle.current=createSpeechCycle();setAutomatic(null);phase.current={angle:0,entrance:0};setComplete(false);completeRef.current=false;
    setHover(null);setFocus(null);setPinned(null);setPaused(false);players.current.clear();setReady([]);setErrors({});setRun(value=>value+1);};
  const orbitVisible=complete;
  return <section className="page" aria-label="对话之间：角色环绕" onPointerDown={event=>{if(!(event.target as Element).closest('[data-character]'))setPinned(null);}}
    onKeyDown={event=>{if(event.key==='Escape'){setPinned(null);setFocus(null);setHover(null);(document.activeElement as HTMLElement)?.blur();}}}>
    <div className="hero-copy">
      <h1><span>一个问题，</span><img src={answerLettering} alt="不止一种答案。"/></h1>
      <p>听见不同的经验，<br/>找到自己的学习路径。</p>
    </div>
      <div className="controls scene-controls">
        <button type="button" aria-label={paused?'继续环绕':'暂停环绕'} aria-pressed={paused} disabled={!complete} onClick={()=>setPaused(value=>!value)}>
          {paused?<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>:<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>}
        </button>
        <button type="button" aria-label="重新播放" onClick={replay}><svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg></button>
      </div>
    <div className="orbit-stage" ref={stage} data-phase={complete?'orbit':'dialogue'} data-ready-count={ready.length}>
      <div className="orbit-canvas" ref={canvas} style={{width:scene.width,height:scene.height,'--origin-y':`${scene.originY}px`} as React.CSSProperties} data-layout-validated={scene.validated}>
      <div className="center-wrap" ref={center}><CenterDialogue key={run} onComplete={onComplete} reducedMotion={reduced} goalMode={goalQuestion} conversationLines={interviewQuestion?interviewTurns[beat].answer:undefined}/></div>
      <div className="characters" aria-label="六种不同的视角" aria-hidden={!orbitVisible}>
        {characters.map(({id,label,Component,message},i)=><button key={id} type="button"
          ref={node=>{nodes.current[i]=node;}} className={`orbit-character${active===i?' is-active':''}`}
          aria-label={view==='column'?`${label}，查看${goals.find(goal=>goal.id===characterGoals[i])!.title}目标`:`${label}，查看对话`}
          aria-describedby={view==='column'?`answer-${id}`:active===i?`speech-${id}`:undefined}
          aria-expanded={view==='column'?undefined:active===i} tabIndex={orbitVisible?0:-1} disabled={!orbitVisible}
          data-character={id} data-ready={ready.includes(i)} data-load-state={errors[i]?'fallback':ready.includes(i)?'ready':'loading'}
          onPointerEnter={event=>{if(view==='column')onGoal(characterGoals[i]);else if(view==='orbit'&&event.pointerType!=='touch')setHover(i);}}
          onPointerLeave={()=>setHover(null)}
          onFocus={event=>{if(view==='column')onGoal(characterGoals[i]);else if(event.currentTarget.matches(':focus-visible'))setFocus(i);}}
          onBlur={()=>{setFocus(null);setPinned(null);}}
          onClick={event=>{if(view==='column')onGoal(characterGoals[i]);else if(event.detail===0||matchMedia('(pointer: coarse)').matches)setPinned(pinned===i?null:i);}}
          >
          <span className="character-portrait"><Component key={run} size="100%" follow="none" onReady={player=>{
            setErrors(values=>{const next={...values};delete next[i];return next;});players.current.set(i,player);setReady(values=>values.includes(i)?values:[...values,i]);
          }} onError={error=>{players.current.delete(i);setReady(values=>values.filter(index=>index!==i));setErrors(values=>({...values,[i]:error.message}));}}/></span>
          {active===i&&view==='orbit'&&<SpeechBubble id={id} message={message}/>}
        </button>)}
      </div>
      </div>
    </div>
    <div className="answer-labels" aria-hidden={view!=='column'}>{characters.map(({id,message},i)=><span id={`answer-${id}`} key={id} ref={el=>{labels.current[i]=el;}} className="answer-label">{message}</span>)}</div>
  </section>;
}

export function App(){
 const story=useRef<HTMLElement>(null);
 const frame=useRef<HTMLDivElement>(null);
 const transition=useScrollTransition(story);
 const[goal,setGoal]=useState<GoalId>('application');
 const[storyState,setStoryState]=useState(initialStory);
 const beat=storyState.beat;
 return <main className="scroll-story" ref={story} style={{height:`${(SCROLL_SCREENS+1)*100}svh`}}>
  <ShowcaseNavigation transition={transition}/>
  <nav className="chapter-shortcuts" aria-label="章节跳转"><a href="#goals">跳到不同的目标</a><a href="#interview">跳到目标访谈</a><a href="#route">跳到学习路线</a><a href="#learning">跳到知识脉络学习</a><a href="#authors">跳到博主网络</a><a href="#ask-authors">跳到问博主</a><a href="#begin">跳到开始学习</a></nav>
  <span className="chapter-anchor" id="goals" style={{top:`${scrollScreensAt(1.10)*100+14}svh`}} aria-hidden="true"/>
  <span className="chapter-anchor" id="interview" style={{top:`${scrollScreensAt(1.65)*100}svh`}} aria-hidden="true"/>
  <span className="chapter-anchor" id="route" style={{top:`${scrollScreensAt(1.79)*100}svh`}} aria-hidden="true"/>
  <span className="chapter-anchor" id="learning" style={{top:`${scrollScreensAt(8.4)*100}svh`}} aria-hidden="true"/>
  <span className="chapter-anchor" id="authors" style={{top:`${scrollScreensAt(28.0)*100}svh`}} aria-hidden="true"/>
  <span className="chapter-anchor" id="ask-authors" style={{top:`${scrollScreensAt(40.4)*100}svh`}} aria-hidden="true"/>
  <span className="chapter-anchor" id="begin" style={{top:`${scrollScreensAt(61.2)*100}svh`}} aria-hidden="true"/>
  <div className="combined-page" ref={frame}>
  <OrbitScene transition={transition} frame={frame} activeGoal={goal} onGoal={setGoal} onStory={setStoryState} beat={beat}/>
  <KnowledgeTicker/><GoalPanel active={goal} onSelect={setGoal}/>
  <InterviewScene story={storyState} beat={beat} transition={transition}/>
  <LearningStoryScene transition={transition}/>
  <AuthorNetworkStoryScene transition={transition}/>
  <ConsultationStoryScene transition={transition}/>
  <FinaleStoryScene transition={transition}/>
 </div></main>;
}
