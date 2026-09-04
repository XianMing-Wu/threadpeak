import { Icon } from '../icons'
import { StatusOrbChip } from './StatusOrb'

export type AgentStatusItem = Readonly<{
  label:string
  detail?:string
  done?:boolean
}>

export function AgentStatus({items}:{items:readonly AgentStatusItem[]}) {
  return <div className="route-agent-status" role="status" aria-live="polite">{items.map((status)=><div key={status.label}>{status.done?<div className="route-agent-status-row"><span className="route-agent-status-bullet"><Icon name="check" size={13}/></span><span className="is-done">{status.label}</span></div>:<StatusOrbChip label={status.label}/>}</div>)}</div>
}
