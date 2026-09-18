import { useEffect,useRef,useState,type ReactNode } from 'react';
import attentionFormula from "../../../assets/lettering/attention-formula.svg";
import { goalIllustrationAt } from "./goal-illustration-motion.ts";
function PaperLines({ x, y, width = 118, rows = 4 }: {
    x: number;
    y: number;
    width?: number;
    rows?: number;
}) { return <g stroke="#cfdaE5" strokeWidth="2.5" strokeLinecap="round">{Array.from({ length: rows }, (_, i) => <path key={i} d={`M${x} ${y + i * 10}h${i === rows - 1 ? width * .7 : width}`}/>)}</g>; }
function Drawing({ children, kind }: {
    children: ReactNode;
    kind: string;
}) { return <svg className={`finale-drawing finale-drawing-${kind}`} viewBox="0 0 360 310" fill="none" aria-hidden="true"><defs><linearGradient id={`finale-paper-${kind}`} x2=".6" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#f8fbff"/></linearGradient><linearGradient id={`finale-edge-${kind}`}><stop stopColor="#b4e8e2"/><stop offset=".5" stopColor="#4d8de4"/><stop offset="1" stopColor="#dcecff"/></linearGradient></defs>{children}</svg>; }
export function PaperIllustration({ page }: {
    page: number;
}) {
    return <Drawing kind="pdf">
 <ellipse cx="173" cy="282" rx="119" ry="10" fill="#dce5ef" opacity=".16"/>
 <g className="finale-paper-stack"><rect x="89" y="35" width="190" height="237" rx="9" transform="rotate(8 184 154)" fill="#f4f8fd" stroke="#d9e4ef"/><rect x="69" y="25" width="194" height="239" rx="9" transform="rotate(-6 166 145)" fill="#fff" stroke="#d9e4ef"/></g>
 <g className="finale-paper-front"><path d="M66 19H223L255 51V255Q255 267 243 267H66Q54 267 54 255V31Q54 19 66 19Z" fill="url(#finale-paper-pdf)" stroke="#bdcfe3" strokeWidth="1.2"/><path d="M223 19V43Q223 51 231 51H255" fill="#eff5fc" stroke="#bdcfe3"/><path className="finale-ink-trace" d="M66 19H223L255 51V255Q255 267 243 267H66Q54 267 54 255V31Q54 19 66 19Z" stroke="url(#finale-edge-pdf)" pathLength="100"/>
 <text x="76" y="50" className="finale-art-label">上传 · PDF</text>
 <g key={page} className="finale-page-content">{page === 0 ? <><text x="76" y="83" className="finale-paper-title">计算最优</text><text x="76" y="105" className="finale-paper-title">怎样定规模</text><path d="M76 124H229" stroke="#e1e8f0"/><PaperLines x={76} y={143} width={153} rows={5}/><rect className="finale-highlight" x="72" y="157" width="163" height="15" rx="3" fill="#cfe2ff" opacity=".58"/><PaperLines x={76} y={211} width={146} rows={3}/></> : <><text x="76" y="82" className="finale-paper-title">损失与预算</text><text x="76" y="104" className="finale-paper-title">先写规模</text><image className="finale-formula" href={attentionFormula} x="72" y="122" width="166" height="62" preserveAspectRatio="xMidYMid meet"/><PaperLines x={76} y={202} width={153} rows={4}/></>}</g>
 <text x="219" y="252" className="finale-art-label">0{page + 1}</text></g>
 <g className="finale-annotation"><rect x="215" y="177" width="117" height="69" rx="8" fill="#fff" stroke="#a8c7e9"/><path d="M229 197L234 202L243 190" stroke="#57978a" strokeWidth="1.6"/><text x="249" y="200" className="finale-art-label" fill="#59867e">带进路线</text><path d="M229 216H318M229 227H296" stroke="#d1deec"/><path d={page === 0 ? "M215 196C197 196 197 168 181 168" : "M215 225C198 225 203 242 186 242"} stroke="#8ab3e3"/></g>
 <g transform="translate(29 223) rotate(-9)"><rect width="54" height="27" rx="7" fill="#edf4ff" stroke="#b7d0ef"/><text x="12" y="18" className="finale-pdf-badge">PDF</text></g>
 </Drawing>;
}
const savedTitles = [['规模与预算', '网络与注意力', '训练与验收'], ['计算最优怎么定', '过训还是浪费', '损失突增那天']];
export function FavoritesIllustration({ collection }: {
    collection: number;
}) {
    return <Drawing kind="favorites">
 <ellipse cx="187" cy="281" rx="128" ry="11" fill="#dce5ef" opacity=".16"/>
 <path d="M41 120V81Q41 69 53 69H123L143 86H304Q318 86 318 100V241H41Z" fill="#f1f6fd" stroke="#bfd2e8" strokeWidth="1.2"/>
 <g className="finale-saved-sheets" key={collection}>{savedTitles[collection].map((title, i) => <g key={title} style={{ '--sheet-index': i } as React.CSSProperties} transform={`translate(${72 + i * 10} ${30 + i * 51}) rotate(${i === 0 ? -5 : i === 1 ? 2 : 0} 100 50)`}>
 <rect width="222" height="75" rx="8" fill="#fff" stroke="#c3d7ee"/><path d="M15 0V26L23 20L31 26V0" fill={i === 1 ? '#dceee9' : '#e2edff'} stroke={i === 1 ? '#aacfc3' : '#b6ceee'}/><text x="44" y="30" className="finale-saved-title">{title}</text><path d="M44 44H198M44 54H170" stroke="#d6e2ef" strokeLinecap="round" strokeWidth="2"/></g>)}</g>
 <path d="M35 169Q34 159 44 159H146L163 172H326L313 262Q312 274 299 274H57Q44 274 43 262Z" fill="url(#finale-paper-favorites)" stroke="#b8cfe9" strokeWidth="1.2"/>
 <path className="finale-ink-trace" d="M35 169Q34 159 44 159H146L163 172H326L313 262Q312 274 299 274H57Q44 274 43 262Z" stroke="url(#finale-edge-favorites)" pathLength="100"/>
 <g transform="translate(75 199)"><rect width="35" height="35" rx="9" fill="#2672e6"/><text x="7" y="25" fill="#fff" fontSize="23" fontFamily="serif">知</text></g>
 <text x="124" y="212" className="finale-folder-title">{collection === 0 ? '我的 AI 收藏' : '训练与论文'}</text><text x="124" y="233" className="finale-art-label">收藏夹里的文章，接着学。</text>
 <g className="finale-bookmark" transform="translate(295 128) rotate(10)"><path d="M0 0H25V40L12.5 32L0 40Z" fill="#e0f2ed" stroke="#91beb0"/><path d="M7 14L11 18L19 9" stroke="#639e8d" strokeWidth="1.4"/></g>
 </Drawing>;
}
export function GoalIllustration({ focused }: {
    focused: boolean;
}) {
    const [progress, setProgress] = useState(0), position = useRef(0);
    useEffect(() => {
        const media = matchMedia('(prefers-reduced-motion: reduce)'), target = focused ? 1 : 0;
        const from = position.current, start = performance.now(), duration = 1500 * Math.abs(target - from);
        let frame = 0;
        const update = (value: number) => { position.current = value; setProgress(value); };
        const tick = (now: number) => { const t = duration ? Math.min(1, (now - start) / duration) : 1; update(from + (target - from) * (t * t * (3 - 2 * t))); if (t < 1)
            frame = requestAnimationFrame(tick); };
        const preference = () => { if (media.matches) {
            cancelAnimationFrame(frame);
            update(target);
        } };
        if (media.matches)
            update(target);
        else
            frame = requestAnimationFrame(tick);
        media.addEventListener('change', preference);
        return () => { cancelAnimationFrame(frame); media.removeEventListener('change', preference); };
    }, [focused]);
    const s = goalIllustrationAt(progress);
    return <Drawing kind="goal">
  <ellipse cx="182" cy="281" rx="140" ry="10" fill="#e4edf8" opacity=".25"/>
  <g className="finale-optional-path">{s.branches.map(b => <g key={b.label} opacity={b.opacity}>
   <path d={`M${b.anchor.x} ${b.anchor.y}Q${b.x} ${b.anchor.y} ${b.x} ${b.y}`} stroke="#b2c8e2" strokeWidth="1.4" strokeDasharray="3 4"/>
   <rect x={b.x - 11} y={b.y - 11} width="22" height="22" rx="7" fill="#f5f8fc" stroke="#bbcee6"/>
   <path d={`M${b.x - 4} ${b.y - 3}h8M${b.x - 4} ${b.y + 2}h5`} stroke="#92accb" strokeWidth="1.2" strokeLinecap="round"/>
   <text x={b.x} y={b.y + 26} textAnchor="middle" className="finale-branch-label">{b.label}</text>
  </g>)}</g>
  <path className="finale-goal-route-bed" d={s.path} stroke="#e6effc" strokeWidth={3 + s.light * 5} strokeLinecap="round"/>
  <path className="finale-goal-route" d={s.path} stroke="#6099e8" strokeWidth={1.8 + s.light * .9} strokeLinecap="round" pathLength="100"/>
  <path className="finale-route-light" d={s.path} stroke="#206ce0" strokeWidth="3.3" pathLength="100"/>
  {s.nodes.map((p, i) => <g key={i} className="finale-goal-step" transform={`translate(${p.x} ${p.y})`}>
   <ellipse cy="14" rx="19" ry="5" fill="#dce9fb" opacity=".6"/>
   <circle r="16" fill="#fff" stroke="#79a6e4" strokeWidth="1.5"/>
   <circle r="12" fill="#e7f0ff" opacity={.5 + s.light * .5}/>
   <text y="4" textAnchor="middle" className="finale-step-number" opacity={1 - s.light}>{i + 1}</text>
   <path d="M-6 0L-1 5L7 -5" stroke="#3178d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={s.light} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - s.light}/>
   <text y="35" textAnchor="middle" className="finale-step-label">{['规模与预算', '结构与词表', '训练与验收'][i]}</text>
  </g>)}
  <g className="finale-goal-flag" transform="translate(284 66)">
   <ellipse cy="2" rx="18" ry="6" fill="#e9f2ff" stroke="#b5cff1"/>
   <path d="M0 0V-43" stroke="#377bcf" strokeWidth="1.8"/>
   <path d="M0 -41C13 -49 24 -34 38 -42V-14C24 -6 13 -21 0 -13Z" fill="#dbeaff" stroke="#79a6e4"/>
   <path d="M10 -29L16 -23L27 -35" stroke="#377bd5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </g>
  <g transform="translate(28 14)">
   <rect width="236" height="37" rx="10" fill="#fff" stroke="#b7ceec"/>
   <circle cx="18" cy="18" r="4" fill="#3c80e4"/>
   <text x="31" y="23" className="finale-goal-title">从零训出能验收的小模型</text>
  </g>
 </Drawing>;
}
