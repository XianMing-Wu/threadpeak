import { MaterialChips, MaterialScope, Materials, useMaterials } from '../materials/Materials'
import { rememberPathSearchScope } from '../path-planning/path-run-client'
import { CHAT_LAUNCH_KEY } from '../history'
import { useEffect, useState } from 'react'
import { Composer } from '../components/Composer'
import { launchChat } from './Chat'
import { readLearningThinking, subscribeLearningThinking, writeLearningThinking } from '../session/learning-thinking'
import { openKnowledge, openRoute } from '../workspace/nav'
import { useLibrarySelector } from '../runtime/use-library-selector'
import { selectRecommendedKnowledge, selectRecommendedRoutes } from '../runtime/library-read-model'
import { Icon } from '../icons'
import { HomeLandscape } from '../ui/HomeLandscape'
import { PeakWordmark } from '../ui/PeakWordmark'

const suggestions = ['给我制定一条机器学习数学路线','帮我规划一条线性代数入门路线','哪些知乎作者擅长讲线性代数？']
const HOME_SELECT_ROUTE = 'threadpeak-home-select-route'

export function HomePage() {
  const initial = sessionStorage.getItem('threadpeak-home-prefill') ?? ''
  if (initial) sessionStorage.removeItem('threadpeak-home-prefill')
  if (sessionStorage.getItem(HOME_SELECT_ROUTE) === '1') sessionStorage.removeItem(HOME_SELECT_ROUTE)
  const [value,setValue] = useState(initial)
  const materials=useMaterials()
  const [thinkingDepth, setThinkingDepth] = useState(readLearningThinking)
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
  const send = () => {
    const query=value.trim()
    if(!query||!materials.ready)return
    writeLearningThinking(thinkingDepth)
    launchChat(query, 'route', materials.attachments, thinkingDepth)
    // launchChat writes this conversation synchronously; the hash route mounts afterwards.
    // Keep scope keyed to that launch, so later home changes cannot alter a pending request.
    const launch = JSON.parse(sessionStorage.getItem(CHAT_LAUNCH_KEY) ?? 'null')
    if (launch?.conversationId) rememberPathSearchScope(`route-start:${launch.conversationId}`, materials.searchScope)
  }
  const exampleKnowledge = useLibrarySelector(selectRecommendedKnowledge)
  const exampleRoutes = useLibrarySelector(selectRecommendedRoutes)
  return <main className="home" data-page="home">
    <HomeLandscape/>
    <div className="home-head" aria-hidden="true" />
    <div className="home-body home-center">
      <PeakWordmark />
      <Composer value={value} onChange={setValue} onSend={send} sendDisabled={!materials.ready} thinkingDepth={thinkingDepth} onThinkingDepth={(next) => { writeLearningThinking(next); setThinkingDepth(next) }} onPickFiles={files=>void materials.upload(files)} topContent={<MaterialChips model={materials}/>} beforeAttachment={<MaterialScope model={materials}/>}/>
      <Materials model={materials}/>
      <section className="home-discovery">
        <div className="home-suggestions"><h2>想了解点什么？</h2><div className="suggestion-marquee"><div className="suggestion-track">{[0,1].map((copy)=><div className="suggestion-group" aria-hidden={copy===1} key={copy}>{suggestions.map((x)=><button key={`${copy}-${x}`} tabIndex={copy===1?-1:0} onClick={()=>setValue(x)}>{x}</button>)}</div>)}</div></div></div>
        <div className="home-recommendations home-libraries"><h2>推荐知识脉络 <small>示例内容</small></h2><div>{exampleKnowledge.map((item)=><button type="button" className="home-lib" key={item.id} onClick={()=>{openKnowledge(item.id,'home');location.hash='knowledge-detail'}}><span><Icon name="book" size={18}/></span><b>{item.title}</b><small>示例知识脉络 · {item.sources} 个来源</small></button>)}</div></div>
        <div className="home-recommendations home-routes"><h2>推荐学习路线 <small>示例内容</small></h2><div>{exampleRoutes.map((item)=><button type="button" className="home-route" key={item.id} onClick={()=>{openRoute(item.id,'home');location.hash='path-3d'}}><span><Icon name={item.icon} size={18}/></span><b>{item.title}</b><small>示例学习路线 · {item.carriers} 个载体 · {item.concepts} 个最终概念</small></button>)}</div></div>
      </section>
    </div>
  </main>
}
