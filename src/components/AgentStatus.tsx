import { Icon } from '../icons'

export type AgentStatusItem = Readonly<{
  label:string
  detail?:string
  done?:boolean
}>

export function AgentStatus({items}:{items:readonly AgentStatusItem[]}) {
  return <div className="route-agent-status" role="status" aria-live="polite">{items.map((status)=><div key={status.label}><div className="route-agent-status-row"><span className="route-agent-status-bullet">{status.done?<Icon name="check" size={13}/>:<i/>}</span><span className={status.done?'is-done':'is-active'}>{status.label}</span></div>{!status.done&&status.detail&&<p>{status.detail}</p>}</div>)}</div>
}
