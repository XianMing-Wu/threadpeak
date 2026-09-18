import type { ReactNode } from 'react';
/** Six source-specific, editable vector models. The mirror uses unique definitions. */
export function ConsultationGlyph({ i, mirror = false }: {
    i: number;
    mirror?: boolean;
}) {
    const id = `consult-illustration-${mirror ? 'lens' : 'card'}-${i}`;
    const Sheet = ({ x, y, w = 62, h = 66, children }: {
        x: number;
        y: number;
        w?: number;
        h?: number;
        children?: ReactNode;
    }) => <g transform={`translate(${x} ${y})`}><rect x="2" y="4" width={w} height={h} rx="7" fill="#526f9410"/><rect width={w} height={h} rx="7" fill={`url(#${id}-paper)`} stroke="#c1d5e5"/><path d={`M8 14H${w - 8}`} stroke="#dce7ef"/>{children}</g>;
    const Lines = ({ x = 10, y = 25, w = 38 }: {
        x?: number;
        y?: number;
        w?: number;
    }) => <path d={`M${x} ${y}h${w}m${-w} 8h${w * .72}m${-w * .72} 8h${w * .9}`} stroke="#a8bdce"/>;
    return <svg className="consult-profile-glyph" viewBox="0 0 260 142" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <defs><linearGradient id={`${id}-paper`} x2="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#f6faff"/></linearGradient><linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#76b4ff"/><stop offset="1" stopColor="#3d7ee1"/></linearGradient><linearGradient id={`${id}-wash`} x2="1" y2="1"><stop stopColor="#eff7ff"/><stop offset="1" stopColor="#f5fbf8"/></linearGradient></defs>
  <ellipse cx="132" cy="125" rx="102" ry="9" fill="#315b7b05"/>
  {i === 0 && <>
    <Sheet x={16} y={20} w={128} h={96}>
      <text x="10" y="12">小模型 · 多头</text>
      <rect x="10" y="22" width="108" height="28" rx="4" fill="#eef4fa" stroke="#c5d5e3"/>
      <text x="16" y="40" fill="#6a8498">上下文 · 续训？</text>
      {['键值显存', '评测泄漏'].map((t, n) => <g key={t} transform={`translate(10 ${58 + n * 16})`}>
        <rect width="12" height="12" rx="3" fill="#fdecea" stroke="#e3b4ae"/>
        <path d="M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5" stroke="#c56b63"/>
        <text x="18" y="10" fill="#5d7384">{t}</text>
      </g>)}
    </Sheet>
    <g className="consult-diagram-float">
      <rect x="156" y="36" width="88" height="64" rx="8" fill="#eef6ff" stroke="#9bbfe3"/>
      <text x="174" y="58" fill="#3d7ee1">评估</text>
      <text x="168" y="78" fill="#6a8498">能否上线</text>
    </g>
  </>}
  {i === 1 && <>
    <Sheet x={14} y={24} w={96} h={88}>
      <text x="10" y="12">符号堆</text>
      <path d="M12 28H82M18 40H70M14 52H78M22 64H60" stroke="#c5d5e3"/>
      <text x="28" y="80" fill="#8aa0b2">看不清</text>
    </Sheet>
    <path d="M118 68H142" stroke="#9bbfe3"/><path d="M136 62L144 68L136 74" stroke="#9bbfe3"/>
    <Sheet x={150} y={24} w={96} h={88}>
      <text x="10" y="12">层次</text>
      {['表征', '注意力', '生成'].map((t, n) => <g key={t} transform={`translate(12 ${26 + n * 18})`}>
        <rect width="72" height="14" rx="3" fill={n === 0 ? '#e8f3ff' : n === 1 ? '#eef8f3' : '#f7fafc'} stroke="#c1d5e5"/>
        <text x="8" y="11" fill="#5a7fa0">{t}</text>
      </g>)}
    </Sheet>
  </>}
  {i === 2 && <>
    <g className="consult-diagram-float">
      <circle cx="58" cy="58" r="28" fill="#eef6ff" stroke="#9bbfe3"/>
      <circle cx="58" cy="48" r="8" fill="#fff" stroke="#7aa3d2"/>
      <path d="M40 78Q58 64 76 78" fill="#fff" stroke="#7aa3d2"/>
      <rect x="108" y="28" width="128" height="54" rx="12" fill="#fff" stroke="#c1d5e5"/>
      <path d="M108 48L96 58L108 62" fill="#fff" stroke="#c1d5e5"/>
      <text x="122" y="50" fill="#5a7fa0">分数从哪来？</text>
      <text x="122" y="68" fill="#8aa0b2">现场先垮在这句</text>
    </g>
    <text x="86" y="118" fill="#6a8498">亲历 · 课堂追问</text>
  </>}
  {i === 3 && <>
    <Sheet x={16} y={22} w={108} h={88}>
      <text x="10" y="12">证明什么</text>
      <text x="14" y="40" fill="#4f9a74">总图能指到</text>
      <text x="14" y="58" fill="#4f9a74">相近是几何</text>
      <path d="M14 72H90" stroke="#cfe4d8"/>
    </Sheet>
    <Sheet x={136} y={22} w={108} h={88}>
      <text x="10" y="12">证明不了</text>
      <text x="14" y="40" fill="#7a90a3">换句还能指到？</text>
      <text x="14" y="58" fill="#7a90a3">完成标准过关？</text>
      <path d="M14 72H90" stroke="#d7e3ee"/>
    </Sheet>
  </>}
  {i === 4 && <>
    <path d="M36 22V112H226" stroke="#c2d7e7"/>
    {['表征 向量', '注意力 分配', '生成 下一词'].map((t, n) => <g key={t} className={`consult-diagram-layer layer-${n}`} transform={`translate(${48 + n * 8} ${28 + n * 26})`}>
      <rect width="150" height="22" rx="5" fill={n === 0 ? '#e8f3ff' : n === 1 ? '#eef8f3' : '#f7fafc'} stroke="#bad1e2"/>
      <text x="12" y="15" fill="#5a7fa0">{t}</text>
    </g>)}
    <text transform="translate(236 108) rotate(-90)" fill="#8aa0b2">层次</text>
  </>}
  {i === 5 && <>
    <g transform="translate(28 30)">
      <circle cx="28" cy="22" r="12" fill="#fff" stroke="#7aa3d2"/>
      <path d="M10 58Q28 40 46 58" fill="#eef6ff" stroke="#7aa3d2"/>
      <text x="14" y="80" fill="#6a8498">第一次讲</text>
    </g>
    <g transform="translate(148 30)">
      <circle cx="28" cy="22" r="12" fill="#fff" stroke="#7fb89a"/>
      <path d="M10 58Q28 40 46 58" fill="#eef8f3" stroke="#7fb89a"/>
      <text x="18" y="80" fill="#6a8498">听的人</text>
    </g>
    <path d="M92 52H140" stroke="#9bbfe3"/><path d="M132 46L142 52L132 58" stroke="#9bbfe3"/>
    <rect x="86" y="18" width="70" height="22" rx="8" fill="#fff" stroke="#c1d5e5"/>
    <text x="96" y="33" fill="#5a7fa0">它懂了？</text>
  </>}
 </svg>;
}
