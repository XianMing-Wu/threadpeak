import { useRef, useState } from 'react'
import type { AssistantMode } from '../assistant-mode'
import { Icon, ModeDismissIcon } from '../icons'

const modeLabel: Record<Exclude<AssistantMode,''>, string> = { route:'路线制定', visual:'图文模式', authors:'问博主' }
const modePlaceholder: Record<Exclude<AssistantMode,''>, string> = {
  route:'说说你的学习目标、当前基础或期望的节奏…',
  visual:'输入你想用图形、时间线或可交互可视化理解的内容…',
  authors:'输入问题，我会筛选最相关的知乎博主与回答…',
}

export function QuickModes({ selected, onSelect }: { selected: AssistantMode; onSelect: (mode: AssistantMode) => void }) {
  const modes = [['route','route','路线制定'],['visual','image','图文模式']] as const
  return <div className="quick-modes" aria-label="快捷模式">{modes.map(([id, glyph, label]) => <button key={id} className={selected === id ? 'is-selected' : ''} onClick={() => onSelect(selected === id ? '' : id)}><Icon name={glyph} size={18}/><span>{label}</span></button>)}</div>
}

export function Composer({ value, onChange, mode, onMode, onSend, compact = false, quote, onClearQuote, showScope = true, showReference = true, showAttachment = true, placeholder: customPlaceholder }: {
  value: string; onChange: (value:string) => void; mode: AssistantMode; onMode: (mode: AssistantMode) => void; onSend: () => void; compact?: boolean; quote?: string; onClearQuote?: () => void; showScope?: boolean; showReference?: boolean; showAttachment?: boolean; placeholder?: string
}) {
  const [menu, setMenu] = useState<'thinking' | 'scope' | ''>('')
  const [thinking,setThinking]=useState('快速回答')
  const [scopes,setScopes]=useState<string[]>(['知乎','PDF'])
  const [file, setFile] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const enabled = Boolean(value.trim() || file || quote)
  const placeholder = mode ? modePlaceholder[mode] : customPlaceholder ?? (compact ? '围绕当前概念继续提问，或引用上方内容…' : '你可以制定学习路线、使用图文模式理解内容，也可以查找与问题相关的知乎博主～')

  return <div className={`composer ${compact ? 'composer--compact' : ''}`}>
    {(file || quote) && <div className="composer-chips">
      {file && <span className="file-chip">
        <Icon name="file" size={13}/>
        <p className="file-chip-text">{file}</p>
        <button type="button" className="chip-dismiss" onClick={() => setFile('')} aria-label="移除文件">×</button>
      </span>}
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
    </div>}
    <div className={`composer-input ${mode ? 'has-mode' : ''}`}>
      {mode && <span className="composer-mode-prefix"><span>{modeLabel[mode]}</span><button className="composer-mode-remove" aria-label={`移除${modeLabel[mode]}`} onClick={() => onMode('')}><ModeDismissIcon/></button></span>}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={compact ? 2 : 3} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && enabled) { event.preventDefault(); onSend() } }}/>
    </div>
    <div className="composer-footer">
      <span>
        <div className="composer-thinking" onMouseEnter={() => setMenu('thinking')} onMouseLeave={() => setMenu('')} onFocus={() => setMenu('thinking')} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu('') }}>
          <button className="composer-pill" aria-haspopup="menu" aria-expanded={menu === 'thinking'} onClick={(event) => event.preventDefault()}><Icon name="prod-home-thinking-smart" size={16}/>{thinking}<Icon className={menu === 'thinking' ? 'thinking-chevron is-expanded' : 'thinking-chevron is-collapsed'} name="prod-home-chevron-down" size={11}/></button>
          {menu === 'thinking' && <div className={`composer-menu thinking-menu${compact ? ' is-drop-up' : ''}`} role="menu">{[['智能思考','智能决策动态搜索'],['深度思考','深入推理给出答案'],['快速回答','跳过推理直达结果']].map(([x,y]) => <button key={x} aria-checked={thinking===x} role="menuitemradio" onClick={() => setThinking(x)}><span><b>{x}</b><small>{y}</small></span>{thinking===x && <Icon name="check" size={15}/>}</button>)}</div>}
        </div>
        {showScope && <button className="composer-pill scope" onClick={() => setMenu(menu === 'scope' ? '' : 'scope')} aria-expanded={menu === 'scope'}><Icon name="prod-home-scope-zhihu-primary" size={16}/><Icon name="book" size={15}/>{scopes.join(' · ')||'选择资料'}<Icon name="prod-home-chevron-down" size={11}/></button>}
      </span>
      <span>
        {showReference && <button className="composer-icon" aria-label="快捷引用" onClick={() => onChange(value + '@')}><Icon name="prod-home-at-reference" size={20}/></button>}
        {showAttachment && <button className="composer-icon" aria-label="添加附件" onClick={() => fileRef.current?.click()}><Icon name="prod-home-attachment" size={21}/></button>}
        {showAttachment && <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(event) => setFile(event.target.files?.[0]?.name ?? '')}/>}
        <button className="composer-send" disabled={!enabled} aria-label="发送" onClick={onSend}><Icon name="prod-home-send-disabled" size={18}/></button>
      </span>
    </div>
    {showScope && menu === 'scope' && <div className="composer-menu scope-menu" role="menu">{[['知乎','知乎精选内容'],['PDF','你上传的文档']].map(([x,y]) => <button key={x} aria-checked={scopes.includes(x)} role="menuitemcheckbox" onClick={() => setScopes((old)=>old.includes(x)?old.filter((item)=>item!==x):[...old,x])}><span><b>{x}</b><small>{y}</small></span>{scopes.includes(x)&&<Icon name="check" size={15}/>}</button>)}</div>}
  </div>
}
