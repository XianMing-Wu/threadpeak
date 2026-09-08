import type { ReactNode } from 'react'
import type { AuthorBrief } from '@threadpeak/contracts/authors'
import { Composer } from '../components/Composer'
import { FloatingPanel } from '../components/FloatingPanel'
import { Glyph } from './atoms'

export function AuthorSearchComposer({ brief, onChange, onSend, onStop, busy, sending, context }: {
  brief: AuthorBrief; onChange: (patch: Partial<AuthorBrief>) => void; onSend: () => void;
  onStop: () => void; busy: boolean; sending: boolean; context?: ReactNode;
}) {
  const backgroundCount = [brief.background, brief.attempted, brief.desiredOutcome].filter(value => value.trim()).length
  return <div className="au-search-composer">
    <Composer value={brief.question} onChange={question => onChange({question})} onSend={onSend} requireQuestion showAttachment={false} animatedBorder={false}
      inputLabel="想请教的问题" sendLabel="找博主" placeholder="你具体卡在哪里，想获得什么帮助？"
      thinkingDepth={brief.depth} onThinkingDepth={depth => onChange({depth})} busy={busy} onStop={onStop} sendDisabled={sending}
      topContent={<>
        <div className="au-composer-settings">
          <div className="au-purpose" role="group" aria-label="找人的目的">
            <button type="button" aria-pressed={brief.purpose === 'consult'} onClick={() => onChange({purpose:'consult'})}><Glyph name="message" size={14}/>咨询人选</button>
            <button type="button" aria-pressed={brief.purpose === 'invite'} onClick={() => onChange({purpose:'invite'})}><Glyph name="plus" size={14}/>邀请回答</button>
          </div>
          <label className="au-use-learning" title="参考你读过的作者和资料；问题同样相关时，优先考虑你使用过、标记有帮助的来源。">
            <input type="checkbox" checked={brief.useNetwork} onChange={event => onChange({useNetwork:event.target.checked})}/>
            <span>参考学习记录</span>
          </label>
        </div>
        {context}
      </>}
      toolbarStart={<FloatingPanel label="补充背景" width={400} className="au-background-panel"
        triggerContent={<><Glyph name="plus" size={14}/><span>补充背景{backgroundCount > 0 && <small> · {backgroundCount}</small>}</span></>}>
        {close => <>
          <p>让推荐更贴近你的情况，以下内容均为选填。</p>
          <label><span>我的情况</span><textarea data-initial-focus aria-label="我的情况" value={brief.background} onChange={event => onChange({background:event.target.value})} placeholder="已有基础、具体场景或限制" maxLength={12000}/></label>
          <label><span>已经试过什么</span><textarea aria-label="已尝试的方法" value={brief.attempted} onChange={event => onChange({attempted:event.target.value})} placeholder="AI 的解释、看过的资料、做过的尝试" maxLength={12000}/></label>
          <label><span>希望得到的帮助</span><textarea aria-label="希望得到的帮助" value={brief.desiredOutcome} onChange={event => onChange({desiredOutcome:event.target.value})} placeholder="一个具体例子、检查推导或下一步建议" maxLength={12000}/></label>
          <footer><span>填写的内容将随本次问题提交</span><button type="button" onClick={close}>完成</button></footer>
        </>}
      </FloatingPanel>}/>
  </div>
}
