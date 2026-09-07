import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, ensureSession, productRequest } from '../learning-v2/client'
import { materialsReady, normalizeScope, selectedMaterials, type MaterialView, type SearchScope } from './selection'

const KEY = 'tp-home-materials'
const SCOPE_KEY = 'tp-home-material-scope'
export type FolderView = { id: string; title: string; description: string; demo?: boolean }
type Upload = { id: string; file: File; status: 'uploading' | 'failed'; error?: string }
type FolderImport = { title: string; error?: string }
const message = (error: unknown) => error instanceof Error ? error.message : '暂时没有连接上，请重试。'

export function useMaterials() {
  const [files, setFiles] = useState<MaterialView[]>([])
  const [folderMaterials, setFolderMaterials] = useState<Record<string, MaterialView>>({})
  const [searchScope, setSearchScope] = useState<SearchScope>({ kind: 'zhihu' })
  const [uploads, setUploads] = useState<Upload[]>([])
  const [imports, setImports] = useState<Record<string, FolderImport>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [folders, setFolders] = useState<FolderView[]>([])
  const [foldersStatus, setFoldersStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [foldersError, setFoldersError] = useState('')
  const [foldersDemo, setFoldersDemo] = useState(false)
  const [preview, setPreview] = useState<MaterialView | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const current = useRef({ files, folderMaterials, searchScope, uploads, imports })
  current.current = { files, folderMaterials, searchScope, uploads, imports }
  const pendingImports = useRef(new Set<string>())
  const importKeys = useRef(new Map<string, string>())
  const folderLoad = useRef<Promise<void> | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    let live = true
    void ensureSession().then(async () => {
      let ids: string[] = [], scope: SearchScope = { kind: 'zhihu' }, bindings: Record<string, string> = {}
      try { const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); if (Array.isArray(saved)) ids = saved.filter(id => typeof id === 'string').slice(0, 8) } catch { /* Invalid drafts never become materials. */ }
      try {
        const saved = JSON.parse(sessionStorage.getItem(SCOPE_KEY) ?? 'null')
        scope = normalizeScope(saved?.scope)
        if (saved?.folders && typeof saved.folders === 'object') bindings = Object.fromEntries(Object.entries(saved.folders).filter(([id, source]) => id.length > 0 && id.length <= 240 && typeof source === 'string')) as Record<string, string>
      } catch { /* Start with the default scope. */ }
      const records = await Promise.allSettled([...new Set([...ids, ...Object.values(bindings)])].map(id => productRequest<MaterialView>(`/api/v2/materials/${encodeURIComponent(id)}`)))
      if (!live) return
      const values = records.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
      setFiles(values.filter(item => item.origin === 'upload' && ids.includes(item.sourceId)))
      setFolderMaterials(Object.fromEntries(Object.entries(bindings).flatMap(([id, source]) => { const found = values.find(item => item.sourceId === source); return found ? [[id, { ...found, folderId: id }]] : [] })))
      setSearchScope(scope)
      setLoaded(true)
    }).catch(() => { if (live) { setLoaded(true); setError('已保存的资料暂未恢复，可重新打开已保存文件。') } })
    return () => { live = false; mounted.current = false }
  }, [])

  useEffect(() => {
    if (!loaded) return
    sessionStorage.setItem(KEY, JSON.stringify(files.map(item => item.sourceId)))
    // Persist only selected folders. A late deselected import is cached in memory, never re-selected on refresh.
    sessionStorage.setItem(SCOPE_KEY, JSON.stringify({ scope: searchScope, folders: Object.fromEntries((searchScope.kind === 'collections' ? searchScope.folderIds : []).flatMap(id => folderMaterials[id] ? [[id, folderMaterials[id].sourceId]] : [])) }))
  }, [files, folderMaterials, searchScope, loaded])

  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>
    async function poll() {
      const state = current.current
      const pending = selectedMaterials(state.files, state.folderMaterials, state.searchScope).filter(item => item.status === 'processing')
      await Promise.allSettled(pending.map(async item => {
        const next = await productRequest<MaterialView>(`/api/v2/materials/${encodeURIComponent(item.sourceId)}`)
        if (stopped) return
        if (item.origin === 'upload') setFiles(old => old.map(a => a.sourceId === next.sourceId ? next : a))
        else setFolderMaterials(old => Object.fromEntries(Object.entries(old).map(([id, a]) => [id, a.sourceId === next.sourceId ? { ...next, folderId: id } : a])))
      }))
      if (!stopped) timer = setTimeout(() => void poll(), 2000)
    }
    timer = setTimeout(() => void poll(), 1000)
    return () => { stopped = true; clearTimeout(timer) }
  }, [])

  const loadFolders = useCallback(() => {
    if (folderLoad.current) return folderLoad.current
    setFoldersStatus('loading'); setFoldersError('')
    return folderLoad.current = productRequest<{ items: FolderView[]; demo?: boolean }>('/api/v2/zhihu/folders').then(result => {
      if (mounted.current) { setFolders(result.items); setFoldersDemo(result.demo === true || result.items.some(item => item.demo)); setFoldersStatus('ready') }
    }).catch(e => { if (mounted.current) { setFoldersError(e instanceof ApiError && e.code === 'ZHIHU_LOGIN_REQUIRED' ? '连接账号后，即可选择你的公开收藏夹。' : message(e)); setFoldersStatus('error') } }).finally(() => { folderLoad.current = undefined })
  }, [])

  const add = (item: MaterialView) => {
    if (item.origin !== 'upload') return
    const state = current.current
    if (state.files.some(a => a.sourceId === item.sourceId)) return
    if (state.files.length + state.uploads.length + ((state.searchScope.kind === 'collections' ? state.searchScope.folderIds.length : 0)) >= 8) { setError('一次最多添加 8 份资料，请先移除一份。'); return }
    setFiles(old => old.some(a => a.sourceId === item.sourceId) ? old : [...old, item]); setError('')
  }

  async function uploadOne(upload: Upload) {
    setUploads(old => old.map(a => a.id === upload.id ? { ...a, status: 'uploading', error: undefined } : a))
    try {
      const file = upload.file
      if (!/\.(pdf|md|markdown|txt)$/i.test(file.name)) throw new Error('支持 PDF、MD、Markdown 和 TXT 文件。')
      const max = /\.pdf$/i.test(file.name) ? 100 : 10
      if (file.size > max * 1024 * 1024) throw new Error(`文件超过 ${max} MB，请拆分后添加。`)
      if (!file.size) throw new Error('文件为空，请检查后重新添加。')
      await ensureSession()
      let item: MaterialView | undefined
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`/api/v2/materials/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'Idempotency-Key': upload.id }, body: file, signal: AbortSignal.timeout(120000) })
          const body = await response.json()
          if (!response.ok) throw Object.assign(new Error(body.message ?? '上传未完成'), { status: response.status })
          item = body; break
        } catch (e) { if (attempt === 1 || (e as { status?: number }).status! < 500) throw e }
      }
      if (item && mounted.current) {
        // Removing an in-flight upload must not put it back when the response arrives.
        const ready = item
        if (current.current.uploads.some(a => a.id === upload.id)) setFiles(old => old.some(a => a.sourceId === ready.sourceId) ? old : [...old, ready])
        setUploads(old => old.filter(a => a.id !== upload.id))
      }
    } catch (e) { if (mounted.current) setUploads(old => old.map(a => a.id === upload.id ? { ...a, status: 'failed', error: message(e) } : a)) }
  }
  const upload = async (picked: FileList | File[]) => {
    const state = current.current
    if (!loaded || state.files.length + state.uploads.length + ((state.searchScope.kind === 'collections' ? state.searchScope.folderIds.length : 0)) + picked.length > 8) { setError('一次最多添加 8 份资料；一个收藏夹算一份。'); return }
    const batch: Upload[] = [...picked].map(file => ({ id: crypto.randomUUID(), file, status: 'uploading' }))
    current.current = { ...state, uploads: [...state.uploads, ...batch] }
    setUploads(old => [...old, ...batch]); setError('')
    const queue = [...batch]
    async function work() { for (;;) { const next = queue.shift(); if (!next) return; await uploadOne(next) } }
    await Promise.all([work(), work()])
  }

  const importFolder = async (folder: FolderView) => {
    if (pendingImports.current.has(folder.id) || current.current.folderMaterials[folder.id]) return
    pendingImports.current.add(folder.id)
    setImports(old => ({ ...old, [folder.id]: { title: folder.title } }))
    try {
      const key = importKeys.current.get(folder.id) ?? crypto.randomUUID(); importKeys.current.set(folder.id, key)
      const item = await productRequest<MaterialView>('/api/v2/materials/zhihu', { method: 'POST', body: { kind: 'collection', folderId: folder.id }, key })
      if (mounted.current) {
        setFolderMaterials(old => ({ ...old, [folder.id]: { ...item, folderId: folder.id } }))
        setImports(old => { const next = { ...old }; delete next[folder.id]; return next })
      }
    } catch (e) { if (mounted.current) setImports(old => ({ ...old, [folder.id]: { title: folder.title, error: message(e) } })) }
    finally { pendingImports.current.delete(folder.id) }
  }
  const setKind = (kind: SearchScope['kind']) => {
    setSearchScope(old => kind === 'collections' ? { kind, folderIds: old.kind === 'collections' ? old.folderIds : [] } : { kind }); setError('')
  }
  const toggleFolder = (folder: FolderView) => {
    const state = current.current
    const selected = state.searchScope.kind === 'collections' ? state.searchScope.folderIds : []
    const exists = selected.includes(folder.id)
    if (!exists && state.files.length + state.uploads.length + selected.length >= 8) { setError('一次最多添加 8 份资料，请先移除一份。'); return }
    const next: SearchScope = { kind: 'collections', folderIds: exists ? selected.filter(id => id !== folder.id) : [...selected, folder.id] }
    current.current = { ...state, searchScope: next }; setSearchScope(next); setError('')
    if (!exists) void importFolder(folder)
  }
  // Missing imports after a refresh resume only for explicitly selected folders.
  useEffect(() => {
    if (!loaded || searchScope.kind !== 'collections') return
    for (const id of searchScope.kind === 'collections' ? searchScope.folderIds : []) if (!folderMaterials[id] && !imports[id]) void importFolder(folders.find(f => f.id === id) ?? { id, title: '知乎收藏夹', description: '' })
  }, [loaded, searchScope, folderMaterials, folders, imports])

  const remove = (id: string) => {
    setFiles(old => old.filter(item => item.sourceId !== id))
    setSearchScope(old => old.kind === 'collections' ? { ...old, folderIds: old.folderIds?.filter(folderId => folderMaterials[folderId]?.sourceId !== id) } : old)
  }
  const resume = async (item: MaterialView) => {
    try {
      await productRequest(`/api/v2/resources/${encodeURIComponent(item.sourceId)}/resume`, { method: 'POST' })
      const next = await productRequest<MaterialView>(`/api/v2/materials/${encodeURIComponent(item.sourceId)}`)
      if (item.origin === 'upload') setFiles(old => old.map(a => a.sourceId === item.sourceId ? next : a))
      else setFolderMaterials(old => Object.fromEntries(Object.entries(old).map(([id, a]) => [id, a.sourceId === item.sourceId ? { ...next, folderId: id } : a])))
    } catch (e) { setError(message(e)) }
  }
  const items = selectedMaterials(files, folderMaterials, searchScope)
  return {
    files, items, folders, foldersDemo, foldersStatus, foldersError, loadFolders, folderMaterials, searchScope, setKind, toggleFolder,
    imports, importFolder, uploads, upload, retryUpload: uploadOne, removeUpload: (id: string) => { current.current.uploads = current.current.uploads.filter(a => a.id !== id); setUploads(old => old.filter(a => a.id !== id)) },
    add, remove, resume, error, setError, loaded, preview, setPreview, libraryOpen, setLibraryOpen,
    ready: loaded && !uploads.length && materialsReady(files, folderMaterials, searchScope),
    attachments: items.map(a => ({ ...a, content: '[资料已保存，由服务端读取]' })),
  }
}
export type MaterialsModel = ReturnType<typeof useMaterials>
