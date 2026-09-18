import { rootCardText } from "./knowledge-tree.ts";
/** Shared by the last 3D frame and the first canvas frame. */
export function LearningStartCard() {
    const lines = rootCardText.split('\n');
    return <div className="learn-card-ink">
  <div className="learn-start-header"><i className="learn-start-orb" aria-hidden="true"/><span>我的目标 · 从零训一个能验收的小模型</span></div>
  <h3>计算最优如何定</h3>
  <p>{lines[0]}<br />{lines[1]}<br />{lines[2]}</p>
  <div className="learn-start-footer"><span>按目标学</span><i>·</i><span>在项目里试</span><i>·</i><span>沿卡点问</span></div>
 </div>;
}
