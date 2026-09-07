import './home-landscape.css'

/** A colored mountain sketch above the wordmark; decorative and non-interactive. */
export function HomeLandscape() {
  return <div className="home-landscape" aria-hidden="true">
    <svg viewBox="0 0 640 180" fill="none" focusable="false">
      <circle cx="455" cy="47" r="24" fill="#f7dfac"/>
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="m83 149 100-84 60 48 55-64 90 102" fill="#e1edf4" stroke="#8caec6" strokeWidth="2"/>
        <path d="m338 149 75-71 44 40 44-52 67 83" fill="#e9f0e7" stroke="#a6bca6" strokeWidth="2"/>
        <path d="m189 151 84-76 64-51 59 77 70 50" fill="#cfe3df" stroke="#65948d" strokeWidth="2.5"/>
        <path d="m273 75 64-51 31 41-23-7-17 12-15-9-20 14Z" fill="#fff"/>
        <path d="m273 75 20 0 20-14 15 9 17-12 23 7" stroke="#87aaa4" strokeWidth="1.6"/>
        <path d="m337 24 7 46 26 37-5 43" stroke="#8cb4ac" strokeWidth="1.6"/>
        <path d="m148 94 35-29 22 18-16-2-9 9-13-5Z" fill="#fff"/>
        <path d="M70 151c61-5 94 4 141 1s65-5 108-2 79 1 110 0 82 4 145 0" stroke="#b1c8c2" strokeWidth="1.6"/>
        <path d="M282 151c37-9 65-12 53-23s-57-8-37-22 40-8 32-22-15-14-5-25l10-15" stroke="#fff" strokeWidth="6"/>
        <path d="M282 151c37-9 65-12 53-23s-57-8-37-22 40-8 32-22-15-14-5-25l10-15" stroke="#c99656" strokeWidth="2.2"/>
        <circle cx="282" cy="151" r="3.8" fill="#fff" stroke="#c99656" strokeWidth="1.8"/>
        <circle cx="335" cy="44" r="2.8" fill="#c99656"/>
        <path d="M108 48h24m7 0h13M470 30h18m7 0h18M83 123h11m433-11h19" stroke="#c3d4dc" strokeWidth="1.8"/>
        <path d="m224 38 6-3 6 3m8-7 5-2 5 2" stroke="#91aab7" strokeWidth="1.6"/>
      </g>
    </svg>
  </div>
}
