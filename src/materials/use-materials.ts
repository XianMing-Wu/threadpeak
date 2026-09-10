import {getWorkspaceSession} from '../runtime/workspace-session'
import {pollResource} from '../learning-v2/poll'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, ensureSession, productRequest } from '../learning-v2/client'
import { materialsReady, normalizeScope, selectedMaterials, type MaterialView, type SearchScope } from './selection'

const KEY = 'tp-home-materials'
const SCOPE_KEY = 'tp-home-material-scope'
export type FolderView = { id: string; title: string; description: string; demo?: boolean }
type Upload = { id: string; file: File; status: 'uploading' | 'failed'; error?: string }
type FolderImport = { title: string; error?: string }
type UnresolvedMaterial = {sourceId:string;folderId?:string}
const message = (error: unknown) => error instanceof Error ? error.message : '暂时没有连接上，请重试。'

export function useMaterials() {
  const [files, setFiles] = useState<MaterialView[]>([])
  const [folderMaterials, setFolderMaterials] = useState<Record<string, MaterialView>>({})
  const [searchScope, setSearchScope] = useState<SearchScope>({ kind: 'zhihu' })
  const [uploads, setUploads] = useState<Upload[]>([])
  const [imports, setImports] = useState<Record<string, FolderImport>>({})
  const [loaded, setLoaded] = useState(false)
  const [unresolved,setUnresolved]=useState<UnresolvedMaterial[]>([])
  const [restoreError,setRestoreError]=useState('')
  const [restoreAttempt,setRestoreAttempt]=useState(0)
  const [restoring,setRestoring]=useState(true)
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
  const creationAttempt = useRef(0)
  const folderLoad = useRef<Promise<void> | undefined>(undefined)
  const mounted = useRef(true)

  const restoreEpoch=useRef(0)
  useEffect(()=>{
    const changed=()=>{restoreEpoch.current++;setLoaded(false);setRestoring(true);setFiles([]);setFolderMaterials({});setUnresolved([]);setUploads([]);setImports({});setFolders([]);setPreview(null);pendingImports.current.clear();importKeys.current.clear();setRestoreAttempt(n=>n+1)}
    window.addEventListener('threadpeak:account-change',changed)
    return()=>window.removeEventListener('threadpeak:account-change',changed)
  },[])
  useEffect(() => {
    const epoch=restoreEpoch.current
    mounted.current = true
    let live = true
    setRestoring(true);setLoaded(false);setRestoreError('')
    void ensureSession().then(async () => {
      let ids: string[] = [], scope: SearchScope = { kind: 'zhihu' }, bindings: Record<string, string> = {}
      try { const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); if (Array.isArray(saved)) ids = saved.filter(id => typeof id === 'string').slice(0, 8) } catch { /* Invalid drafts never become materials. */ }
      try {
        const saved = JSON.parse(sessionStorage.getItem(SCOPE_KEY) ?? 'null')
        scope = normalizeScope(saved?.scope)
        if (saved?.folders && typeof saved.folders === 'object') bindings = Object.fromEntries(Object.entries(saved.folders).filter(([id, source]) => id.length > 0 && id.length <= 240 && typeof source === 'string')) as Record<string, string>
      } catch { /* Start with the default scope. */ }
      if(getWorkspaceSession()?.kind==='guest'&&scope.kind==='collections'){scope={kind:'zhihu'};bindings={}}
      const selectedFolders=scope.kind==='collections'?scope.folderIds:[]
      bindings=Object.fromEntries(Object.entries(bindings).filter(([id])=>selectedFolders.includes(id)))
      const requested=[...new Set([...ids,...Object.values(bindings)])]
      const records = await Promise.allSettled(requested.map(id => productRequest<MaterialView>(`/api/v2/materials/${encodeURIComponent(id)}`)))
      if (!live||epoch!==restoreEpoch.current) return
      const values = records.flatMap((r,i) => r.status === 'fulfilled'&&r.value.sourceId===requested[i] ? [r.value] : [])
      setUnresolved([...ids.filter(id=>!values.some(v=>v.sourceId===id&&(v.origin==='upload'||v.origin==='creation'))).map(sourceId=>({sourceId})),...Object.entries(bindings).filter(([,source])=>!values.some(v=>v.sourceId===source)).map(([folderId,sourceId])=>({folderId,sourceId}))])
      setFiles(values.filter(item => (item.origin === 'upload'||item.origin==='creation'&&getWorkspaceSession()?.capabilities.zhihuMaterials) && ids.includes(item.sourceId)))
      setFolderMaterials(Object.fromEntries(Object.entries(bindings).flatMap(([id, source]) => { const found = values.find(item => item.sourceId === source); return found ? [[id, { ...found, folderId: id }]] : [] })))
      setSearchScope(scope)
      setLoaded(true)
    }).catch(() => { if (live&&epoch===restoreEpoch.current) setRestoreError('已选资料暂未恢复，原选择仍然保留，请重新读取。') }).finally(()=>{if(live&&epoch===restoreEpoch.current)setRestoring(false)})
    return () => { live = false; mounted.current = false }
  }, [restoreAttempt])

  useEffect(() => {
    if (!loaded) return
    sessionStorage.setItem(KEY, JSON.stringify([...new Set([...files.map(item => item.sourceId),...unresolved.filter(a=>!a.folderId).map(a=>a.sourceId)])]))
    // Persist only selected folders. A late deselected import is cached in memory, never re-selected on refresh.
    sessionStorage.setItem(SCOPE_KEY, JSON.stringify({ scope: searchScope, folders: Object.fromEntries((searchScope.kind === 'collections' ? searchScope.folderIds : []).flatMap(id => {const source=folderMaterials[id]?.sourceId??unresolved.find(a=>a.folderId===id)?.sourceId;return source?[[id,source]]:[]})) }))
  }, [files, folderMaterials, searchScope, loaded,unresolved])

  useEffect(() => {
    const abort=new AbortController()
    void pollResource(async()=>{
      const state=current.current
      const pending=selectedMaterials(state.files,state.folderMaterials,state.searchScope).filter(item=>item.status==='processing')
      const results=await Promise.allSettled(pending.map(async item=>{
        const next=await productRequest<MaterialView>(`/api/v2/materials/${encodeURIComponent(item.sourceId)}`,{signal:abort.signal})
        if(abort.signal.aborted)return
        if(item.origin!=='collection')setFiles(old=>old.map(a=>a.sourceId===next.sourceId?next:a))
        else setFolderMaterials(old=>Object.fromEntries(Object.entries(old).map(([id,a])=>[id,a.sourceId===next.sourceId?{...next,folderId:id}:a])))
      }))
      const failure=results.find(r=>r.status==='rejected');if(failure?.status==='rejected')throw failure.reason
    },{signal:abort.signal,intervalMs:2000,onError:(_error,stopped)=>{if(stopped)setError('资料连接暂停，请刷新后继续。已上传内容仍然保留。')}})
    return()=>abort.abort()
  }, [])

  const loadFolders = useCallback(() => {
    if(getWorkspaceSession()?.kind==='guest')return Promise.resolve()
    if (folderLoad.current) return folderLoad.current
    setFoldersStatus('loading'); setFoldersError('')
    return folderLoad.current = productRequest<{ items: FolderView[]; demo?: boolean }>('/api/v2/zhihu/folders').then(result => {
      if (mounted.current) { setFolders(result.items); setFoldersDemo(result.demo === true || result.items.some(item => item.demo)); setFoldersStatus('ready') }
    }).catch(e => { if (mounted.current) { setFoldersError(e instanceof ApiError && e.code === 'ZHIHU_LOGIN_REQUIRED' ? '连接账号后，即可选择你的公开收藏夹。' : message(e)); setFoldersStatus('error') } }).finally(() => { folderLoad.current = undefined })
  }, [])

  const add = (item: MaterialView) => {
    if (!loaded||item.origin==='collection'||item.origin==='creation'&&(!getWorkspaceSession()?.capabilities.zhihuMaterials||current.current.searchScope.kind==='collections')) return
    const state = current.current
    if (state.files.some(a => a.sourceId === item.sourceId)) return
    if (state.files.length + unresolved.filter(a=>!a.folderId&&a.sourceId!==item.sourceId).length + state.uploads.length + (pendingImports.current.has('@creation') || state.imports['@creation'] ? 1 : 0) + ((state.searchScope.kind === 'collections' ? state.searchScope.folderIds.length : 0)) >= 8) { setError('一次最多添加 8 份资料，请先移除一份。'); return }
    setUnresolved(old=>old.filter(a=>a.sourceId!==item.sourceId))
    setFiles(old => old.some(a => a.sourceId === item.sourceId) ? old : [...old, item]); setError('')
  }

  async function uploadOne(upload: Upload,epoch=restoreEpoch.current) {
    if(epoch!==restoreEpoch.current)return
    setUploads(old => old.map(a => a.id === upload.id ? { ...a, status: 'uploading', error: undefined } : a))
    try {
      const file = upload.file
      if (!/\.(pdf|md|markdown|txt)$/i.test(file.name)) throw new Error('支持 PDF、MD、Markdown 和 TXT 文件。')
      const max = /\.pdf$/i.test(file.name) ? 100 : 10
      if (file.size > max * 1024 * 1024) throw new Error(`文件超过 ${max} MB，请拆分后添加。`)
      if (!file.size) throw new Error('文件为空，请检查后重新添加。')
      await ensureSession()
      if(epoch!==restoreEpoch.current)return
      let item: MaterialView | undefined
      for (let attempt = 0; attempt < 2; attempt++) {
        if(epoch!==restoreEpoch.current)return
        try {
          const response = await fetch(`/api/v2/materials/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'Idempotency-Key': upload.id }, body: file, signal: AbortSignal.timeout(120000) })
          const body = await response.json()
          if (!response.ok) throw Object.assign(new Error(body.message ?? '上传未完成'), { status: response.status })
          item = body; break
        } catch (e) { if (attempt === 1 || (e as { status?: number }).status! < 500) throw e }
      }
      if (item && mounted.current&&epoch===restoreEpoch.current) {
        // Removing an in-flight upload must not put it back when the response arrives.
        const ready = item
        if (current.current.uploads.some(a => a.id === upload.id)) setFiles(old => old.some(a => a.sourceId === ready.sourceId) ? old : [...old, ready])
        setUploads(old => old.filter(a => a.id !== upload.id))
      }
    } catch (e) { if (mounted.current&&epoch===restoreEpoch.current) setUploads(old => old.map(a => a.id === upload.id ? { ...a, status: 'failed', error: message(e) } : a)) }
  }
  const upload = async (picked: FileList | File[]) => {
    const state = current.current
    if (!loaded || state.files.length + unresolved.filter(a=>!a.folderId).length + state.uploads.length + (pendingImports.current.has('@creation') || state.imports['@creation'] ? 1 : 0) + ((state.searchScope.kind === 'collections' ? state.searchScope.folderIds.length : 0)) + picked.length > 8) { setError('一次最多添加 8 份资料；一个收藏夹算一份。'); return }
    const batch: Upload[] = [...picked].map(file => ({ id: crypto.randomUUID(), file, status: 'uploading' }))
    current.current = { ...state, uploads: [...state.uploads, ...batch] }
    setUploads(old => [...old, ...batch]); setError('')
    const queue = [...batch],epoch=restoreEpoch.current
    async function work() { for (;;) { const next = queue.shift(); if (!next) return; await uploadOne(next,epoch) } }
    await Promise.all([work(), work()])
  }

  const importFolder = async (folder: FolderView) => {
    if (!loaded||unresolved.some(a=>a.folderId===folder.id)||pendingImports.current.has(folder.id) || current.current.folderMaterials[folder.id]) return
    const epoch=restoreEpoch.current
    pendingImports.current.add(folder.id)
    setImports(old => ({ ...old, [folder.id]: { title: folder.title } }))
    try {
      const key = importKeys.current.get(folder.id) ?? crypto.randomUUID(); importKeys.current.set(folder.id, key)
      const item = await productRequest<MaterialView>('/api/v2/materials/zhihu', { method: 'POST', body: { kind: 'collection', folderId: folder.id }, key })
      if (mounted.current&&epoch===restoreEpoch.current) {
        setFolderMaterials(old => ({ ...old, [folder.id]: { ...item, folderId: folder.id } }))
        setImports(old => { const next = { ...old }; delete next[folder.id]; return next })
      }
    } catch (e) { if (mounted.current&&epoch===restoreEpoch.current) setImports(old => ({ ...old, [folder.id]: { title: folder.title, error: message(e) } })) }
    finally { if(epoch===restoreEpoch.current)pendingImports.current.delete(folder.id) }
  }
  const importCreation=async()=>{
    const id='@creation',state=current.current
    if(!loaded||!getWorkspaceSession()?.capabilities.zhihuMaterials||state.searchScope.kind==='collections'||pendingImports.current.has(id))return
    if(state.files.length+unresolved.filter(a=>!a.folderId).length+state.uploads.length>=8){setError('一次最多添加 8 份资料，请先移除一份。');return}
    const attempt=++creationAttempt.current,epoch=restoreEpoch.current,key=importKeys.current.get(id)??crypto.randomUUID();importKeys.current.set(id,key);pendingImports.current.add(id);setImports(old=>({...old,[id]:{title:'我的公开创作'}}))
    try{const item=await productRequest<MaterialView>('/api/v2/materials/zhihu',{method:'POST',body:{kind:'creation'},key});if(mounted.current&&epoch===restoreEpoch.current&&attempt===creationAttempt.current&&pendingImports.current.has(id)){setFiles(old=>old.some(a=>a.sourceId===item.sourceId)?old:[...old,item]);setImports(old=>{const next={...old};delete next[id];return next});importKeys.current.delete(id)}}catch(e){if(mounted.current&&epoch===restoreEpoch.current&&attempt===creationAttempt.current&&pendingImports.current.has(id))setImports(old=>({...old,[id]:{title:'我的公开创作',error:message(e)}}))}finally{if(epoch===restoreEpoch.current&&attempt===creationAttempt.current)pendingImports.current.delete(id)}
  }
  const setKind = (kind: SearchScope['kind']) => {
    if(!loaded)return
    setSearchScope(old => kind === 'collections' ? { kind, folderIds: old.kind === 'collections' ? old.folderIds : [] } : { kind }); setError('')
    if(kind!=='collections')setUnresolved(old=>old.filter(a=>!a.folderId))
  }
  const toggleFolder = (folder: FolderView) => {
    if(!loaded)return
    const state = current.current
    const selected = state.searchScope.kind === 'collections' ? state.searchScope.folderIds : []
    const exists = selected.includes(folder.id)
    if (!exists && state.files.length + unresolved.filter(a=>!a.folderId).length + state.uploads.length + (pendingImports.current.has('@creation') || state.imports['@creation'] ? 1 : 0) + selected.length >= 8) { setError('一次最多添加 8 份资料，请先移除一份。'); return }
    if(exists)setUnresolved(old=>old.filter(a=>a.folderId!==folder.id))
    const next: SearchScope = { kind: 'collections', folderIds: exists ? selected.filter(id => id !== folder.id) : [...selected, folder.id] }
    current.current = { ...state, searchScope: next }; setSearchScope(next); setError('')
    if (!exists) void importFolder(folder)
  }
  // Missing imports after a refresh resume only for explicitly selected folders.
  useEffect(() => {
    if (!loaded || searchScope.kind !== 'collections') return
    for (const id of searchScope.kind === 'collections' ? searchScope.folderIds : []) if (!folderMaterials[id] && !imports[id]&&!unresolved.some(a=>a.folderId===id)) void importFolder(folders.find(f => f.id === id) ?? { id, title: '知乎收藏夹', description: '' })
  }, [loaded, searchScope, folderMaterials, folders, imports,unresolved])

  const remove = (id: string) => {
    if(!loaded)return
    const missing=unresolved.find(a=>a.sourceId===id)
    setUnresolved(old=>old.filter(a=>a.sourceId!==id))
    setFiles(old => old.filter(item => item.sourceId !== id))
    setSearchScope(old => old.kind === 'collections' ? { ...old, folderIds: old.folderIds?.filter(folderId => folderMaterials[folderId]?.sourceId !== id&&folderId!==missing?.folderId) } : old)
  }
  const resume = async (item: MaterialView) => {
    try {
      await productRequest(`/api/v2/resources/${encodeURIComponent(item.sourceId)}/resume`, { method: 'POST' })
      const next = await productRequest<MaterialView>(`/api/v2/materials/${encodeURIComponent(item.sourceId)}`)
      if (item.origin !== 'collection') setFiles(old => old.map(a => a.sourceId === item.sourceId ? next : a))
      else setFolderMaterials(old => Object.fromEntries(Object.entries(old).map(([id, a]) => [id, a.sourceId === item.sourceId ? { ...next, folderId: id } : a])))
    } catch (e) { setError(message(e)) }
  }
  const items = selectedMaterials(files, folderMaterials, searchScope)
  return {
    files, items, folders, foldersDemo, foldersStatus, foldersError, loadFolders, folderMaterials, searchScope, setKind, toggleFolder,
    imports, importFolder, importCreation, removeCreationImport:()=>{creationAttempt.current++;pendingImports.current.delete('@creation');setImports(old=>{const next={...old};delete next['@creation'];return next})}, uploads, upload, retryUpload: uploadOne, removeUpload: (id: string) => { current.current.uploads = current.current.uploads.filter(a => a.id !== id); setUploads(old => old.filter(a => a.id !== id)) },
    add, remove, resume, error, setError, loaded, preview, setPreview, libraryOpen, setLibraryOpen,
    unresolved,restoring,restoreError,retryRestore:()=>{if(!restoring){setLoaded(false);setRestoreAttempt(n=>n+1)}},
    ready: loaded && !restoring && !unresolved.length && !uploads.length && !imports['@creation'] && materialsReady(files, folderMaterials, searchScope),
    attachments: items.map(a => ({ ...a, content: '[资料已保存，由服务端读取]' })),
  }
}
export type MaterialsModel = ReturnType<typeof useMaterials>
