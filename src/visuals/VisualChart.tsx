import { OrganicMindMapView } from './OrganicMindMapView'
import { SunburstView } from './SunburstView'
import { TimelineView } from './TimelineView'
import type { SunburstJSON, VisualSpec } from './types'

export function VisualChart({ spec }: { spec: VisualSpec }) {
  if (spec.kind === 'mindmap') return <OrganicMindMapView data={spec.data} />
  if (spec.kind === 'sunburst') return <SunburstView data={spec.data as SunburstJSON} />
  return <TimelineView data={spec.data} />
}
