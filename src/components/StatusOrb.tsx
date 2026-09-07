import { ProcessTrace } from './ProcessTrace'
import { agentStep, flowSteps, type ProcessFlowId } from '../process-trace'
import './status-orb.css'

export { ProcessTrace, PonderMark } from './ProcessTrace'
export {
  flowSteps,
  agentStep,
  thinkStep,
  searchStep,
  retrieveStep,
} from '../process-trace'
export type { ProcessStep, ProcessFlowId } from '../process-trace'

export function StatusOrbChip({
  label,
  flow,
}: {
  label: string
  flow?: ProcessFlowId
  paused?: boolean
}) {
  const steps = flow
    ? flowSteps(flow)
    : [agentStep('current', label.replace(/^正在/, '').replace(/…$/, ''))]
  return (
    <span className="tp-status-orb-chip">
      <ProcessTrace steps={steps} />
    </span>
  )
}
