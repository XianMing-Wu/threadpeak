import {useId, type ReactNode} from 'react';
import {PRODUCT_ENTRY} from './showcase-links';
import navLettering from './assets/entry-nav.svg';
import finaleLettering from './assets/entry-finale.svg';
import './showcase-controls.css';

export function EntryLink({className='', children}:{className?:string; children:ReactNode}) {
  const large=className==='finale-login';
  return <a className={`entry-link ${className}`} href={PRODUCT_ENTRY} target="_top" aria-label={String(children)}>
    <svg className="entry-outline" viewBox="0 0 300 80" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path className="entry-paper" d="M20 4C94 2 194 5 278 3Q296 3 296 21L295 59Q295 75 277 75C193 77 95 74 20 77Q4 77 4 60L5 22Q5 5 20 4Z"/>
      <path className="entry-pencil" d="M32 77Q124 74 218 77"/>
    </svg>
    <span className="entry-label"><img src={large?finaleLettering:navLettering} alt=""/></span>
    <span className="entry-arrow" aria-hidden="true">
      <svg viewBox="0 0 38 32" fill="none">
        <g className="entry-travel"><path d="M3 17C13 15 23 17 32 15M24 8L33 15L25 23"/><path className="entry-arrow-echo" d="M5 20L22 19"/></g>
      </svg>
    </span>
  </a>;
}

export function NavigationOrnaments() {
  return <div className="navigation-ornaments" aria-hidden="true">
    <svg className="navigation-ridge navigation-ridge-left" viewBox="0 0 300 56" fill="none">
      <path d="M3 40C45 36 58 44 90 37L121 13L137 29L148 20L168 38C210 30 248 40 297 31" stroke="#d3dfed" strokeWidth="1.1"/>
      <path d="M102 28L121 13L133 25M137 29L148 20L162 33" stroke="#6e98cf" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="navigation-ridge-light" d="M3 40C45 36 58 44 90 37L121 13L137 29L148 20L168 38C210 30 248 40 297 31" pathLength="100" stroke="#4887d9" strokeWidth="1.4"/>
      <path d="M182 45Q210 39 242 44" stroke="#e6edf6"/>
    </svg>
    <svg className="navigation-ridge navigation-ridge-right" viewBox="0 0 300 56" fill="none">
      <path d="M3 32C68 39 88 23 126 31S175 46 206 28L225 13L236 26L247 19L274 35L298 33" stroke="#d3dfed" strokeWidth="1.1"/>
      <path d="M206 28L225 13L236 26L247 19L260 27" stroke="#6e98cf" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="navigation-ridge-light" d="M3 32C68 39 88 23 126 31S175 46 206 28L225 13L236 26L247 19L274 35L298 33" pathLength="100" stroke="#4887d9" strokeWidth="1.4"/>
      <path d="M53 46Q87 40 109 44" stroke="#e6edf6"/>
    </svg>
  </div>;
}

export function ScrollMouse() {
  const id=useId();
  return <svg className="scroll-mouse" viewBox="0 0 38 54" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-body`} x1="4" y1="7" x2="33" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset=".52" stopColor="#f4f8ff"/><stop offset="1" stopColor="#e4edf9"/></linearGradient>
      <linearGradient id={`${id}-edge`} x1="3" y1="3" x2="36" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#c1d4ee"/><stop offset=".6" stopColor="#7b9dc8"/><stop offset="1" stopColor="#c7d8ef"/></linearGradient>
      <clipPath id={`${id}-wheel`}><rect x="16" y="10" width="6" height="13" rx="3"/></clipPath>
    </defs>
    <path d="M19 2C8 2 3 10 3 21V33C3 44 8 51 19 51S35 44 35 33V21C35 10 30 2 19 2Z" fill={`url(#${id}-body)`} stroke={`url(#${id}-edge)`} strokeWidth="1.5"/>
    <path d="M7 34C7 42 11 47 19 47S31 42 31 34" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 3V8M19 26V30M4 28C11 31 27 31 34 28" stroke="#bacde6"/>
    <rect x="13.5" y="7.5" width="11" height="18" rx="5.5" fill="#dbe8fc" stroke="#a5c1e8"/>
    <rect x="16" y="10" width="6" height="13" rx="3" fill="#3378e0"/>
    <g clipPath={`url(#${id}-wheel)`}><g className="scroll-wheel-tread" stroke="#cfe9ff" strokeWidth="1.5">{[6,10,14,18,22,26].map(y=><path key={y} d={`M16 ${y}h6`}/>)}</g></g>
    <path className="scroll-mouse-direction" d="M16 36L19 39L22 36" stroke="#4484df" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export function ScrollChevrons() {
  return <svg className="scroll-chevrons" viewBox="0 0 24 40" fill="none" aria-hidden="true">
    {[0,1,2].map(i=><g key={i}>
      <path d={`M5 ${5+i*11}L12 ${12+i*11}L19 ${5+i*11}`} stroke="#d2e1f6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path className={`scroll-chevron-light scroll-chevron-${i}`} d={`M5 ${5+i*11}L12 ${12+i*11}L19 ${5+i*11}`} pathLength="1" stroke="#2774e6" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    </g>)}
  </svg>;
}
