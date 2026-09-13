import { useEffect, useId, useState } from 'react'
import type { CSSProperties } from 'react'

/** An illustrative journey, independent of authentication and personal learning data. */
export function LoginJourney({ paused }: { paused: boolean }) {
  const id = useId().replaceAll(':', '')
  const [chapter, setChapter] = useState(0)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(() => !document.hidden)
  const running = !paused && !reduced && visible
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media.matches)
    const visibility = () => setVisible(!document.hidden)
    media.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setChapter(current => (current + 1) % 3), 5200)
    return () => window.clearInterval(timer)
  }, [running])
  return <div className="login-journey" data-running={running} data-chapter={chapter}>
    <svg className="login-journey-art" viewBox="0 0 680 355" role="img" aria-label="学习过程示意：从一个文档助手目标出发，实践并留下记录，遇到难题时寻找有相关经验的博主">
      <defs>
        <linearGradient id={`${id}-road`} x1="0" x2="1"><stop stopColor="#7dafea"/><stop offset="1" stopColor="#9cccbc"/></linearGradient>
        <filter id={`${id}-shadow`} x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#416988" floodOpacity=".08"/></filter>
        <pattern id={`${id}-dots`} width="19" height="19" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor"/></pattern>
      </defs>
      <ellipse cx="350" cy="283" rx="301" ry="62" fill={`url(#${id}-dots)`} className="journey-grid"/>
      <g className="journey-horizon" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M336 88 375 31 396 60 423 18 478 90M364 48l11 11 12-11M408 40l15 15 10-9M328 91c60-8 113-5 163 2"/>
        <path d="M611 47v14m-7-7h14M13 90v12m-6-6h12"/>
        <circle cx="647" cy="100" r="3"/>
      </g>
      <path className="journey-road" d="M114 287C215 296 222 211 326 211S451 287 567 287" fill="none" stroke={`url(#${id}-road)`} strokeWidth="12" opacity=".14"/>
      <path className="journey-road" d="M114 287C215 296 222 211 326 211S451 287 567 287" fill="none" stroke={`url(#${id}-road)`} strokeWidth="1.6"/>
      <path className="journey-trace" d="M114 287C215 296 222 211 326 211S451 287 567 287" pathLength="100" fill="none" stroke="var(--auth-accent)" strokeWidth="2.8" strokeLinecap="round"/>
      <g stroke="var(--auth-line-strong)" strokeWidth="1" fill="none"><path d="M114 250v35M326 173v37M567 250v35"/><path d="M202 259q-26 43-12 65m250-77q32-8 61 12" strokeDasharray="3 6"/></g>
      <g className="journey-paper journey-paper-goal" style={{ '--paper-delay': '0s' } as CSSProperties}>
        <g filter={`url(#${id}-shadow)`}>
          <rect x="26" y="133" width="215" height="120" rx="9" className="journey-paper-back" transform="rotate(-3 133 194)"/>
          <rect x="23" y="126" width="215" height="120" rx="9" className="journey-paper-face"/>
        </g>
        <circle cx="40" cy="145" r="3" className="journey-blue"/><text x="50" y="149" className="journey-kicker">我想实现</text>
        <text x="40" y="180" className="journey-strong">做一个能用起来的</text><text x="40" y="203" className="journey-strong">文档助手<tspan className="journey-caret">│</tspan></text>
        <path d="M40 225h146" stroke="var(--auth-line)"/><g className="journey-send" fill="none" stroke="var(--auth-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M201 222h18m-6-6 6 6-6 6"/></g>
      </g>
      <g className="journey-paper journey-paper-practice" style={{ '--paper-delay': '-1.7s' } as CSSProperties}>
        <g filter={`url(#${id}-shadow)`}>
          <path d="M252 35h183l16 17v116a7 7 0 0 1-7 7H252a7 7 0 0 1-7-7V42a7 7 0 0 1 7-7Z" className="journey-paper-face"/>
          <path d="M435 35v17h16" className="journey-paper-back"/>
        </g>
        <text x="264" y="59" className="journey-kicker">我的学习笔记</text><text x="264" y="86" className="journey-strong">这一步，学到够用</text>
        <g className="journey-ticks" fill="none" stroke="var(--auth-green)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m265 106 3 3 6-7"/><path d="m265 129 3 3 6-7"/></g>
        <text x="284" y="110" className="journey-body">接入资料，核对引用</text><text x="284" y="133" className="journey-body">亲手试用，记录结果</text>
        <path d="M264 155h60m8 0h24" stroke="var(--auth-line-strong)"/>
        <path d="M410 34v23l7-5 7 5V34" fill="var(--auth-blue-wash)" stroke="var(--auth-line-strong)"/>
      </g>
      <g className="journey-paper journey-paper-person" style={{ '--paper-delay': '-3.4s' } as CSSProperties}>
        <g filter={`url(#${id}-shadow)`}><path d="M478 128h174a8 8 0 0 1 8 8v100a8 8 0 0 1-8 8H529l-13 11v-11h-38a8 8 0 0 1-8-8V136a8 8 0 0 1 8-8Z" className="journey-paper-face"/></g>
        <g transform="translate(492 151)" fill="none" stroke="var(--auth-green)" strokeWidth="1.3"><circle r="10" fill="var(--auth-green-wash)"/><circle cy="-2" r="3"/><path d="M-5 6c0-6 10-6 10 0"/></g>
        <text x="510" y="155" className="journey-kicker">寻找咨询人选</text><text x="488" y="183" className="journey-strong">遇到真实项目难题</text>
        <text x="488" y="207" className="journey-body">带着复现与尝试</text><text x="488" y="227" className="journey-body">找做过的人请教</text>
      </g>
      {[{x:114,y:287},{x:326,y:211},{x:567,y:287}].map((point,index) => <g key={index} transform={`translate(${point.x} ${point.y})`} className={`journey-node ${chapter === index ? 'is-current' : ''}`}>
        <circle r="17" className="journey-node-halo"/><circle r="9" className="journey-node-base"/><circle r="3.5" className="journey-node-center"/>
      </g>)}
      <g transform="translate(599 44) rotate(13)" className="journey-plane" fill="none" stroke="var(--auth-accent)" strokeWidth="1.3" strokeLinejoin="round"><path d="m-22 5 38-15-11 34-9-12-18-7Z" fill="var(--auth-blue-wash)"/><path d="M-22 5 16-10-4 12l-5 9 1-11"/></g>
    </svg>
  </div>
}
