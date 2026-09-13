import {useEffect,useRef,useState} from 'react';
import {loadRiveRuntime,loadRiveBytes} from './rive-loader.js';
import sourceUrl from './rive/reference.riv?url';
import poster from './characters/posters/reference.webp?url';

// Keep room for the full left/right head turn, not just the neutral portrait.
const crop={minX:150,minY:100,maxX:850,maxY:850};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export default function ReferenceCharacter({onReady,reducedMotion=false}){
  const canvasRef=useRef(null);
  const callback=useRef(onReady);callback.current=onReady;
  const[status,setStatus]=useState('loading');
  useEffect(()=>{
    const canvas=canvasRef.current;
    const trackingArea=canvas.closest('.orbit-stage')??canvas;
    const composition=canvas.closest('.combined-page');
    const abort=new AbortController();
    let destroyed=false,runtime,file,artboard,machine,renderer,frameId=0,last=0,recoveryTimer=0;
    let pointer=null;
    const release=()=>{
      if(frameId)runtime?.cancelAnimationFrame(frameId);
      machine?.delete();artboard?.delete();file?.unref();renderer?.delete();
      machine=artboard=file=renderer=undefined;
    };
    const resize=()=>{
      const dpr=clamp(devicePixelRatio||1,2,3);
      canvas.width=Math.max(1,Math.round(canvas.clientWidth*dpr));
      canvas.height=Math.max(1,Math.round(canvas.clientHeight*dpr));
    };
    const look=event=>{if(event.pointerType!=='touch')pointer={x:event.clientX,y:event.clientY};};
    const center=()=>{pointer=null;};
    const draw=time=>{
      frameId=0;if(destroyed)return;
      const rect=canvas.getBoundingClientRect();
      const x=!reducedMotion&&pointer?clamp((pointer.x-rect.left-rect.width/2)/(rect.width*.8),-1,1):(composition?.dataset.scene==='interview'?0.7:0);
      const y=!reducedMotion&&pointer?clamp((pointer.y-rect.top-rect.height/2)/(rect.height*.8),-1,1):0;
      machine.pointerMove(500+x*500,500+y*500,0);
      canvas.dataset.lookX=x.toFixed(3);canvas.dataset.lookY=y.toFixed(3);
      const dt=last&&!reducedMotion&&!document.hidden?Math.min((time-last)/1000,.05):0;last=time;
      machine.advanceAndApply(dt);artboard.advance(dt);
      renderer.clear();renderer.save();
      renderer.align(runtime.Fit.contain,runtime.Alignment.center,{minX:0,minY:0,maxX:canvas.width,maxY:canvas.height},crop);
      artboard.draw(renderer);renderer.restore();renderer.flush();
      if(!document.hidden)frameId=runtime.requestAnimationFrame(draw);
    };
    const resume=()=>{last=0;if(!document.hidden&&renderer&&!frameId)frameId=runtime.requestAnimationFrame(draw);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);
    trackingArea.addEventListener('pointerenter',look,{passive:true});
    trackingArea.addEventListener('pointermove',look,{passive:true});
    trackingArea.addEventListener('pointerleave',center);
    window.addEventListener('blur',center);
    document.addEventListener('visibilitychange',resume);
    setStatus('loading');
    const load=async(attempt=0)=>{
      if(destroyed)return;
      try{
        const[rt,bytes]=await Promise.all([loadRiveRuntime(),loadRiveBytes(sourceUrl,abort.signal)]);
        if(destroyed)return;
        runtime=rt;
        const loaded=await runtime.load(bytes,undefined,false);
        if(destroyed){loaded?.unref();return;}
        file=loaded;if(!file)throw new Error('Rive 文件无法解析');
        artboard=file.artboardByName('Artboard');
        if(!artboard)throw new Error('找不到独立角色画板');
        const definition=artboard.stateMachineByName('State Machine 1');
        if(!definition)throw new Error('找不到角色状态机');
        machine=new runtime.StateMachineInstance(definition,artboard);
        renderer=runtime.makeRenderer(canvas);resize();draw(0);
        setStatus('ready');callback.current?.();
      }catch(error){if(!destroyed){release();setStatus('error');
        if(attempt===0)recoveryTimer=window.setTimeout(()=>load(1),1000);
        else console.warn('参考角色使用静态展示',error);
      }}
    };load();
    return()=>{
      destroyed=true;clearTimeout(recoveryTimer);abort.abort();release();observer.disconnect();
      trackingArea.removeEventListener('pointerenter',look);trackingArea.removeEventListener('pointermove',look);
      trackingArea.removeEventListener('pointerleave',center);window.removeEventListener('blur',center);
      document.removeEventListener('visibilitychange',resume);
    };
  },[reducedMotion]);
  return <div className="reference-rive" data-status={status}>
    <img className="reference-poster" src={poster} alt="中央角色（静态展示）" onLoad={()=>callback.current?.()} draggable={false}/>
    <canvas ref={canvasRef} role="img" aria-label="中央角色：参考 Rive 动画"/>
  </div>;
}
