import heading from './assets/learning-start-heading.svg';
/** Shared by the last 3D frame and the first canvas frame. */
export function LearningStartCard() {
 return <div className="learn-card-ink">
  <div className="learn-start-header"><i className="learn-start-orb" aria-hidden="true"/><span>我的目标 · 做出文档助手</span></div>
  <h3><img src={heading} alt="接通第一次模型对话"/></h3>
  <p>已会 Python，就从自己的助手开始实践。<br/>只补当前步骤缺的知识，边做边验证；<br/>把理解和追问，接着留在知识脉络里。</p>
  <div className="learn-start-footer"><span>按目标学</span><i>·</i><span>在项目里试</span><i>·</i><span>沿卡点问</span></div>
 </div>;
}
