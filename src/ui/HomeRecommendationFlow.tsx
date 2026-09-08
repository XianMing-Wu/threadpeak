import { useLayoutEffect, useRef, useState } from 'react'
import { CoverFlow } from '../vendor/coverflow/Coverflow'
import { Icon } from '../icons'
import { coverSrcSet } from './covers'
import './home-recommendation-flow.css'

type Recommendation = { id: string; title: string; description: string; cover: string; meta: string; open: () => void }

/** Reuse the discovered-author carousel's actual perspective, drag and shadow. */
export function HomeRecommendationFlow({ items, label, action }: { items: Recommendation[]; label: string; action: string }) {
  const [selectedId, setSelectedId] = useState(items[Math.floor((items.length - 1) / 2)]?.id)
  const host = useRef<HTMLDivElement>(null)
  const index = Math.max(0, items.findIndex(item => item.id === selectedId))
  const active = items[index]
  useLayoutEffect(() => {
    // The vendored component defaults to an author-specific accessible name.
    const region = host.current?.querySelector('.cf-root')
    region?.setAttribute('aria-label', `${label}卡片轮播：${active?.title ?? ''}。左右键切换，Enter ${action}`)
  }, [label, action, active?.title, items.length])
  if (!active) return null
  return <div className="home-coverflow" ref={host}>
    <div className="home-coverflow-stage">
      <CoverFlow items={items.map((item, i) => ({ id: item.id, image: String(i), title: item.title }))}
        index={index} onIndexChange={i => setSelectedId(items[i].id)}
        itemWidth={270} itemHeight={310} centerGap={215} stackSpacing={72} rotation={50}
        enableReflection enableScroll enableAudio={false} onItemClick={(_, i) => items[i].open()}
        renderImage={props => {
          const item = items[Number(props.src)]
          return <div className="home-flow-card" aria-hidden="true">
            <img src={item.cover} srcSet={coverSrcSet(item.cover)} sizes="96px" alt="" draggable={false} width={96} height={96} loading="lazy" />
            <strong>{item.title}</strong><small>{item.meta}</small><p>{item.description}</p>
            <span className="home-flow-open">{action}<Icon name="arrow-right" size={16} /></span>
          </div>
        }} />
    </div>
  </div>
}
