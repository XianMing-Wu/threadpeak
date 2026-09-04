import { useState } from 'react'
import { Icon } from '../icons'
import {
  resolveComposerAttachment,
  type ComposerAttachmentResolution,
} from '../resolve-composer-attachment'

export function Composer({ value, onChange, onSend, compact = false, quote, onClearQuote, showAttachment = true, onPickFiles, placeholder: customPlaceholder, requireQuestion = false, thinkingDepth, onThinkingDepth }: {
  value: string; onChange: (value:string) => void; onSend: () => void; compact?: boolean; quote?: string; onClearQuote?: () => void; showAttachment?: boolean; onPickFiles?: (files: FileList) => void; placeholder?: string; requireQuestion?: boolean; thinkingDepth?: 'fast' | 'deep'; onThinkingDepth?: (value: 'fast' | 'deep') => void
}) {
  const [menu, setMenu] = useState<'thinking' | ''>('')
  const [thinking,setThinking]=useState('快速回答')
  const [attachmentNotice,setAttachmentNotice]=useState<ComposerAttachmentResolution|null>(null)
  const thinkingLabel = thinkingDepth === 'deep' ? '深度思考' : thinkingDepth === 'fast' ? '快速回答' : thinking
  const setThinkingLabel = (label: string) => {
    if (onThinkingDepth) onThinkingDepth(label === '深度思考' ? 'deep' : 'fast')
    else setThinking(label)
  }
  const enabled = requireQuestion ? Boolean(value.trim()) : Boolean(value.trim() || quote)
  const placeholder = customPlaceholder ?? (compact ? '围绕当前概念继续提问，或引用上方内容…' : '说说你的学习目标、当前基础或期望的节奏…')
  const notice = attachmentNotice

  return <div className={`composer input-motion-frame ${compact ? 'composer--compact' : ''}`}>
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
    <div className="composer-input">
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={compact ? 2 : 3} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && enabled) { event.preventDefault(); onSend() } }}/>
    </div>
    <div className="composer-footer">
      <span>
        <div className="composer-thinking" onMouseEnter={() => setMenu('thinking')} onMouseLeave={() => setMenu('')} onFocus={() => setMenu('thinking')} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu('') }}>
          <button className="composer-pill" aria-haspopup="menu" aria-expanded={menu === 'thinking'} onClick={(event) => event.preventDefault()}><Icon name="prod-home-thinking-smart" size={16}/>{thinkingLabel}<Icon className={menu === 'thinking' ? 'thinking-chevron is-expanded' : 'thinking-chevron is-collapsed'} name="prod-home-chevron-down" size={11}/></button>
          {menu === 'thinking' && <div className={`composer-menu thinking-menu${compact ? ' is-drop-up' : ''}`} role="menu">{[['快速回答','跳过推理直达结果'],['深度思考','深入推理给出答案']].map(([x,y]) => <button key={x} aria-checked={thinkingLabel===x} role="menuitemradio" onClick={() => setThinkingLabel(x)}><span><b>{x}</b><small>{y}</small></span>{thinkingLabel===x && <Icon name="check" size={15}/>}</button>)}</div>}
        </div>
      </span>
      <span>
        {showAttachment && (onPickFiles
          ? <label className="composer-icon" aria-label="添加附件">
            <input type="file" accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain" multiple hidden onChange={(event) => { const files = event.target.files; if (files?.length) onPickFiles(files); event.target.value = '' }}/>
            <Icon name="prod-home-attachment" size={21}/>
          </label>
          : <button type="button" className="composer-icon" aria-label="添加附件" onClick={() => setAttachmentNotice(resolveComposerAttachment())}><Icon name="prod-home-attachment" size={21}/></button>)}
        <button className="composer-send" disabled={!enabled} aria-label="发送" onClick={onSend}><Icon name="prod-home-send-disabled" size={18}/></button>
      </span>
    </div>
  </div>
}
