export type VisualKind = 'mindmap' | 'sunburst' | 'timeline'

export type VisualSpec = {
  kind: VisualKind
  title: string
  caption: string
  focus: string
  data: unknown
}

export type MindmapJSON = {
  root: { title: string; subtitle?: string; description?: string }
  branches: Array<{
    id?: string
    title: string
    color?: string
    side?: 'left' | 'right' | 'auto'
    detail?: string
    children?: unknown[]
  }>
}

export type SunburstJSON = {
  id: string
  text: string
  stance: 'thesis' | 'pro' | 'con'
  impact?: number
  children?: SunburstJSON[]
}

export type TimelineJSON = {
  title: string
  titleZh: string
  lead?: string
  leadZh?: string
  range?: { minYear: number; maxYear: number }
  defaultYear?: number
  image?: { src?: string; alt?: string; caption?: string; captionZh?: string }
  events: Array<{
    year: number
    title: string
    titleZh: string
    lead?: string
    leadZh?: string
    row?: number
  }>
}
