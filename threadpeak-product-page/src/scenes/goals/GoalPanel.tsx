import { goals,type GoalId } from "../../core/scroll-transition.ts";
function PaperShape({ kind }: {
    kind: GoalId;
}) {
    return <svg className="goal-paper" viewBox="0 0 400 180" preserveAspectRatio="none" fill="none" aria-hidden="true">
  {kind === 'application' ? <>
   <path className="paper-fill" d="M16 8Q8 8 8 20L7 159Q8 169 22 169L380 173Q392 172 392 160L391 23Q390 12 378 12Z"/>
   <path className="paper-ink" d="M16 8Q8 8 8 20L7 159Q8 169 22 169L380 173Q392 172 392 160L391 23Q390 12 378 12ZM9 24Q192 22 390 26"/>
   <path className="paper-ink window-dots" d="M22 16h1m10 0h1m10 0h1"/>
  </> : kind === 'principles' ? <>
   <path className="paper-fill" d="M18 4L387 8L383 175L16 172Z"/>
   <path className="paper-ink notebook-margin" d="M22 10Q17 91 22 169M28 11Q23 91 28 168"/>
  </> : <>
   <path className="paper-fill" d="M15 7L342 5L389 43L388 170L13 175Z"/>
   <path className="paper-ink" d="M15 7L342 5L389 43L388 170L13 175ZM342 5L341 43L389 43"/>
   <path className="paper-rule" d="M20 180L394 175L396 51"/>
  </>}
 </svg>;
}
export function GoalPanel({ active, onSelect }: {
    active: GoalId;
    onSelect: (id: GoalId) => void;
}) {
    return <section className="goal-scene" aria-label="知乎上的不同学习路线通向不同终点" aria-hidden="true" inert>
  <header className="goal-heading"><h2>知乎上的这些学习路线，<br />通向不同终点。</h2></header>
  <div className="goal-margin-note"><p>先看清每条学习路线去哪，<br />再决定自己选哪一条。</p></div>
  <svg className="goal-connections" aria-hidden="true">
   {Array.from({ length: 6 }, (_, i) => <g key={i} data-connection={i}><path data-goal-link={i} fill="none" pathLength="1"/><circle data-link-start={i} r="2"/></g>)}
   {goals.map(goal => <g key={goal.id} data-goal-network={goal.id}><path data-network-spine fill="none" pathLength="1"/><path data-network-out fill="none" pathLength="1"/></g>)}
  </svg>
  <div className="goal-list">
   {goals.map((goal, i) => <button type="button" key={goal.id} data-goal={goal.id} className={`goal-option goal-${goal.id}${active === goal.id ? ' is-selected' : ''}`} aria-pressed={active === goal.id} onPointerEnter={() => onSelect(goal.id)} onFocus={() => onSelect(goal.id)} onClick={() => onSelect(goal.id)} style={{ '--goal-order': i } as React.CSSProperties}>
    <PaperShape kind={goal.id}/>
    <div className="goal-option-copy">
     <div className="goal-meta"><span className="goal-tag"><b>0{i + 1}</b><span>{goal.tag}</span></span>{goal.id === 'principles' && <span className="mini-formula" aria-hidden="true">Q · K<sup>T</sup></span>}</div>
     <h3>{goal.title}</h3><p><span className="goal-summary-full">{goal.subtitle}</span><span className="goal-summary-compact">{goal.compactSubtitle}</span></p>
     {goal.id === 'principles' && <div className="formula-artifact" aria-label="Q 乘以 K 的转置"><span>Q · K<sup>T</sup></span><em>从计算，到理解。</em></div>}
     {goal.id === 'research' && <div className="research-checklist" aria-label="复现时核对方法、实现和结果">{['方法', '实现', '对照'].map(item => <span key={item}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2 10 1.5 10.5 10 1.5 10.5Z"/></svg>{item}</span>)}</div>}
    </div>
   </button>)}
  </div>
  <p className="goal-context">来自知乎的不同学习路线<span>同一句「系统学习大模型」，基础和终点不同，必要内容就不同。</span></p>
 </section>;
}
