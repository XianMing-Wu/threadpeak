import {Player,type PlayerRef} from '@remotion/player';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AbsoluteFill,interpolate,useCurrentFrame} from 'remotion';
import ReferenceCharacter from './ReferenceCharacter.jsx';

const lines=['如何系统','学习','大模型？'];
const LETTER_START=34,LETTER_STAGGER=2,LETTER_DURATION=10;
// Hand off just after the final letter settles, without a static video tail.
const QUESTION_REVEALED_FRAME=LETTER_START+([...lines.join('')].length-1)*LETTER_STAGGER+LETTER_DURATION;
const DIALOGUE_DURATION=QUESTION_REVEALED_FRAME+5;
const ease=(value:number)=>1-Math.pow(1-value,3);
const progress=(frame:number,start:number,duration:number)=>interpolate(frame,[start,start+duration],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});

/** The cloud and lettering stay frame-driven; the live Rive character follows the pointer. */
function ThoughtDialogue({goalMode=false,conversationLines}:{goalMode?:boolean;conversationLines?:readonly string[]}){
  const frame=useCurrentFrame();
  const dialogueLines=conversationLines??(goalMode?['我想用它','做成','什么？']:lines);
  const cloud=progress(frame,20,27);
  return <AbsoluteFill>
    <svg className="thought-cloud" viewBox="0 0 416 416" aria-hidden="true" style={{position:'absolute',width:360,height:360,left:388,top:51,overflow:'visible'}}>
      <g fill="white" stroke="#080808" strokeWidth="7.5" strokeLinejoin="round">
        <circle cx="99.5" cy="373" r="23" style={{opacity:progress(frame,4,14),transformOrigin:'99.5px 373px',transform:`scale(${.65+.35*progress(frame,4,14)})`}}/>
        <circle cx="168" cy="327" r="34.5" style={{opacity:progress(frame,11,17),transformOrigin:'168px 327px',transform:`scale(${.65+.35*progress(frame,11,17)})`}}/>
        <path d="M102 152C84 96 131 46 183 50C214 51 237 67 253 88C290 59 325 73 340 99C350 117 348 138 338 155C369 168 389 192 386 220C382 264 339 296 286 298C245 300 211 284 194 256C148 275 103 259 83 231C61 201 75 170 102 152Z"
          style={{opacity:cloud,transformOrigin:'220px 260px',transform:`scale(${.75+.25*cloud})`}}/>
      </g>
      <g fill="#080808" textAnchor="middle" fontFamily='"PingFang SC","Microsoft YaHei",sans-serif' fontWeight="500" fontSize="54">
        {dialogueLines.map((line,row)=>{
          const start=row===0?0:dialogueLines.slice(0,row).join('').length;
          return <text key={line} x="229" y={128+row*59} fontSize={conversationLines?(row===0&&/[A-Za-z]/.test(line)?39:44):54}>
            {[...line].map((letter,i)=>{
              const p=conversationLines?1:progress(frame,LETTER_START+(start+i)*LETTER_STAGGER,LETTER_DURATION);
              return <tspan key={i} opacity={p} dy={i===0?(1-p)*8:undefined}>{letter}</tspan>;
            })}
          </text>;
        })}
      </g>
    </svg>
  </AbsoluteFill>;
}

export function CenterDialogue({onComplete,reducedMotion,goalMode=false,conversationLines}:{onComplete:()=>void;reducedMotion:boolean;goalMode?:boolean;conversationLines?:readonly string[]}){
  const inputProps=useMemo(()=>({goalMode,conversationLines}),[goalMode,conversationLines]);
  const player=useRef<PlayerRef>(null);
  const host=useRef<HTMLDivElement>(null);
  const completed=useRef(false);
  const[ready,setReady]=useState(false);
  const characterReady=useCallback(()=>setReady(true),[]);
  useEffect(()=>{
    const current=player.current;
    if(!current||!ready)return;
    const finish=()=>{if(!completed.current){completed.current=true;onComplete();}};
    const frame=({detail}:{detail:{frame:number}})=>{if(host.current)host.current.dataset.frame=String(detail.frame);};
    current.addEventListener('ended',finish);
    current.addEventListener('frameupdate',frame);
    if(reducedMotion){current.seekTo(DIALOGUE_DURATION-1);finish();}else current.play();
    return()=>{current.removeEventListener('ended',finish);current.removeEventListener('frameupdate',frame);};
  },[onComplete,reducedMotion,ready]);
  return <div ref={host} className="center-dialogue" aria-label={conversationLines?.join('')??(goalMode?'我想用它做成什么？':'如何系统学习大模型？')} data-ready={ready}>
    <div className="reference-character"><ReferenceCharacter onReady={characterReady} reducedMotion={reducedMotion}/></div>
    <Player ref={player} component={ThoughtDialogue} inputProps={inputProps} durationInFrames={DIALOGUE_DURATION} compositionWidth={600}
      compositionHeight={600} fps={60} initiallyMuted overflowVisible controls={false} loop={false} moveToBeginningWhenEnded={false}
      clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false}
      numberOfSharedAudioTags={0} style={{position:'absolute',inset:0,width:'100%',pointerEvents:'none'}}/>
  </div>;
}
