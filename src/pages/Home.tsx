import { useEffect, useRef, useState } from 'react'
import { launchChat } from '../chat/launch'
import { Composer } from '../components/Composer'
import { EmptyStatus } from '../components/EmptyStatus'
import { Icon } from '../icons'
import { MaterialChips, MaterialScope, Materials, useMaterials } from '../materials/Materials'
import { rememberPathSearchScope } from '../path-planning/path-run-client'
import { selectRecommendedKnowledge, selectRecommendedRoutes } from '../runtime/library-read-model'
import { useLibrarySelector } from '../runtime/use-library-selector'
import { readLearningThinking, resetLearningThinking, subscribeLearningThinking, writeLearningThinking } from '../session/learning-thinking'
import { homeSuggestions } from '../showcase/content'
import { coverForId } from '../ui/covers'
import { HomeRecommendationFlow } from '../ui/HomeRecommendationFlow'
import { HomeLandscape } from '../ui/HomeLandscape'
import { PeakWordmark } from '../ui/PeakWordmark'
import { openConceptKnowledge, openKnowledge, openRoute } from '../workspace/nav'

const HOME_SELECT_ROUTE = 'threadpeak-home-select-route'

export function HomePage() {
  const initial = sessionStorage.getItem('threadpeak-home-prefill') ?? ''
  useEffect(() => { sessionStorage.removeItem('threadpeak-home-prefill'); if(sessionStorage.getItem(HOME_SELECT_ROUTE)){composerRef.current?.querySelector('textarea')?.focus();sessionStorage.removeItem(HOME_SELECT_ROUTE)} }, [])
  const [value, setValue] = useState(initial)
  const composerRef = useRef<HTMLDivElement>(null)
  const homeRef = useRef<HTMLElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const brand = brandRef.current, body = scrollRef.current
    if (!brand || !body) return
    const sync = () => {
      homeRef.current?.style.setProperty('--home-scroll', `${Math.max(0, body.scrollTop)}px`)
      brand.classList.toggle('is-collapsed', body.scrollTop >= 100)
    }
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || !event.deltaY) return
      event.preventDefault()
      body.scrollTop += event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? body.clientHeight : 1)
    }
    let touchY = 0
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0 }
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const y = event.touches[0].clientY
      event.preventDefault(); body.scrollTop += touchY - y; touchY = y
    }
    body.addEventListener('scroll', sync, { passive: true })
    brand.addEventListener('wheel', wheel, { passive: false })
    brand.addEventListener('touchstart', touchStart, { passive: true })
    brand.addEventListener('touchmove', touchMove, { passive: false })
    sync()
    return () => {
      body.removeEventListener('scroll', sync); brand.removeEventListener('wheel', wheel)
      brand.removeEventListener('touchstart', touchStart); brand.removeEventListener('touchmove', touchMove)
    }
  }, [])
  const materials = useMaterials()
  const [thinkingDepth, setThinkingDepth] = useState<'fast' | 'deep'>('fast')
  useEffect(() => { resetLearningThinking() }, [])
  useEffect(() => subscribeLearningThinking(() => setThinkingDepth(readLearningThinking())), [])
  const sending=useRef(false)
  const send = () => {
    const query = value.trim()
    if (!query || !materials.ready || sending.current) return
    sending.current=true
    try{
    writeLearningThinking(thinkingDepth)
    const conversationId = launchChat(query, 'route', materials.attachments, thinkingDepth)
    rememberPathSearchScope(`route-start:${conversationId}`, materials.searchScope)
    }catch(error){sending.current=false;materials.setError(error instanceof Error?error.message:'发送未完成，请重试。')}
  }
  const chooseSuggestion = (prompt: string) => {
    setValue(prompt)
    composerRef.current?.querySelector('textarea')?.focus()
  }
  // These selectors expose synchronous, explicitly curated examples, not provider requests.
  const exampleKnowledge = useLibrarySelector(selectRecommendedKnowledge)
  const exampleRoutes = useLibrarySelector(selectRecommendedRoutes)
  return <main className="home" data-page="home" ref={homeRef}>
    <div className="home-brand" ref={brandRef}>
      <HomeLandscape />
      <PeakWordmark />
    </div>
    <div className="home-body home-center" ref={scrollRef}>
      <div className="home-composer" ref={composerRef}>
        <Composer value={value} onChange={setValue} onSend={send} inputLabel="输入你的学习目标" sendDisabled={!materials.ready} thinkingDepth={thinkingDepth} onThinkingDepth={next => { writeLearningThinking(next); setThinkingDepth(next) }} onPickFiles={files => void materials.upload(files)} topContent={<MaterialChips model={materials} />} beforeAttachment={<MaterialScope model={materials} />} />
      </div>
      <Materials model={materials} />
      <div className="home-discovery">
        <section className="home-suggestions" aria-labelledby="home-suggestions-heading">
          <div className="home-section-heading">
            <h2 id="home-suggestions-heading">从你想完成的事开始</h2>
          </div>
          <div className="suggestion-marquee">
            <div className="suggestion-track">
              {[0, 1].map(copy => <div className="suggestion-group" aria-hidden={copy === 1} key={copy}>
                {homeSuggestions.map(suggestion => <button type="button" key={`${copy}-${suggestion.label}`} tabIndex={copy === 1 ? -1 : 0} onClick={() => chooseSuggestion(suggestion.prompt)}>{suggestion.label}</button>)}
              </div>)}
            </div>
          </div>
        </section>
        <section className="home-recommendations home-libraries" aria-labelledby="home-knowledge-heading">
          <div className="home-section-heading">
            <h2 id="home-knowledge-heading">看见知识怎样连起来</h2>
            <a href="#knowledge?tab=example" aria-label="查看全部示例知识脉络">查看全部 <Icon name="arrow-right" size={14} /></a>
          </div>
          <p className="home-curation-note">从具体概念看解释与来源，从真实目标看学习路线。</p>
          {exampleKnowledge.length > 0 ? <HomeRecommendationFlow label="知识脉络" action="展开知识脉络" items={exampleKnowledge.map(item => ({
            id: item.id, title: item.title, description: item.description, cover: coverForId(item.conceptId ?? item.id), meta: '示例知识脉络',
            open: () => { if (item.conceptId) openConceptKnowledge(item.id, item.conceptId); else openKnowledge(item.id, 'home'); location.hash = 'knowledge-detail' },
          }))} /> : <EmptyStatus kind="empty" headingLevel={3} title="暂无示例知识脉络" body="你可以先制定一条自己的路线，开始积累知识。" action="输入学习目标" onAction={() => composerRef.current?.querySelector('textarea')?.focus()} />}
        </section>
        <section className="home-recommendations home-routes" aria-labelledby="home-routes-heading">
          <div className="home-section-heading"><h2 id="home-routes-heading">看看不同目标，怎样走</h2><a href="#paths?tab=example" aria-label="查看全部示例路线">查看全部 <Icon name="arrow-right" size={14} /></a></div>
          {exampleRoutes.length > 0 ? <HomeRecommendationFlow label="路线" action="查看路线" items={exampleRoutes.map(item => ({
            id: item.id, title: item.title, description: item.outcome, cover: coverForId(item.id), meta: `${item.concepts} 个必要概念`,
            open: () => { openRoute(item.id, 'home'); location.hash = 'path-3d' },
          }))} /> : <EmptyStatus kind="empty" headingLevel={3} title="暂无示例路线" body="从你想完成的事开始，问山会据此组织学习路线。" action="输入学习目标" onAction={() => composerRef.current?.querySelector('textarea')?.focus()} />}
        </section>
      </div>
    </div>
  </main>
}
