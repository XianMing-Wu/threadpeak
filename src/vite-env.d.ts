declare module 'react-markdown' {
  import type { ComponentType, ReactNode } from 'react'
  const ReactMarkdown: ComponentType<{ children?: string; remarkPlugins?: unknown[] }>
  export default ReactMarkdown
  export const Markdown: typeof ReactMarkdown
}

declare module '*.svg?url' { const url:string; export default url }
declare module '*.svg?raw' { const markup:string; export default markup }
declare module '*.js?url' { const url:string; export default url }
declare module '*?url' { const url:string; export default url }
declare module '*.css'

declare module 'wine-timeline/timeline-engine.js' {
  export function parseTimelineJSON(source: unknown): TimelineData
  export function validateTimeline(raw: unknown): TimelineData
  export class WineTimeline {
    constructor(root: Element)
    setData(raw: unknown): WineTimeline
    setJSON(source: string): WineTimeline
    destroy(): void
    static parseJSON(source: unknown): TimelineData
    static validate(raw: unknown): TimelineData
  }
  export type TimelineData = {
    title: string
    titleZh: string
    lead: string
    leadZh: string
    minYear: number
    maxYear: number
    defaultYear: number
    image: { src: string; alt: string; caption: string; captionZh: string }
    events: Array<{ year: number; title: string; titleZh: string; lead: string; leadZh: string; caption: string; captionZh: string; row: number }>
  }
}

declare module 'sunburst-chart/sunburst/Sunburst.jsx' {
  import type { ReactNode } from 'react'
  export function Sunburst(props: {
    data: { id: string; text: string; stance: 'thesis' | 'pro' | 'con'; impact?: number; children?: unknown[] }
    selectedId: string
    onSelect: (id: string) => void
    callout?: ReactNode
  }): import('react').ReactElement
}

declare module 'sunburst-chart/sunburst/index.js' {
  export { Sunburst } from 'sunburst-chart/sunburst/Sunburst.jsx'
  export function stanceLabel(stance: string): string
}

declare module 'sunburst-chart/sunburst/colors.js' {
  export function stanceLabel(stance: string): string
}

declare module 'sunburst-chart/data/discussion.js' {
  export const discussion: import('./visuals/types').SunburstJSON
  export function findClaim(node: import('./visuals/types').SunburstJSON, id: string): import('./visuals/types').SunburstJSON | null
}

declare module 'organic-mindmap/mindmap.json' {
  const data: unknown
  export default data
}

declare module 'organic-mindmap/organic-json-diagnostics.js?url' { const url: string; export default url }
declare module 'organic-mindmap/organic-mindmap.js?url' { const url: string; export default url }
declare module 'wine-timeline/timeline.json' {
  const data: import('./visuals/types').TimelineJSON
  export default data
}
