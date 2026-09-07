import { ProcessTrace } from './ProcessTrace'
import { flowSteps, itemsToSteps, type ProcessFlowId, type ProcessStep } from '../process-trace'

export type AgentStatusItem = Readonly<{
  label:string
  detail?:string
  done?:boolean
}>

export function AgentStatus({
  items = [],
  steps,
  flow,
}: {
  items?: readonly AgentStatusItem[]
  steps?: readonly ProcessStep[]
  flow?: ProcessFlowId
}) {
  const resolved = steps?.length
    ? steps
    : flow
      ? flowSteps(flow)
      : itemsToSteps(items)
  return <div className="route-agent-status"><ProcessTrace steps={resolved}/></div>
}
