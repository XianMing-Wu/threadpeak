import {useEffect,useRef,useState} from 'react'
import {advanceStream} from './streaming-text'

/** Presentation is independent of network chunks and never manufactures model output. */
export function useStreamingText(text:string,active=true){
  const [shown,setShown]=useState(active?'':text)
  const latest=useRef(text),position=useRef(active?0:text.length),previous=useRef(text)
  useEffect(()=>{
    latest.current=text
    if(!text.startsWith(previous.current)){position.current=0;setShown('')}
    previous.current=text
  },[text])
  useEffect(()=>{
    if(!active||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){position.current=text.length;setShown(text);return}
    let frame=0,last=0
    const tick=(now:number)=>{
      if(!last)last=now-34
      if(now-last>=32){
        const next=advanceStream(latest.current,position.current,now-last);last=now
        if(next!==position.current){position.current=next;setShown(latest.current.slice(0,next))}
      }
      if(position.current<latest.current.length)frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[text,active])
  return active&&text.startsWith(shown)?shown:text
}
