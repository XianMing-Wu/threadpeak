import mindmapData from 'organic-mindmap/mindmap.json'
import { discussion } from 'sunburst-chart/data/discussion.js'
import teaTimeline from 'wine-timeline/timeline.json'
import type { VisualKind, VisualSpec } from './types'

export function mindmapJSON() {
  return mindmapData
}

export function sunburstJSON() {
  return discussion
}

export function timelineJSON() {
  const data = teaTimeline
  return { ...data, image: { ...data.image, src: '' } }
}

function kindByQuery(_query: string): VisualKind[] {
  return ['mindmap', 'sunburst', 'timeline']
}

const catalog: Record<VisualKind, { title: string; caption: string; focus: string; data: () => unknown }> = {
  mindmap: {
    title: '概念如何从中心长出来',
    caption: '有机彩线思维导图，数据与交互来自原项目。',
    focus: '对象、关系与检验',
    data: mindmapJSON,
  },
  sunburst: {
    title: '主张如何一层层展开',
    caption: '径向论辩图，数据与聚焦逻辑来自原项目。',
    focus: '层次与立场',
    data: sunburstJSON,
  },
  timeline: {
    title: '理解沿时间线推进',
    caption: '可拖动的历史时间线，事件列表来自原项目。',
    focus: '先后检查点',
    data: timelineJSON,
  },
}

export function buildVisualFrames(query: string): VisualSpec[] {
  return kindByQuery(query).map((kind) => {
    const item = catalog[kind]
    return { kind, title: item.title, caption: item.caption, focus: item.focus, data: item.data() }
  })
}

export function visualKindName(kind: VisualKind) {
  return kind === 'mindmap' ? '思维导图' : kind === 'sunburst' ? '径向结构' : '时间线'
}
