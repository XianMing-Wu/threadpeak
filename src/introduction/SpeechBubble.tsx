// The tail can slide along the lower edge on narrow screens while staying
// attached to the same head. The two hand-drawn silhouettes keep their direction.
export function speechPath(side:'left'|'right',shift=0){
  const x=(n:number)=>n+shift;
  return side==='left'
    ?`M43 32C67 30 117 31 139 32C159 34 165 49 165 72C166 94 163 111 147 115C134 113 ${x(120)} 113 ${x(110)} 116C${x(103)} 118 ${x(104)} 124 ${x(107)} 129C${x(95)} 126 ${x(95)} 116 ${x(85)} 115C67 114 43 117 29 112C17 108 16 89 16 73C15 51 22 33 43 32Z`
    :`M45 26C70 24 118 25 139 26C157 28 163 44 163 67C164 88 160 105 145 109C130 110 ${x(116)} 108 ${x(105)} 109C${x(95)} 109 ${x(96)} 117 ${x(82)} 122C${x(87)} 117 ${x(90)} 110 ${x(83)} 109C66 106 39 113 27 107C16 101 15 86 15 69C14 45 22 27 45 26Z`;
}
export function SpeechBubble({id,message}:{id:string;message:string}){
  return <span className="speech-bubble" id={`speech-${id}`} role="tooltip">
    <svg className="speech-outline speech-outline-left" viewBox="0 15 176 124" aria-hidden="true">
      <path d={speechPath('left')}/>
    </svg>
    <svg className="speech-outline speech-outline-right" viewBox="0 9 180 127" aria-hidden="true">
      <path d={speechPath('right')}/>
    </svg>
    <span className="speech-copy">{message}</span>
  </span>;
}
