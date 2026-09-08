import './route-hero.css'

export function RouteHero({ title, sub }: { title: string; sub: string }) {
  return (
    <section className="route-hero">
      <svg className="route-hero-art route-hero-art--left" viewBox="0 0 360 180" aria-hidden="true" focusable="false">
        <path className="route-hero-trail" d="M66-24C12 20 34 120 117 126S238 43 310 72 380 151 338 189" />
        <path className="route-hero-trail route-hero-trail--faint" d="M3 93C84 113 121 40 173-12" />
        <g transform="translate(91 37) rotate(-15)">
          <rect x="-32" y="-16" width="64" height="32" rx="16" fill="#eaf8ef" />
          <text className="route-hero-label" fill="#619a76">探索</text>
        </g>
        <g transform="translate(246 115) rotate(12)">
          <rect x="-32" y="-16" width="64" height="32" rx="16" fill="#edf4ff" />
          <text className="route-hero-label" fill="#759bcb">目标</text>
        </g>
        <g transform="translate(132 57) rotate(9)" fill="none" stroke="#bdcfe3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 4Q13-1 25 4V36Q13 31 0 36ZM25 4Q38-1 50 4V36Q38 31 25 36Z" fill="#f8fbff" />
          <path d="M7 12 18 12M7 19 18 19M32 12 43 12M32 19 43 19" />
          <path d="M36 1V14L40 11 44 14V2" fill="#dcecfb" stroke="none" />
        </g>
        <circle cx="49" cy="106" r="4" fill="#d6e5fa" />
        <path d="M300 27V35M296 31H304" stroke="#d1dce9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <div className="route-hero-copy">
        <div className="route-hero-heading">
          <svg className="route-hero-heading-art" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <g transform="rotate(-16 24 24)" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="24" cy="24" r="17" fill="#f4f8fe" stroke="#c0d3e9" strokeWidth="1.4" />
              <circle cx="24" cy="24" r="12.5" stroke="#e0eaf6" />
              <path d="M24 11V14M24 34V37M11 24H14M34 24H37" stroke="#b3cbe5" strokeWidth="1.4" />
              <path d="M30 15 27 27 18 33 21 21Z" fill="#fff" stroke="#abc6e5" strokeWidth="1.2" />
              <path d="M30 15 27 27 21 21Z" fill="#97b9e2" stroke="none" />
              <circle cx="24" cy="24" r="1.5" fill="#fff" />
            </g>
            <path d="M6 5V10M3.5 7.5H8.5" stroke="#d4e3f4" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <h1>{title}</h1>
          <svg className="route-hero-heading-art" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 38C8 43 17 42 16 37S7 33 4 40" stroke="#d3e2f3" strokeWidth="1.3" strokeDasharray="1 3" />
              <path d="M7 18 42 6 31 38 22 26Z" fill="#f1f7ff" stroke="#b6cde7" strokeWidth="1.4" />
              <path d="M42 6 22 26 19 36 16 23Z" fill="#e0edfb" stroke="#b6cde7" strokeWidth="1.3" />
              <path d="M19 36 25 30" stroke="#b6cde7" strokeWidth="1.3" />
              <path d="M39 39V44M36.5 41.5H41.5" stroke="#d4e3f4" strokeWidth="1.2" />
            </g>
          </svg>
        </div>
        <p>{sub}</p>
      </div>

      <svg className="route-hero-art route-hero-art--right" viewBox="0 0 360 180" aria-hidden="true" focusable="false">
        <path className="route-hero-trail" d="M-18 99C47 80 54-7 112-18S112 122 202 123 309 38 383 62" />
        <path className="route-hero-trail route-hero-trail--faint" d="M172-23C186 55 265 164 356 137" />
        <g transform="translate(83 39) rotate(-16)">
          <rect x="-32" y="-16" width="64" height="32" rx="16" fill="#eaf7fc" />
          <text className="route-hero-label" fill="#70b4cc">实践</text>
        </g>
        <g transform="translate(201 128) rotate(14)">
          <rect x="-32" y="-16" width="64" height="32" rx="16" fill="#fff1e8" />
          <text className="route-hero-label" fill="#d59b76">成长</text>
        </g>
        <g transform="translate(213 36)" fill="none" stroke="#8bafd2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 69 28 24 45 47 75 4 116 69Z" fill="#eaf3fc" />
          <path d="M17 42 28 46 35 35M61 25 69 28 75 20 83 26" fill="#fff" />
          <path d="M42 69 59 48 72 61 85 45 102 69" stroke="#b2cbe3" />
          <path d="M75 4V-13L96-7 75-1" fill="#92bced" stroke="#759ecc" />
          <path d="M-6 74H122" stroke="#d9e7f4" />
        </g>
        <circle cx="143" cy="91" r="4" fill="#eadff4" />
        <path d="M312 127V135M308 131H316" stroke="#d1dce9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </section>
  )
}
