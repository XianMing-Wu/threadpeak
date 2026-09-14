import {useEffect,useRef,useState,type RefObject} from 'react';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import route from './interview-route.json';
import runUrl from '../vendor/learning-path-3d/assets/liu-kanshan-run.glb?url';
import idleUrl from '../vendor/learning-path-3d/assets/liu-kanshan-idle.glb?url';
import type {ScrollTransition} from './scroll-transition';
import {choreographyAt,falling,linear,range,routeTimes} from './route-choreography';
import {carrierPositions,guideAt,conceptLifecycle} from './route-guide';
import {fitRouteFrame,type RouteFrameItem} from './route-framing';
import {FlowRibbon} from './FlowRibbon';
import {FlowBloom} from './FlowBloom';
import {startCardScreen,rootBox} from './learning-motion';
import {LearningStartCard} from './LearningStartCard';
import {LearningCardModel} from './LearningCardModel';
import {deckGeometry,surfaceAt,loopClip,RUN_STRIDE_LENGTH} from './route-surfaces';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const subjectIds=route.structure.subjects.map(n=>n.id);
const subjectPositions=carrierPositions.map(p=>V(p.x,0,p.z));
const positions=new Map(subjectIds.map((id,i)=>[id,subjectPositions[i]]));
const conceptNames=['模型对话','结构化输出','智能体循环','工具边界','文档分块','语义检索','证据与引用','能力汇合','评测与排错'];
const concepts=route.structure.concepts.map((c,i)=>{
 const siblings=route.structure.concepts.filter(n=>n.subjectId===c.subjectId),local=siblings.findIndex(n=>n.id===c.id),carrier=subjectIds.indexOf(c.subjectId);
 return {...c,local,carrier,count:siblings.length,position:V(4.15+local*2.35,0,positions.get(c.subjectId)!.z),name:conceptNames[i]};
});
type Label={element:HTMLDivElement;kind:'subject'|'concept';index:number};

export default function ScrollRouteScene({transition}:{transition:RefObject<ScrollTransition>}){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),labelsHost=useRef<HTMLDivElement>(null);
 const [failure,setFailure]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const el=host.current!,surface=canvas.current!,labelLayer=labelsHost.current!,portalShape=el.querySelector<SVGEllipseElement>('.route-match-cut ellipse')!,startCard=el.querySelector<HTMLElement>('.route-start-card')!;
  let disposed=false,frame=0,lastP=NaN,lastW=0,lastH=0,dirty=true,lastFrame=0,lastRendered=0,runClock=0,runBlend=0;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({canvas:surface,alpha:true,antialias:true,powerPreference:'high-performance'});}catch{setFailure('当前设备暂时无法显示 3D 路线。');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0xffffff,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.14;
  const scene=new T.Scene(),world=new T.Group();scene.add(world);
  const camera=new T.OrthographicCamera(-15,15,12,-12,.05,180);
  scene.add(new T.HemisphereLight('#ffffff','#e5e8e5',1.24));
  const key=new T.DirectionalLight('#fffdf9',1.72);key.position.set(-8,24,9);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-17;key.shadow.camera.right=17;key.shadow.camera.top=17;key.shadow.camera.bottom=-17;key.shadow.normalBias=.035;scene.add(key);
  const fill=new T.DirectionalLight('#edf8f0',.3);fill.position.set(8,9,-6);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(130,130),new T.ShadowMaterial({opacity:.10}));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;world.add(ground);
  // Preserve the native renderer's rounded-button profile, palette and lighting.
  const material=(color:string)=>new T.MeshPhysicalMaterial({color,metalness:0,roughness:.58,clearcoat:0,specularIntensity:0});
  function rounded(radius:number,height:number,bevel:number){
   const points=[new T.Vector2(0,0)],profile=radius-bevel;
   for(let i=0;i<=5;i++){const a=-Math.PI/2+i/5*Math.PI/2;points.push(new T.Vector2(profile+Math.cos(a)*bevel,bevel+Math.sin(a)*bevel));}
   for(let i=0;i<=5;i++){const a=i/5*Math.PI/2;points.push(new T.Vector2(profile+Math.cos(a)*bevel,height-bevel+Math.sin(a)*bevel));}
   points.push(new T.Vector2(0,height));return new T.LatheGeometry(points,64);
  }
  const baseGeometry=rounded(.71,.14,.06),bodyGeometry=rounded(.625,.46,.07),capGeometry=new T.CircleGeometry(.558,64);
  function platform(blue=false){
   const group=new T.Group(),base=new T.Mesh(baseGeometry,material('#ffffff')),body=new T.Mesh(bodyGeometry,material(blue?'#0d5fd1':'#168f4f')),cap=new T.Mesh(capGeometry,material(blue?'#1772f6':'#29b765'));
   body.position.y=.06;cap.rotation.x=-Math.PI/2;cap.position.y=.523;group.add(base,body,cap);
   group.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o!==base;o.receiveShadow=true;}});
   return group;
  }
  const greens=subjectPositions.map(p=>{const g=platform();g.position.copy(p);world.add(g);return g;});
  const blues=concepts.map(c=>{const g=platform(true);g.position.copy(c.position);g.scale.setScalar(.85);g.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshPhysicalMaterial;m.transparent=true;}});world.add(g);return g;});
  const roadTop=new T.MeshStandardMaterial({color:'#d8e5e9',roughness:.92}),roadSide=new T.MeshStandardMaterial({color:'#a9bec8',roughness:.92});
  function road(a:T.Vector3,b:T.Vector3,width=.58,concept=false,bridge=false,from=0,to=1,startHeight=.523,endHeight=.523){
   const g=new T.Group(),materials=[roadTop.clone(),roadSide.clone()];
   if(bridge){materials[0].color.set('#edf3f4');materials[1].color.set('#9eafb8');}
   materials.forEach(m=>{m.transparent=concept;});
   const mesh=new T.Mesh(deckGeometry(a,b,width,bridge?.15:.075,bridge,from,to,startHeight,endHeight),materials);
   mesh.receiveShadow=true;mesh.castShadow=bridge;g.add(mesh);world.add(g);return g;
  }
  const roads=route.structure.flow.map(e=>road(positions.get(e.fromSubjectId)!,positions.get(e.toSubjectId)!));
  // The shared horizontal bridge follows the user's visual tour (step 5).
  // It does not add a prerequisite edge to the authored learning document.
  roads.push(road(subjectPositions[2],subjectPositions[3]));
  const conceptRoads=concepts.map(c=>{
   const prior=concepts.find(n=>n.subjectId===c.subjectId&&n.local===c.local-1);
   const from=prior?.position??subjectPositions[c.carrier];
   // The left branch's concepts pass over the right carrier on an arched deck.
   if(c.carrier===2&&c.local===0)return null;
   return road(from,c.position,.42,true,false,0,1,prior ? .445 : .523,.445);
  });
  const bridge=Array.from({length:3},(_,i)=>road(subjectPositions[2],concepts.find(c=>c.carrier===2&&c.local===0)!.position,.49,true,true,i/3,(i+1)/3,.523,.445));
  const arrowLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');arrowLayer.classList.add('route-carrier-arrows');arrowLayer.setAttribute('aria-hidden','true');
  const arrows=Array.from({length:4},()=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');for(let j=0;j<2;j++){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class',j?'arrow-ink':'arrow-paper');g.append(path);}arrowLayer.append(g);return g;});labelLayer.append(arrowLayer);
  const labels:Label[]=[];
  for(let i=1;i<=4;i++){
   const d=document.createElement('div'),img=document.createElement('img');d.className='route-node-title';d.dataset.nodeId=subjectIds[i];img.src=`${import.meta.env.BASE_URL}introduction/route-lettering/carrier-${i-1}.svg`;img.alt=route.data.cards.find(c=>c.id===route.structure.subjects[i].cardRef)?.title??'';d.append(img);labelLayer.append(d);labels.push({element:d,kind:'subject',index:i});
  }
  concepts.forEach((c,i)=>{const d=document.createElement('div'),img=document.createElement('img');d.className='route-concept-type';d.dataset.nodeId=c.id;d.dataset.side=c.local%2===0?'above':'below';img.src=`${import.meta.env.BASE_URL}introduction/route-lettering/concept-${i}.svg`;img.alt=c.name;d.append(img);labelLayer.append(d);labels.push({element:d,kind:'concept',index:i});});
  const beam=new FlowRibbon(),bloom=new FlowBloom();world.add(beam.group);
  const hero=new T.Group();world.add(hero);let mixer:T.AnimationMixer|undefined,model:T.Group|undefined,idleAction:T.AnimationAction|undefined,runAction:T.AnimationAction|undefined;
  const loader=new GLTFLoader();
  Promise.all([loader.loadAsync(runUrl),loader.loadAsync(idleUrl)]).then(([running,idle])=>{
   if(disposed){release(running.scene);release(idle.scene);return;}
   model=running.scene;
   const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(V()),center=bounds.getCenter(V()),scale=1.75/size.y;
   model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
   model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});hero.add(model);
   mixer=new T.AnimationMixer(model);
   const run=loopClip(running.animations.find(a=>a.name==='Armature|run_fast_3_inplace|baselayer')!,.8);
   const idleClip=loopClip(idle.animations.find(a=>a.name==='Armature|Idle_11|baselayer')!,1.9);
   idleAction=mixer.clipAction(idleClip);runAction=mixer.clipAction(run);idleAction.play();runAction.play();runAction.setEffectiveWeight(0);mixer.setTime(.04);
   // Normalise the animated pose, not the unposed GLB bounding box.
   const savedPosition=hero.position.clone(),savedRotation=hero.quaternion.clone(),savedScale=hero.scale.clone();
   hero.position.set(0,0,0);hero.quaternion.identity();hero.scale.setScalar(1);hero.updateMatrixWorld(true);
   const poseBounds=new T.Box3().setFromObject(model,true),poseCenter=poseBounds.getCenter(V());
   model.position.add(V(-poseCenter.x,-poseBounds.min.y,-poseCenter.z));
   hero.position.copy(savedPosition);hero.quaternion.copy(savedRotation);hero.scale.copy(savedScale);hero.updateMatrixWorld(true);
   el.dataset.ready='true';dirty=true;release(idle.scene);
  }).catch(error=>{if(!disposed)setFailure(`刘看山模型加载失败，请重试。${error instanceof Error?'':''}`);});
  const observer=new ResizeObserver(()=>{dirty=true;});observer.observe(el);
  const contextLost=(e:Event)=>{e.preventDefault();setFailure('3D 画面暂时中断，请重试。');};surface.addEventListener('webglcontextlost',contextLost);
  function release(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();}}});}
  function update(now:number){
   if(disposed)return;const raw=Math.min(7.4,transition.current.progress),dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;
   const moving=Math.abs(raw-lastP)>.000001;
   const gait=raw>6.195&&raw<6.85&&moving&&!reducedMotion.matches?1:0;
   runBlend=T.MathUtils.lerp(runBlend,gait,1-Math.exp(-dt*18));
   runClock=(runClock+dt*2.4)% .8;
   if(!document.hidden&&(raw!==lastP||dirty||(!reducedMotion.matches&&raw>2.56&&raw<6.88&&now-lastRendered>32))){
    lastRendered=now;
    const {width:w,height:h}=el.getBoundingClientRect();
    if(w>0&&h>0){
     if(w!==lastW||h!==lastH){renderer.setSize(w,h,false);lastW=w;lastH=h;}lastP=raw;dirty=false;
     const s=choreographyAt(raw),tour=guideAt(raw),mobile=w<740;
     const elevation=T.MathUtils.degToRad(55),sin=Math.sin(elevation),cos=Math.cos(elevation);
     const caption=el.querySelector<HTMLElement>('.route-story-caption')!;
     const left=T.MathUtils.lerp(w*(mobile?.035:.46),w*.035,s.expand),right=w*.975;
     caption.style.left=`${left}px`;caption.style.right=`${w-right}px`;
     const sceneBottom=h-caption.offsetHeight-20;
     const sceneTop=mobile?h*.52*(1-s.expand)+10:14;
     const items:RouteFrameItem[]=subjectPositions.map(p=>({x:p.x,y:p.z*sin-.3*cos,left:0,right:0,top:0,bottom:0,worldRadius:.82}));
     // Reserve only the mascot's current silhouette, not its abandoned platform.
     const walkA=range(raw,6.20,6.51),walkB=range(raw,6.51,6.83);
     const mascotPosition=subjectPositions[0].clone().lerp(subjectPositions[1],walkA).lerp(concepts[0].position,walkB);
     items.push({x:mascotPosition.x,y:mascotPosition.z*sin-2.65*cos,left:0,right:0,top:0,bottom:0,worldRadius:.65});
     const conceptOffset=(index:number)=>.47+(index===0?range(raw,6.64,6.82)*1.05:0);
     const fittingGroups=Array.from({length:4},()=>[...items]);
     for(const {element,kind,index} of labels){
      const width=element.offsetWidth,height=element.offsetHeight||width*6;
      if(kind==='concept'){
       const c=concepts[index],above=c.local%2===0;
       fittingGroups[c.carrier-1].push({x:c.position.x,y:c.position.z*sin-.445*cos+(above?-conceptOffset(index):.47),left:width/2,right:width/2,top:above?height+12:0,bottom:above?0:height+14,worldRadius:.03});
      }else{
       fittingGroups[index-1].push({x:subjectPositions[2].x-.71,y:subjectPositions[index].z*sin-.523*cos,left:width+24,right:0,top:height/2+(index===3?64:0),bottom:height/2-(index===3?64:0)});
      }
     }
     const frames=fittingGroups.map(group=>fitRouteFrame(group,{left,top:sceneTop,right,bottom:sceneBottom}));
     // Move between complete stage frames while travelling, and hold a stable
     // frame while its concepts are being read. Hidden labels do not shrink it.
     const stage=Math.min(3,Math.max(0,Math.floor((tour.number-2)/2)));
     const next=tour.number>1&&tour.number<9&&tour.number%2===1?Math.min(3,stage+1):stage;
     const blend=next===stage?0:tour.local*tour.local*(3-2*tour.local);
     const mixFrame=(a:typeof frames[number],b:typeof frames[number],t:number)=>({scale:T.MathUtils.lerp(a.scale,b.scale,t),labelScale:T.MathUtils.lerp(a.labelScale,b.labelScale,t),x:T.MathUtils.lerp(a.x,b.x,t),y:T.MathUtils.lerp(a.y,b.y,t)});
     const stageFrame=mixFrame(frames[stage],frames[next],blend);
     const framing=raw>=5.52?mixFrame(frames[3],frames[0],range(raw,5.52,5.87)):stageFrame;
     let px=framing.scale;
     const destination=concepts[0].position,target=V();
     const focus=range(raw,6.88,7.06);target.lerp(destination,focus);px*=1+range(raw,7.01,7.28)**2*15;
     camera.left=-w/px/2;camera.right=w/px/2;camera.top=h/px/2;camera.bottom=-h/px/2;
     camera.position.copy(target).add(V(0,sin*30,cos*30*(1-.72*s.portal)));camera.lookAt(target);
     camera.setViewOffset(w,h,(w/2-framing.x)*(1-focus),(h/2-framing.y)*(1-focus),w,h);camera.updateProjectionMatrix();camera.updateMatrixWorld();
     world.visible=raw>=1.70;el.dataset.phase=s.phase;el.dataset.progress=raw.toFixed(5);el.dataset.tourStep=String(tour.number);el.dataset.activeCarrier=tour.carrier===null?'':subjectIds[tour.carrier];
     greens.forEach((g,i)=>{const drop=falling(raw,1.76+i*.052,.20),open=i>0&&i<5?conceptLifecycle(raw,i,0,1).openness:0;g.position.y=drop.height;g.visible=drop.visible;g.scale.set(1+.07*open,drop.squash,1+.07*open);});
     roads.forEach((g,i)=>{const d=falling(raw,2.25+i*.012,.20);g.position.y=-.005+d.height;g.visible=d.visible;});
     const states=concepts.map(c=>conceptLifecycle(raw,c.carrier,c.local,c.count));
     // Reopen the complete first carrier for the handoff, preserving both concepts.
     const returning=raw>=5.87;
     const fadeGroup=(g:T.Group,alpha:number)=>g.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.opacity=alpha;m.depthWrite=alpha>.98;}});
     blues.forEach((g,i)=>{
      const state=states[i],entry=returning&&concepts[i].carrier===1,destinationDrop=falling(raw,5.87+concepts[i].local*.045,.25);
      g.position.y=entry?destinationDrop.height:state.height;
      g.visible=entry?destinationDrop.visible:state.visible&&state.opacity>.002;
      const alpha=entry?range(raw,5.87+concepts[i].local*.045,5.94+concepts[i].local*.045):state.opacity;
      fadeGroup(g,alpha);
      const deck=conceptRoads[i];if(deck){deck.visible=g.visible;deck.position.y=g.position.y;fadeGroup(deck,alpha);}
     });
     bridge.forEach((piece,i)=>{const state=conceptLifecycle(raw,2,i*.45,3);piece.visible=state.visible&&state.opacity>.002;piece.position.y=state.height;fadeGroup(piece,state.opacity);});
     el.dataset.bridgeVisible=String(bridge.some(g=>g.visible));
     el.dataset.visibleConcepts=String(blues.filter(b=>b.visible).length);el.dataset.visibleConceptIds=concepts.filter((_,i)=>blues[i].visible).map(c=>c.id).join(',');
     const landing=falling(raw,routeTimes.mascot[0],.20);
     const lengthA=subjectPositions[0].distanceTo(subjectPositions[1]),lengthB=subjectPositions[1].distanceTo(destination),travel=lengthA*walkA+lengthB*walkB;
     hero.position.copy(subjectPositions[0]).lerp(subjectPositions[1],walkA).lerp(destination,walkB);
     hero.position.y=(walkB>0?surfaceAt(lengthB*walkB,lengthB,.523,.445):surfaceAt(lengthA*walkA,lengthA))+.012+landing.height;
     hero.scale.set(1,landing.squash,1);hero.visible=landing.visible;
     const direction=walkB>0?destination.clone().sub(subjectPositions[1]):subjectPositions[1].clone().sub(subjectPositions[0]);hero.rotation.y=T.MathUtils.lerp(.25,Math.atan2(direction.x,direction.z),range(raw,6.10,6.18));
     if(mixer&&idleAction&&runAction){
      const walking=runBlend*range(raw,6.195,6.24)*(1-range(raw,6.79,6.85));runAction.setEffectiveWeight(walking);idleAction.setEffectiveWeight(1-walking);
      runAction.time=reducedMotion.matches?travel/RUN_STRIDE_LENGTH*.8%.8:runClock;idleAction.time=reducedMotion.matches?.4:(now/1000)%idleAction.getClip().duration;mixer.update(0);
      el.dataset.strideTime=runAction.time.toFixed(4);el.dataset.runWeight=walking.toFixed(4);
     }
     beam.update(raw,s.lightOpacity);
     labels.forEach(({element,kind,index})=>{
      let alpha=0,point:T.Vector3;
      if(kind==='subject'){
       const state=conceptLifecycle(raw,index,0,1);alpha=state.openness;point=subjectPositions[index].clone().add(V(0,.523));
      }else{
       const state=states[index],entry=returning&&concepts[index].carrier===1;
       alpha=entry?range(raw,5.90+concepts[index].local*.045,5.99+concepts[index].local*.045)*(1-range(raw,6.84,6.96)):state.opacity;
       if(!entry&&!state.visible)alpha=0;point=concepts[index].position.clone().add(V(0,blues[index].position.y+.523*.85));
      }
      const projected=point.project(camera);let x=(projected.x*.5+.5)*w,y=(-projected.y*.5+.5)*h;
      if(kind==='subject'){
       const start=subjectPositions[index].clone().add(V(-.78,.55,0)).project(camera),ax=(start.x*.5+.5)*w,ay=(-start.y*.5+.5)*h;
       let tx:number,ty:number;
       // Labels and arrows use the same measured gutter included in camera fitting.
       const gutter=V(subjectPositions[2].x,.523,subjectPositions[index].z).project(camera);
       x=(gutter.x*.5+.5)*w-px*.71-24*framing.labelScale;y-=index===3?64*framing.labelScale:0;
       element.style.transform=`translate(${x}px,${y}px) scale(${framing.labelScale}) translate(-100%,-50%)`;
       tx=x+10;ty=y;
       const curved=index===3;
       const d=curved?`M ${ax} ${ay-5} C ${ax-12} ${ty-34},${tx+44} ${ty-24},${tx} ${ty}`:`M ${ax} ${ay} Q ${(ax+tx)/2} ${ay-3},${tx} ${ty}`;
       const arrow=arrows[index-1];arrow.style.opacity=String(alpha);arrow.style.visibility=alpha<.005?'hidden':'visible';
       for(const path of arrow.children)path.setAttribute('d',`${d} M ${tx+7} ${ty-5} L ${tx} ${ty} L ${tx+7} ${ty+5}`);
      }else{
       const above=concepts[index].local%2===0;y+=above?-(px*conceptOffset(index)+12*framing.labelScale):(px*.47+14*framing.labelScale);element.style.transform=`translate(${x}px,${y}px) scale(${framing.labelScale}) translate(-50%,${above?'-100%':'0'})`;
      }
      element.style.opacity=String(alpha);element.style.visibility=alpha<.005?'hidden':'visible';element.dataset.visible=String(alpha>.5);
     });
     bloom.render(renderer,scene,camera,w,h,s.lightOpacity>.001);
     const projected=destination.clone().add(V(0,.523*.85)).project(camera),rimX=destination.clone().add(V(.53,.523*.85)).project(camera),rimZ=destination.clone().add(V(0,.523*.85,.53)).project(camera);
     const match=range(raw,7.035,7.24),cover=range(raw,7.025,7.16),startX=(projected.x*.5+.5)*w,startY=(-projected.y*.5+.5)*h;
     const rx=Math.abs(rimX.x-projected.x)*w/2,ry=Math.abs(rimZ.y-projected.y)*h/2,targetCard=startCardScreen(w,h),mix=T.MathUtils.lerp;
     // Keep the sphere. It becomes the actual icon inside the shared start card.
     portalShape.setAttribute('cx',String(mix(startX,targetCard.x+41*targetCard.scale,match)));portalShape.setAttribute('cy',String(mix(startY,targetCard.y+30.5*targetCard.scale,match)));
     portalShape.setAttribute('rx',String(mix(rx,9*targetCard.scale,match)));portalShape.setAttribute('ry',String(mix(ry,9*targetCard.scale,match)));
     startCard.style.width=`${rootBox.w}px`;startCard.style.height=`${rootBox.h}px`;
     startCard.style.transform=`translate(${targetCard.x}px,${targetCard.y}px) scale(${targetCard.scale})`;
     const shell=range(raw,7.15,7.335),ink=range(raw,7.30,7.385);
     startCard.style.setProperty('--shell-x',String(mix(.04,1,shell)));startCard.style.setProperty('--shell-y',String(mix(.07,1,shell)));
     startCard.style.setProperty('--card-ink',String(ink));startCard.style.opacity='1';startCard.style.visibility=raw>7.15?'visible':'hidden';
     el.style.setProperty('--portal',String(cover));el.style.setProperty('--portal-ring',String(range(raw,7.025,7.075)*(1-ink)));el.style.setProperty('--scene-fade',String(1-cover));

    }
   }
   frame=requestAnimationFrame(update);
  }
  frame=requestAnimationFrame(update);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();surface.removeEventListener('webglcontextlost',contextLost);mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);beam.group.removeFromParent();beam.dispose();bloom.dispose();release(scene);key.shadow.dispose();renderer.dispose();labelLayer.replaceChildren();};
 },[transition,retry]);
 return <div ref={host} className="scroll-route" aria-label="随滚动展开的 Agent 学习路线示例">
  <canvas ref={canvas} aria-label="纵向绿色载体路线，蓝色概念水平向右展开"/>
  <p className="route-story-caption"><strong>3D 学习路线</strong><span>绿色是阶段，蓝色是概念；独立能力分头学，再汇入同一个作品。</span></p>
  <div className="route-floating-labels" ref={labelsHost}/>
  <div className="route-portal" aria-hidden="true"/>
  <svg className="route-match-cut" aria-hidden="true"><defs><radialGradient id="route-orb-light" cx="35%" cy="25%" r="75%"><stop stopColor="#559dff"/><stop offset=".55" stopColor="#2679ec"/><stop offset="1" stopColor="#1763d4"/></radialGradient></defs><ellipse cx="0" cy="0" rx="0" ry="0" fill="url(#route-orb-light)"/></svg>
  <div className="route-start-card learn-object learn-root" aria-hidden="true"><LearningCardModel kind="root"><LearningStartCard/></LearningCardModel></div>
  {failure&&<div className="route-failure" role="alert">{failure}<button onClick={()=>{setFailure('');setRetry(n=>n+1);}}>重试</button></div>}
  <p className="sr-only">路线示例：LLM 应用开发基础、Agent 循环与受控工具、检索增强生成、Agent 评测与工程交付。光束按九段导览依次前进；每到一站，概念和标题一起落下，离站前升空收起。光束位置不代表学习已完成。</p>
 </div>;
}
