import './send-control.css'

/** One action, in the same place, across every question composer. */
export function SendControl({busy=false,disabled=false,submitting=false,onSend,onStop,sendLabel='发送'}:{
  busy?:boolean;disabled?:boolean;submitting?:boolean;onSend:()=>void;onStop?:()=>void;sendLabel?:string
}) {
  const stopped=busy&&!submitting
  const label=submitting?'正在发送':stopped?'停止生成':sendLabel
  return <button type="button" className="send-control" data-state={submitting?'submitting':stopped?'stop':'send'}
    aria-label={label} title={label} disabled={submitting||(stopped?!onStop:disabled)}
    onClick={stopped?onStop:onSend}>
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
      {stopped?<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>:<path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>}
    </svg>
  </button>
}
