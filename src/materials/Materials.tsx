import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { productRequest } from '../learning-v2/client'
import { requestAuthStart } from '../runtime/request-auth-session'
import { MarkdownMath } from '../lib/MarkdownMath'
import { Glyph } from '../learning-v2/atoms'
import type { MaterialView } from './selection'
import type { MaterialsModel } from './use-materials'
import './materials.css'
export { useMaterials } from './use-materials'
export type { MaterialView } from './selection'

function ScopeIcon({ kind }: { kind: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'collections'
    ? <><path d="M4 5h7l2 2h7v13H4Z"/><path d="M9 11h6M9 15h6"/></>
    : kind === 'web' ? <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></>
    : <><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5M7 10h6M10 7v6"/></>}</svg>
}
const scopeLabel = (model: MaterialsModel) => model.searchScope.kind === 'collections' ? `仅知乎收藏夹${model.searchScope.folderIds?.length ? ` · ${model.searchScope.folderIds.length}` : ''}` : model.searchScope.kind === 'web' ? '全网' : '全知乎'

/** A portal keeps the menu out of the composer's animated border and scroll clipping. */
export function MaterialScope({ model }: { model: MaterialsModel }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const [authConfig, setAuthConfig] = useState<{ zhihuDemo?: boolean; zhihuMode?: string } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const selected = model.searchScope.kind === 'collections' ? model.searchScope.folderIds ?? [] : []
  const demo = model.foldersDemo || authConfig?.zhihuDemo === true || authConfig?.zhihuMode === 'mock'
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus() }
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect(); if (!rect) return
      const viewport = window.visualViewport
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight
      const offsetY = viewport?.offsetTop ?? 0, offsetX = viewport?.offsetLeft ?? 0
      const popupWidth = Math.min(328, width - 24), popupHeight = Math.min(menu.current?.scrollHeight ?? 440, height - 24)
      const below = rect.bottom + 8 + popupHeight <= offsetY + height - 12
      setPosition({ width: popupWidth, maxHeight: height - 24, left: Math.min(Math.max(offsetX + 12, rect.right - popupWidth), offsetX + width - popupWidth - 12), top: below ? rect.bottom + 8 : Math.max(offsetY + 12, rect.top - popupHeight - 8) })
    }
    place()
    const observer = new ResizeObserver(place); if (menu.current) observer.observe(menu.current)
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close() }
    const blur = (event: FocusEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', blur)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', blur) }
  }, [open])
  useEffect(() => {
    if (!open) return
    void model.loadFolders()
    // Positioning removes the initial visibility guard before keyboard focus enters the portal.
    const frame = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, model.loadFolders])
  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    void fetch('/api/auth/config', { credentials: 'same-origin', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      if (response.ok) setAuthConfig(await response.json())
    }).catch(() => { /* Keep a neutral connection label until the mode is known. */ })
    return () => abort.abort()
  }, [open])
  const connect = async () => {
    const result = await requestAuthStart()
    if (result.kind === 'redirect') location.href = result.authorizeUrl
    else model.setError(result.message)
  }
  return <>
    <button type="button" ref={trigger} className={`composer-icon material-scope-trigger${model.searchScope.kind !== 'zhihu' ? ' is-selected' : ''}`} title={`搜索范围：${scopeLabel(model)}`} aria-label={`搜索范围：${scopeLabel(model)}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} disabled={!model.loaded} onClick={() => setOpen(old => !old)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } if (event.key === 'Escape') close(true) }}>
      <ScopeIcon kind={model.searchScope.kind}/>{selected.length > 0 && <span className="material-scope-count">{selected.length}</span>}
    </button>
    {open && createPortal(<div id={id} ref={menu} className="material-scope-menu" style={position} role="menu" aria-label="搜索范围" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const choices = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      const index = choices.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + choices.length) % choices.length
      choices[next]?.focus()
    }}>
      <div className="material-scope-options">{(['zhihu', 'web'] as const).map(kind => <button type="button" key={kind} role="menuitemradio" aria-checked={model.searchScope.kind === kind} onClick={() => { model.setKind(kind); close(true) }}><span className="material-radio"/><ScopeIcon kind={kind}/><span>{kind === 'zhihu' ? '全知乎' : '全网'}</span>{model.searchScope.kind === kind && <Glyph name="check" size={16}/>}</button>)}</div>
      <div className="material-scope-divider" role="separator"/>
      <button type="button" className="material-scope-heading" role="menuitemradio" aria-checked={model.searchScope.kind === 'collections'} onClick={() => model.setKind('collections')}><span>仅知乎收藏夹</span><span>{demo ? '演示数据 · ' : ''}{selected.length ? `已选 ${selected.length}` : '可多选'}</span></button>
      <div className="material-folder-list" role="group" aria-label="我的公开收藏夹">
        {model.foldersStatus === 'loading' && !model.folders.length && <p role="status">正在读取收藏夹…</p>}
        {model.folders.map(folder => <button type="button" key={folder.id} role="menuitemcheckbox" aria-checked={selected.includes(folder.id)} title={folder.description || folder.title} onClick={() => model.toggleFolder(folder)}><span className="material-checkbox">{selected.includes(folder.id) && <Glyph name="check" size={12}/>}</span><Glyph name="book" size={17}/><span>{folder.title}</span>{selected.includes(folder.id) && model.imports[folder.id] && !model.imports[folder.id].error && <span className="material-spinner"/>}</button>)}
        {model.foldersStatus === 'ready' && !model.folders.length && <p>还没有公开收藏夹。</p>}
        {model.foldersStatus === 'error' && <div className="material-folder-notice"><p role="status">{model.foldersError}</p><button type="button" role="menuitem" onClick={() => void model.loadFolders()}>重新读取</button><button type="button" role="menuitem" onClick={() => void connect()}>{demo ? '连接演示账号' : authConfig ? '连接知乎账号' : '连接账号'}</button></div>}
      </div>
      {model.searchScope.kind === 'collections' && <p className="material-scope-hint" role="status">{selected.length ? '仅使用所选收藏夹与附件，不进行外部搜索。' : '请选择至少一个收藏夹，不进行外部搜索。'}</p>}
      <div className="material-scope-divider" role="separator"/>
      <button type="button" className="material-saved-entry" role="menuitem" onClick={() => { close(true); model.setLibraryOpen(true) }}><Glyph name="clock" size={16}/><span>已保存的文件</span><Glyph name="chevron" size={13}/></button>
    </div>, document.body)}
  </>
}

export function MaterialChips({ model }: { model: MaterialsModel }) {
  const unresolved=model.unresolved??[]
  const missing = model.searchScope.kind === 'collections' ? (model.searchScope.folderIds ?? []).filter(id => !model.folderMaterials[id]&&!unresolved.some(a=>a.folderId===id)) : []
  return <>
    {!!(model.items.length || model.uploads.length || missing.length || unresolved.length) && <div className="material-inline-list" aria-label="本次学习资料">
      {unresolved.map((item,index)=><div className="material-inline" key={`restore-${item.sourceId}`}><Glyph name={item.folderId?'book':'document'} size={15}/><span className="material-inline-name">{item.folderId?'已选收藏夹':`已选文件 ${index+1}`}</span><span className="material-inline-status" role="status">暂未恢复</span><button type="button" className="material-inline-action" disabled={model.restoring} aria-label={`移除未恢复资料 ${index+1}`} onClick={()=>model.remove(item.sourceId)}><Glyph name="close" size={13}/></button></div>)}
      {model.items.map(item => <div className="material-inline" key={item.sourceId}>
        <Glyph name={item.origin === 'upload' ? 'document' : 'book'} size={15}/>
        <button type="button" className="material-inline-name" title={item.fileName} aria-label={`预览${item.fileName}`} onClick={() => model.setPreview(item)}>{item.fileName}</button>
        {item.status === 'processing' && <span className="material-inline-status" title={item.notice || item.job?.phase || '正在整理'} role="status">{!['waiting', 'cancelled'].includes(item.job?.status ?? '') && <span className="material-spinner"/>}{item.notice ? '需要重试' : item.job?.phase || '正在整理'}</span>}
        {item.status === 'processing' && ['waiting', 'cancelled'].includes(item.job?.status ?? '') && <button type="button" className="material-inline-action" aria-label={`继续整理${item.fileName}`} title="继续整理" onClick={() => void model.resume(item)}><Glyph name="refresh" size={14}/></button>}
        <button type="button" className="material-inline-action" aria-label={`移除${item.fileName}`} onClick={() => model.remove(item.sourceId)}><Glyph name="close" size={13}/></button>
      </div>)}
      {model.uploads.map(upload => <div className="material-inline" key={upload.id}><Glyph name="document" size={15}/><span className="material-inline-name" title={upload.error || upload.file.name}>{upload.file.name}</span><span className="material-inline-status" role="status">{upload.status === 'uploading' ? <><span className="material-spinner"/>正在上传</> : '上传未完成'}</span>{upload.status === 'failed' && <button type="button" className="material-inline-action" title={upload.error} aria-label={`重试上传${upload.file.name}`} onClick={() => void model.retryUpload(upload)}><Glyph name="refresh" size={14}/></button>}<button type="button" className="material-inline-action" aria-label={`移除${upload.file.name}`} onClick={() => model.removeUpload(upload.id)}><Glyph name="close" size={13}/></button></div>)}
      {missing.map(id => { const folder = model.folders.find(f => f.id === id) ?? { id, title: model.imports[id]?.title ?? '知乎收藏夹', description: '' }; const error = model.imports[id]?.error; return <div className="material-inline" key={id}><Glyph name="book" size={15}/><span className="material-inline-name">{folder.title}</span><span className="material-inline-status" role="status">{error ? '读取未完成' : <><span className="material-spinner"/>正在读取</>}</span>{error && <button type="button" className="material-inline-action" title={error} aria-label={`重试读取${folder.title}`} onClick={() => void model.importFolder(folder)}><Glyph name="refresh" size={14}/></button>}<button type="button" className="material-inline-action" aria-label={`移除${folder.title}`} onClick={() => model.toggleFolder(folder)}><Glyph name="close" size={13}/></button></div> })}
    </div>}
    {(model.restoreError||unresolved.length>0)&&<div className="material-inline-notice" role="alert"><span>{model.restoreError||'部分已选资料暂未恢复，原选择仍然保留。请重新读取或明确移除后发送。'}</span><button type="button" disabled={model.restoring} onClick={model.retryRestore}>{model.restoring?'正在读取…':'重新读取资料'}</button></div>}
    {model.error && <div className="material-inline-notice" role="alert"><span>{model.error}</span><button type="button" aria-label="关闭资料提示" onClick={() => model.setError('')}><Glyph name="close" size={12}/></button></div>}
    {model.searchScope.kind === 'collections' && !model.searchScope.folderIds?.length && <p className="material-inline-guidance" role="status">请选择至少一个知乎收藏夹后发送。</p>}
  </>
}

/** Only the modal is rendered here; the composer owns all entry points and attachment rows. */
export function Materials({ model }: { model: MaterialsModel }) {
  const [saved, setSaved] = useState<MaterialView[]>([]), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null)
  const id = useId()
  const open = model.libraryOpen || !!model.preview
  const preview = model.preview ? model.items.find(a => a.sourceId === model.preview?.sourceId) ?? model.preview : null
  const close = () => { model.setPreview(null); model.setLibraryOpen(false); opener.current?.focus() }
  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement as HTMLElement
    dialog.current?.showModal()
    let live = true
    if (!model.preview) {
      setLoading(true); setNotice('')
      void productRequest<MaterialView[]>('/api/v2/materials').then(items => { if (live) setSaved(items.filter(item => item.origin === 'upload')) }).catch(e => { if (live) setNotice(e instanceof Error ? e.message : '暂未读取到已保存文件。') }).finally(() => { if (live) setLoading(false) })
    }
    return () => { live = false; dialog.current?.close() }
  }, [open, !!model.preview])
  if (!open) return null
  return createPortal(<dialog aria-labelledby={id} className="material-dialog" ref={dialog} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}><header><div><h2 id={id}>{preview ? preview.fileName : '已保存的文件'}</h2><p>{preview ? preview.mimeType === 'application/pdf' ? 'PDF 总结 · 本次路线的每个概念都可引用' : '本次路线的每个概念都可引用' : '选择文件，继续用于这次学习。'}</p></div><button type="button" aria-label="关闭资料窗口" onClick={close}><Glyph name="close"/></button></header>
    {preview ? <div className="material-preview">{preview.status === 'ready' ? <MarkdownMath source={preview.content}/> : <div><p role="status">{preview.notice || preview.job?.phase || '正在整理资料，可关闭窗口继续填写学习目标。'}</p>{['waiting', 'cancelled'].includes(preview.job?.status ?? '') && <button type="button" className="material-retry" onClick={() => void model.resume(preview)}>继续整理</button>}</div>}</div> : <div className="material-dialog-body"><div className="material-saved">{loading && <p role="status">正在读取…</p>}{!loading && !saved.length && <p>上传过的文件会保存在这里，之后可以再次引用。</p>}{saved.map(item => <button type="button" key={item.sourceId} disabled={model.files.some(a => a.sourceId === item.sourceId) || model.items.length + model.uploads.length >= 8} onClick={() => { model.add(item); close() }}><Glyph name="document" size={18}/><span>{item.fileName}<small>{item.status === 'ready' ? item.mimeType === 'application/pdf' ? 'PDF 总结' : '完整正文' : '待继续整理'}</small></span><Glyph name={model.files.some(a => a.sourceId === item.sourceId) ? 'check' : 'plus'} size={16}/></button>)}</div>{notice && <p className="material-notice" role="alert">{notice}</p>}</div>}
  </dialog>, document.body)
}
