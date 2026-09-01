import { useEffect, useMemo, useState } from 'react'
import { findClaim } from 'sunburst-chart/data/discussion.js'
import { Sunburst, stanceLabel } from 'sunburst-chart/sunburst/index.js'
import type { SunburstJSON } from './types'

export function SunburstView({ data }: { data: SunburstJSON }) {
  const [selectedId, setSelectedId] = useState(data.id)
  useEffect(() => { setSelectedId(data.id) }, [data.id])
  const selected = useMemo(() => findClaim(data, selectedId) ?? data, [data, selectedId])
  return (
    <div className="visual-chart visual-sunburst">
      <Sunburst
        data={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        callout={
          <>
            <span className={`callout__stance callout__stance--${selected.stance}`}>{stanceLabel(selected.stance)}</span>
            {selected.text}
          </>
        }
      />
    </div>
  )
}
