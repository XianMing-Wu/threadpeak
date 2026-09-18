import type { ReactNode } from 'react';
const stroke = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function Mark({ children }: {
    children: ReactNode;
}) {
    return <svg className="pitch-card-mark" viewBox="0 0 280 96" fill="none" aria-hidden="true">{children}</svg>;
}
function Person({ x, fill, strokeColor, label, labelColor }: {
    x: number;
    fill: string;
    strokeColor: string;
    label: string;
    labelColor: string;
}) {
    return <g transform={`translate(${x} 8)`}>
   <circle cx="36" cy="16" r="10" fill={fill} stroke={strokeColor} strokeWidth="1.8"/>
   <rect x="18" y="30" width="36" height="22" rx="11" fill={fill} stroke={strokeColor} strokeWidth="1.8"/>
   <text x="36" y="72" textAnchor="middle" fill={labelColor} fontSize="12" fontFamily="CardSans, PingFang SC, sans-serif">{label}</text>
  </g>;
}
export function IntroMark({ tone }: {
    tone: string;
}) {
    if (tone === 'notes')
        return <Mark>
   <rect x="34" y="22" width="64" height="44" rx="8" fill="#fff" stroke="#c5d4e4" strokeWidth="1.8" transform="rotate(-6 66 44)"/>
   <rect x="108" y="18" width="64" height="44" rx="8" fill="#fff" stroke="#8fb0d8" strokeWidth="1.8"/>
   <rect x="182" y="24" width="64" height="44" rx="8" fill="#fff" stroke="#c5d4e4" strokeWidth="1.8" transform="rotate(6 214 46)"/>
   <path d="M48 36h32M48 46h24M122 32h36M122 42h28M196 38h32M196 48h22" stroke="#c5d4e4" strokeWidth="1.8" {...stroke}/>
  </Mark>;
    if (tone === 'human')
        return <Mark>
   <Person x={22} fill="#e8f1fb" strokeColor="#2f6fe0" label="评估" labelColor="#1777e6"/>
   <Person x={104} fill="#eef6f4" strokeColor="#65948d" label="审美" labelColor="#4f7f78"/>
   <Person x={186} fill="#f7f0e4" strokeColor="#c99656" label="亲历" labelColor="#a07838"/>
  </Mark>;
    return <Mark>
   <path d="M24 64c36-24 56-6 88-24" stroke="#8caec6" strokeWidth="2" {...stroke}/>
   <circle cx="24" cy="64" r="3.5" fill="#8caec6"/>
   <path d="M118 36 138 56M138 36 118 56" stroke="#c99656" strokeWidth="2" {...stroke}/>
   <rect x="168" y="22" width="88" height="52" rx="8" fill="#fff" stroke="#c5d4e4" strokeWidth="1.8"/>
   <path d="M182 38h60M182 50h44M182 62h52" stroke="#c5d4e4" strokeWidth="1.8" {...stroke}/>
  </Mark>;
}
export function StepMark({ no }: {
    no: string;
}) {
    if (no === '02')
        return <Mark>
   <circle cx="28" cy="48" r="4" fill="#8caec6"/>
   <path d="M32 48h36c16 0 24-16 40-16" stroke="#8caec6" strokeWidth="2" {...stroke}/>
   <path d="M68 48c16 0 24 16 40 16" stroke="#2f6fe0" strokeWidth="2" {...stroke}/>
   <rect x="116" y="16" width="72" height="28" rx="10" fill="#fff" stroke="#b7c8d8" strokeWidth="1.8"/>
   <rect x="116" y="52" width="72" height="28" rx="10" fill="#e8f1fb" stroke="#8fb0d8" strokeWidth="1.8"/>
   <circle cx="108" cy="32" r="3.5" fill="#8caec6"/>
   <circle cx="108" cy="66" r="3.5" fill="#2f6fe0"/>
  </Mark>;
    if (no === '03')
        return <Mark>
   <rect x="16" y="34" width="52" height="28" rx="7" fill="#fff" stroke="#8fb0d8" strokeWidth="1.8"/>
   <path d="M68 48h20" stroke="#c5d4e4" strokeWidth="1.8"/>
   <rect x="88" y="16" width="52" height="28" rx="7" fill="#fff" stroke="#2f6fe0" strokeWidth="1.8"/>
   <rect x="88" y="52" width="52" height="28" rx="7" fill="#fff" stroke="#c5d4e4" strokeWidth="1.8"/>
   <path d="M140 30h20M140 66h20" stroke="#c5d4e4" strokeWidth="1.8"/>
   <rect x="160" y="16" width="52" height="28" rx="7" fill="#e8f1fb" stroke="#8fb0d8" strokeWidth="1.8"/>
   <rect x="160" y="52" width="52" height="28" rx="7" fill="#fff" stroke="#c5d4e4" strokeWidth="1.8"/>
  </Mark>;
    if (no === '04')
        return <Mark>
   <path d="M52 28C88 28 88 48 112 48M52 48H112M52 68C88 68 88 48 112 48" stroke="#c5d4e4" strokeWidth="1.8" {...stroke}/>
   <circle cx="40" cy="28" r="12" fill="#e8f1fb" stroke="#2f6fe0" strokeWidth="1.8"/>
   <circle cx="40" cy="48" r="12" fill="#eef6f4" stroke="#65948d" strokeWidth="1.8"/>
   <circle cx="40" cy="68" r="12" fill="#f7f0e4" stroke="#c99656" strokeWidth="1.8"/>
   <circle cx="128" cy="48" r="16" fill="#fff" stroke="#8fb0d8" strokeWidth="1.8"/>
  </Mark>;
    return <Mark>
   <rect x="36" y="26" width="208" height="44" rx="12" fill="#fff" stroke="#8fb0d8" strokeWidth="1.8"/>
   <circle cx="58" cy="48" r="5" fill="#2f6fe0"/>
   <path d="M72 48h118" stroke="#c5d4e4" strokeWidth="2" {...stroke}/>
   <rect x="204" y="36" width="28" height="24" rx="8" fill="#1777e6"/>
   <path d="M213 48h10" stroke="#fff" strokeWidth="2" {...stroke}/>
  </Mark>;
}
