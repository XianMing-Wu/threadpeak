export type ProcessStepKind = 'agent' | 'search' | 'retrieve' | 'think' | 'confirm'
export type ProcessStepStatus = 'running' | 'done' | 'failed' | 'stopped'

export type ProcessStep = {
  id: string
  kind: ProcessStepKind
  status: ProcessStepStatus
  title?: string
  extra?: string
  thought?: string
}

export type ProcessFlowId =
  | 'path-start'
  | 'ordinary'
  | 'first-entry'
  | 'lesson-read'
  | 'follow-up'
  | 'ask-author'
  | 'author-search'
  | 'author-network'
  | 'path3d'
  | 'knowledge-read'
  | 'annotation'

export function agentStep(
  id: string,
  title: string,
  extra?: string,
  status: ProcessStepStatus = 'running',
): ProcessStep {
  return { id, kind: 'agent', title, extra, status }
}

export function searchStep(
  id: string,
  extra: string,
  status: ProcessStepStatus = 'running',
  title = '检索知乎',
): ProcessStep {
  return { id, kind: 'search', title, extra, status }
}

export function retrieveStep(
  id: string,
  title: string,
  extra?: string,
  status: ProcessStepStatus = 'running',
): ProcessStep {
  return { id, kind: 'retrieve', title, extra, status }
}

export function thinkStep(
  id: string,
  status: ProcessStepStatus = 'running',
  thought = '',
): ProcessStep {
  return { id, kind: 'think', thought, status }
}

export function thoughtForDisplay(text: string): string {
  const withoutFences = text.replace(/```(?:json)?\s*[\s\S]*?```/gi, '\n')
  let result = ''
  let depth = 0
  let start = -1
  for (let i = 0; i < withoutFences.length; i++) {
    const ch = withoutFences[i]
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (ch === '}') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start >= 0) {
        const slice = withoutFences.slice(start, i + 1)
        try {
          const value = JSON.parse(slice) as unknown
          if (value && typeof value === 'object') {
            start = -1
            continue
          }
        } catch {
          result += slice
        }
        start = -1
      }
      continue
    }
    if (depth === 0) result += ch
  }
  const readable = result
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (/^[{}\[\].,]+$/.test(trimmed)) return false
      if (/^"[^"]+"\s*:/.test(trimmed)) return false
      if (/^(fromConceptId|toConceptId|fromCarrierId|toCarrierId)\b/.test(trimmed)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const letters = readable.replace(/[{}\[\]",:_\-0-9a-fA-F\s]/g, '')
  return letters.length < 4 ? '' : readable
}

export function confirmStep(id: string, label: string): ProcessStep {
  return { id, kind: 'confirm', status: 'done', title: `已确认：${label}` }
}

export function pillTitle(step: ProcessStep): string {
  if (step.kind === 'think') {
    if (step.status === 'running') return '思考中'
    if (step.status === 'failed') return '思考未完成'
    if (step.status === 'stopped') return '已停止思考'
    return '思考完成'
  }
  if (step.title?.trim()) return step.title
  if (step.kind === 'search') return '检索知乎'
  if (step.kind === 'retrieve') return step.status === 'done' ? '已读取' : '正在读取'
  return step.status === 'done' ? '已完成' : '进行中'
}

export function flowSteps(flow: ProcessFlowId): ProcessStep[] {
  switch (flow) {
    case 'path-start':
      return [agentStep('r1', '拆成检索问题')]
    case 'ordinary':
      return [agentStep('r5', '组织回答')]
    case 'first-entry':
      return []
    case 'lesson-read':
      return [retrieveStep('l0-read', '读取第一段讲解')]
    case 'follow-up':
      return [
        agentStep('g1', '判断脉络位置'),
        agentStep('g2', '组织这次追问'),
      ]
    case 'ask-author':
      return [
        agentStep('a1', '整理问法'),
        searchStep('as', '相关作者'),
        agentStep('a2', '筛选作者'),
        agentStep('a3', '组织作者解答'),
      ]
    case 'author-search':
      return [
        agentStep('n1', '整理作者线索'),
        searchStep('ns', '相关博主'),
        agentStep('n2', '挑选博主'),
      ]
    case 'author-network':
      return [retrieveStep('n0', '读取博主网络')]
    case 'path3d':
      return [retrieveStep('p3d', '召唤刘看山')]
    case 'knowledge-read':
      return [retrieveStep('kg', '读取知识脉络')]
    case 'annotation':
      return [
        agentStep('a1', '整理问法'),
        searchStep('as', '相关作者'),
        agentStep('a2', '筛选作者'),
        agentStep('a3', '组织解答'),
      ]
  }
}

export function uniqueTrace(steps: readonly ProcessStep[]): ProcessStep[] {
  const latest = new Map<string, ProcessStep>()
  const order: string[] = []
  for (const step of steps) {
    if (!latest.has(step.id)) order.push(step.id)
    latest.set(step.id, step)
  }
  return order.map((id) => latest.get(id)!).filter(Boolean)
}

export function asProcessSteps(value: unknown): ProcessStep[] | undefined {
  if (!Array.isArray(value)) return undefined
  const steps: ProcessStep[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id) continue
    if (record.kind !== 'agent' && record.kind !== 'search' && record.kind !== 'retrieve' && record.kind !== 'think' && record.kind !== 'confirm') continue
    if (record.status !== 'running' && record.status !== 'done' && record.status !== 'failed' && record.status !== 'stopped') continue
    steps.push({
      id: record.id,
      kind: record.kind,
      status: record.status,
      ...(typeof record.title === 'string' ? { title: record.title } : {}),
      ...(typeof record.extra === 'string' ? { extra: record.extra } : {}),
      ...(typeof record.thought === 'string' ? { thought: record.thought } : {}),
    })
  }
  return uniqueTrace(steps)
}

export function settleTrace(steps: readonly ProcessStep[], status: 'done' | 'failed' | 'stopped' = 'done'): ProcessStep[] {
  return steps.map((step) => {
    if (step.status !== 'running') return { ...step }
    if (status === 'failed' && step.kind === 'think' && step.thought?.trim()) {
      return { ...step, status: 'done' }
    }
    return { ...step, status }
  })
}

export function applyReasoning(steps: readonly ProcessStep[], thinkId: string, thought: string): ProcessStep[] {
  const next = steps.map((step) => ({ ...step }))
  const existing = next.find((step) => step.id === thinkId)
  if (existing) {
    existing.kind = 'think'
    existing.status = 'running'
    existing.thought = thought
    return next
  }
  const agentId = thinkId.replace(/-think$/, '')
  const index = next.findIndex((step) => step.id === agentId)
  const inserted = thinkStep(thinkId, 'running', thought)
  if (index >= 0) {
    next.splice(index + 1, 0, inserted)
    return next
  }
  next.push(inserted)
  return next
}

export function itemsToSteps(items: readonly { label: string; detail?: string; done?: boolean }[]): ProcessStep[] {
  return items.map((item, index) => agentStep(
    `item-${index}-${item.label}`,
    item.label.replace(/^正在/, ''),
    item.detail?.trim() || undefined,
    item.done ? 'done' : 'running',
  ))
}
