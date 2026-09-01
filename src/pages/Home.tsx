import { useState } from 'react'
import type { AssistantMode } from '../assistant-mode'
import { Composer, QuickModes } from '../components/Composer'
import { Icon } from '../icons'
import { launchChat } from './Chat'
import { openKnowledge, openRoute } from '../workspace/nav'
import { useLibrarySelector } from '../runtime/use-runtime-selector'
import { selectRecommendedKnowledge, selectRecommendedRoutes } from '../runtime/library-read-model'

const suggestions = ['给我制定一条机器学习数学路线','用图解释矩阵乘法','哪些知乎作者擅长讲线性代数？']

export function HomePage() {
  const initial = sessionStorage.getItem('threadpeak-home-prefill') ?? ''
  if (initial) sessionStorage.removeItem('threadpeak-home-prefill')
  const [mode,setMode] = useState<AssistantMode>(()=>/路线|学习计划/.test(initial)?'route':/博主|作者/.test(initial)?'authors':'')
  const [value,setValue] = useState(initial)
  const send = () => {
    const query=value.trim()
    if(!query)return
    launchChat(query,mode==='route'?'route':mode==='visual'?'visual':'answer')
  }
  const exampleKnowledge = useLibrarySelector(selectRecommendedKnowledge)
  const exampleRoutes = useLibrarySelector(selectRecommendedRoutes)
  return <main className="home" data-page="home">
    <div className="home-heading">循着问题与答案的脉络，登上理解的高峰。</div>
    <div className="home-center">
      <QuickModes selected={mode} onSelect={setMode}/>
      <Composer value={value} onChange={setValue} mode={mode} onMode={setMode} onSend={send} showScope={false} showReference={false}/>
      <section className="home-discovery">
        <div className="home-suggestions"><h2>想了解点什么？</h2><div className="suggestion-marquee"><div className="suggestion-track">{[0,1].map((copy)=><div className="suggestion-group" aria-hidden={copy===1} key={copy}>{suggestions.map((x)=><button key={`${copy}-${x}`} tabIndex={copy===1?-1:0} onClick={()=>setValue(x)}>{x}</button>)}</div>)}</div></div></div>
        <div className="home-recommendations home-libraries"><h2>推荐知识脉络 <small>示例内容</small></h2><div>{exampleKnowledge.map((item)=><button key={item.id} onClick={()=>{openKnowledge(item.id,'home');location.hash='knowledge-detail'}}><span><Icon name="book" size={18}/></span><b>{item.title}</b><small>示例知识脉络 · {item.sources} 个来源</small></button>)}</div></div>
        <div className="home-recommendations home-routes"><h2>推荐学习路线 <small>示例内容</small></h2><div>{exampleRoutes.map((item)=><button key={item.id} onClick={()=>{openRoute(item.id,'home');location.hash='path-3d'}}><span><Icon name={item.icon} size={18}/></span><b>{item.title}</b><small>示例学习路线 · {item.carriers} 个载体 · {item.concepts} 个最终概念</small></button>)}</div></div>
      </section>
    </div>
  </main>
}
