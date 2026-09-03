import { useState } from 'react'
import type { AssistantMode } from '../assistant-mode'
import { Composer, QuickModes } from '../components/Composer'
import { Icon } from '../icons'
import { launchChat } from './Chat'
import { openKnowledge, openRoute } from '../workspace/nav'
import { useLibrarySelector } from '../runtime/use-library-selector'
import { selectRecommendedKnowledge, selectRecommendedRoutes } from '../runtime/library-read-model'
import { pathLaunchAttachments, type PathAttachment } from '../path-planning/path-run-client'

const suggestions = ['给我制定一条机器学习数学路线','用图解释矩阵乘法','哪些知乎作者擅长讲线性代数？']
const HOME_SELECT_ROUTE = 'threadpeak-home-select-route'

function extractPdfText(bytes: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(bytes)
  return [...text.matchAll(/\((?:\\.|[^\\)]){2,}\)/g)]
    .map((match) => match[0].slice(1, -1).replace(/\\n/g, '\n').replace(/\\\(/g, '(').replace(/\\\)/g, ')'))
    .filter((item) => /[\u4e00-\u9fffA-Za-z]/.test(item))
    .join('\n')
}

async function readHomeAttachment(file: File): Promise<PathAttachment | { error: string }> {
  const name = file.name
  const lower = name.toLowerCase()
  if (!/\.(pdf|md|txt)$/.test(lower) && !['application/pdf', 'text/markdown', 'text/plain'].includes(file.type)) {
    return { error: '附件只支持 pdf、md、txt。' }
  }
  const sourceId = `att-${crypto.randomUUID()}`
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    const content = extractPdfText(new Uint8Array(await file.arrayBuffer()))
    return { sourceId, fileName: name, mimeType: 'application/pdf', content }
  }
  const content = await file.text()
  return {
    sourceId,
    fileName: name,
    mimeType: lower.endsWith('.md') ? 'text/markdown' : 'text/plain',
    content,
  }
}

export function HomePage() {
  const initial = sessionStorage.getItem('threadpeak-home-prefill') ?? ''
  if (initial) sessionStorage.removeItem('threadpeak-home-prefill')
  const selectRoute = sessionStorage.getItem(HOME_SELECT_ROUTE) === '1'
  if (selectRoute) sessionStorage.removeItem(HOME_SELECT_ROUTE)
  const [mode,setMode] = useState<AssistantMode>(()=>selectRoute || /路线|学习计划/.test(initial)?'route':'')
  const [value,setValue] = useState(initial)
  const [attachments,setAttachments] = useState<PathAttachment[]>([])
  const [attachError,setAttachError] = useState('')
  const send = () => {
    const query=value.trim()
    if(!query)return
    launchChat(query,mode==='route'?'route':mode==='visual'?'visual':'answer', attachments)
  }
  const exampleKnowledge = useLibrarySelector(selectRecommendedKnowledge)
  const exampleRoutes = useLibrarySelector(selectRecommendedRoutes)
  return <main className="home" data-page="home">
    <div className="home-heading">循着问题与答案的脉络，登上理解的高峰。</div>
    <div className="home-center">
      <QuickModes selected={mode} onSelect={setMode}/>
      {attachments.length > 0 && <div className="home-attachments">{attachments.map((item) => <span key={item.sourceId} className="attachment-chip">{item.fileName}<button type="button" aria-label={`移除${item.fileName}`} onClick={() => setAttachments((current) => current.filter((entry) => entry.sourceId !== item.sourceId))}>×</button></span>)}</div>}
      {attachError && <p className="composer-unavailable" role="alert">{attachError}</p>}
      <Composer value={value} onChange={setValue} mode={mode} onMode={setMode} onSend={send} showScope={false} showReference={false} onPickFiles={(files) => {
        void Promise.all([...files].map(readHomeAttachment)).then((items) => {
          const failed = items.find((item) => 'error' in item)
          if (failed && 'error' in failed) {
            setAttachError(failed.error)
            return
          }
          setAttachError('')
          setAttachments((current) => [...current, ...items as PathAttachment[]])
        })
      }}/>
      <section className="home-discovery">
        <div className="home-suggestions"><h2>想了解点什么？</h2><div className="suggestion-marquee"><div className="suggestion-track">{[0,1].map((copy)=><div className="suggestion-group" aria-hidden={copy===1} key={copy}>{suggestions.map((x)=><button key={`${copy}-${x}`} tabIndex={copy===1?-1:0} onClick={()=>{setMode('route');setValue(x)}}>{x}</button>)}</div>)}</div></div></div>
        <div className="home-recommendations home-libraries"><h2>推荐知识脉络 <small>示例内容</small></h2><div>{exampleKnowledge.map((item)=><button key={item.id} onClick={()=>{openKnowledge(item.id,'home');location.hash='knowledge-detail'}}><span><Icon name="book" size={18}/></span><b>{item.title}</b><small>示例知识脉络 · {item.sources} 个来源</small></button>)}</div></div>
        <div className="home-recommendations home-routes"><h2>推荐学习路线 <small>示例内容</small></h2><div>{exampleRoutes.map((item)=><button key={item.id} onClick={()=>{openRoute(item.id,'home');location.hash='path-3d'}}><span><Icon name={item.icon} size={18}/></span><b>{item.title}</b><small>示例学习路线 · {item.carriers} 个载体 · {item.concepts} 个最终概念</small></button>)}</div></div>
      </section>
    </div>
  </main>
}
