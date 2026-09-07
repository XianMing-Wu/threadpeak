import { useRef, useState, type ReactNode } from 'react'
import { Icon } from '../icons'
import {
  resolveComposerAttachment,
  type ComposerAttachmentResolution,
} from '../resolve-composer-attachment'
import { ChoiceMenu } from './ChoiceMenu'
import { BeamFrame } from '../ui/BeamFrame'

export function Composer({ value, onChange, onSend, compact = false, quote, onClearQuote, showAttachment = true, onPickFiles, placeholder: customPlaceholder, requireQuestion = false, thinkingDepth, onThinkingDepth, busy = false, sendDisabled=false, onStop, topContent, beforeAttachment, toolbarStart, bottomContent, inputLabel, sendLabel = '发送', animatedBorder = true }: {
  value: string; onChange: (value:string) => void; onSend: () => void; compact?: boolean; quote?: string; onClearQuote?: () => void; showAttachment?: boolean; onPickFiles?: (files: FileList) => void; placeholder?: string; requireQuestion?: boolean; thinkingDepth?: 'fast' | 'deep'; onThinkingDepth?: (value: 'fast' | 'deep') => void; busy?: boolean; sendDisabled?: boolean; onStop?: () => void; topContent?: ReactNode; beforeAttachment?: ReactNode; toolbarStart?: ReactNode; bottomContent?: ReactNode; inputLabel?: string; sendLabel?: string; animatedBorder?: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [thinking,setThinking]=useState('快速回答')
  const [attachmentNotice,setAttachmentNotice]=useState<ComposerAttachmentResolution|null>(null)
  const thinkingLabel = thinkingDepth === 'deep' ? '深度思考' : thinkingDepth === 'fast' ? '快速回答' : thinking
  const setThinkingLabel = (label: string) => {
    if (onThinkingDepth) onThinkingDepth(label === '深度思考' ? 'deep' : 'fast')
    else setThinking(label)
  }
  const enabled = !sendDisabled && (requireQuestion ? Boolean(value.trim()) : Boolean(value.trim() || quote))
  const placeholder = customPlaceholder ?? (compact ? '围绕当前概念继续提问，或引用上方内容…' : '说说你的学习目标、当前基础或期望的节奏…')
  const notice = attachmentNotice
  return <div className="composer-wrap ux-flowith-skin ux-flowith-composer-wrap">
    <BeamFrame animated={animatedBorder}>
      <div className={`composer input-motion-frame ux-flowith-composer ${compact ? 'composer--compact' : ''}`}>
        {topContent}
        {(quote || notice) && <div className="composer-chips">
          {quote && <div className="quote-chip">
            <Icon name="quote" size={14}/>
            <p className="quote-chip-text">{quote}</p>
            <button
              type="button"
              className="chip-dismiss"
              aria-label="移除引用"
              onClick={() => onClearQuote?.()}
            ><Icon name="close" size={12}/></button>
          </div>}
          {notice && <p className="composer-unavailable" role="alert"><b>{notice.title}</b> {notice.message}</p>}
        </div>}
        <div className="composer-input composer-field">
          <textarea aria-label={inputLabel} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={compact ? 2 : 3} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && enabled && !busy) { event.preventDefault(); onSend() } }}/>
        </div>
        <div className="composer-bar composer-footer">
          <div className="bar-l">
            <ChoiceMenu value={thinkingLabel} onChange={setThinkingLabel} label="思考深度" quiet hover preferAbove={compact} icon={<Icon name="prod-home-thinking-smart" size={16}/>} options={[
              {value:'快速回答',label:'快速回答',description:'跳过推理直达结果'},
              {value:'深度思考',label:'深度思考',description:'深入推理给出答案'},
            ]}/>
            {toolbarStart}
          </div>
          <div className="bar-r">
            {beforeAttachment}
            {showAttachment && (onPickFiles
              ? <><input ref={fileInput} type="file" aria-label="选择学习附件" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain" multiple hidden onChange={(event) => { const files = event.target.files; if (files?.length) onPickFiles(files); event.target.value = '' }}/>
                <button type="button" className="composer-icon" aria-label="添加附件" title="上传 PDF、MD、Markdown 或 TXT" onClick={() => fileInput.current?.click()}><Icon name="prod-home-attachment" size={16}/></button>
              </>
              : <button type="button" className="composer-icon" aria-label="添加附件" onClick={() => setAttachmentNotice(resolveComposerAttachment())}><Icon name="prod-home-attachment" size={16}/></button>)}
            {busy
              ? <button type="button" className="composer-send is-stop" aria-label="停止生成" onClick={() => onStop?.()}><Icon name="stop" size={14}/></button>
              : <button type="button" className="composer-send" disabled={!enabled} aria-label={sendLabel} onClick={onSend}><Icon name="prod-home-send-disabled" size={14}/></button>}
          </div>
        </div>
        {bottomContent}
      </div>
    </BeamFrame>
  </div>
}
