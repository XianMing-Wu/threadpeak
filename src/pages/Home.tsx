import { useEffect,useState } from 'react'
import { launchChat } from '../chat/launch'
import { Composer } from '../components/Composer'
import { Icon } from '../icons'
import { MaterialChips,MaterialScope,Materials,useMaterials } from '../materials/Materials'
import { rememberPathSearchScope } from '../path-planning/path-run-client'
import { selectRecommendedKnowledge,selectRecommendedRoutes } from '../runtime/library-read-model'
import { useLibrarySelector } from '../runtime/use-library-selector'
import { readLearningThinking,subscribeLearningThinking,writeLearningThinking } from '../session/learning-thinking'
import { HomeLandscape } from '../ui/HomeLandscape'
import { PeakWordmark } from '../ui/PeakWordmark'
import { openConceptKnowledge,openKnowledge,openRoute } from '../workspace/nav'

import { homeSuggestions } from '../showcase/content'
import '../showcase/showcase.css'
const HOME_SELECT_ROUTE = 'threadpeak-home-select-route'

export function HomePage() {
  const initial = sessionStorage.getItem('threadpeak-home-prefill') ?? ''
  useEffect(()=>{sessionStorage.removeItem('threadpeak-home-prefill');sessionStorage.removeItem(HOME_SELECT_ROUTE)},[])
  const [value,setValue] = useState(initial)
  const materials=useMaterials()
  const [thinkingDepth, setThinkingDepth] = useState(readLearningThinking)
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
  const send = () => {
    const query=value.trim()
    if(!query||!materials.ready)return
    writeLearningThinking(thinkingDepth)
    const conversationId=launchChat(query,'route',materials.attachments,thinkingDepth)
    rememberPathSearchScope(`route-start:${conversationId}`,materials.searchScope)
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
        <div className="home-suggestions"><h2>从你想完成的事开始</h2><div className="suggestion-marquee"><div className="suggestion-track">{[0,1].map(copy=><div className="suggestion-group" aria-hidden={copy===1} key={copy}>{homeSuggestions.map(x=><button key={`${copy}-${x.label}`} tabIndex={copy===1?-1:0} onClick={()=>{setValue(x.prompt);document.querySelector<HTMLTextAreaElement>('.composer-input textarea')?.focus()}}>{x.label}</button>)}</div>)}</div></div></div>
        <div className="home-recommendations home-libraries"><h2>看见知识怎样连起来 <small>编选示例</small><a href="#knowledge?tab=example">查看全部 →</a></h2><div>{exampleKnowledge.map(item=><button type="button" className="home-lib" key={item.id} onClick={()=>{if(item.conceptId)openConceptKnowledge(item.id,item.conceptId);else openKnowledge(item.id,'home');location.hash='knowledge-detail'}}><span><Icon name="book" size={18}/></span><b>{item.title}</b><small>{item.description}</small></button>)}</div></div>
        <div className="home-recommendations home-routes"><h2>看看不同目标，怎样走 <small>编选示例</small><a href="#paths?tab=example">查看全部 →</a></h2><div>{exampleRoutes.map(item=><button type="button" className="home-route" key={item.id} onClick={()=>{openRoute(item.id,'home');location.hash='path-3d'}}><span><Icon name={item.icon} size={18}/></span><b>{item.title}</b><small>{item.outcome}</small></button>)}</div></div>
      </section>
    </div>
  </main>
}
