import type { ClarificationOption, ClarificationPrompt } from './contracts'

export type ClarificationHistoryItem = Readonly<{
  prompt: ClarificationPrompt
  option: ClarificationOption
}>

export type ClarificationCardProps = Readonly<{
  prompt: ClarificationPrompt
  history: readonly ClarificationHistoryItem[]
  selectedOptionId?: string
  pending: boolean
  onSelect: (optionId: string) => void
  onContinue: () => void
  onBack: () => void
  onRestart: () => void
}>

const optionLetters = ['A', 'B', 'C', 'D'] as const

export function ClarificationCard({
  prompt,
  history,
  selectedOptionId,
  pending,
  onSelect,
  onContinue,
  onBack,
  onRestart,
}: ClarificationCardProps) {
  const titleId = `clarification-${prompt.questionId}`

  return <section className="path-lab-clarification" aria-labelledby={titleId} aria-busy={pending}>
    <header>
      <span>目标校准</span>
      <b>第 {prompt.step} 题 · 共 {prompt.total} 题</b>
    </header>
    {history.length > 0 && <ol className="path-lab-clarification-history" aria-label="已完成的选择">
      {history.map((item) => <li key={item.prompt.questionId}>
        <span>{item.prompt.step}</span>
        <div><small>{item.prompt.question}</small><strong>{item.option.label}</strong></div>
      </li>)}
    </ol>}
    <fieldset disabled={pending}>
      <legend id={titleId}>{prompt.question}</legend>
      <div className="path-lab-clarification-options">
        {prompt.options.map((option, index) => <label key={option.id} data-selected={selectedOptionId === option.id}>
          <input
            type="radio"
            name={prompt.questionId}
            value={option.id}
            checked={selectedOptionId === option.id}
            onChange={() => onSelect(option.id)}
          />
          <i aria-hidden="true">{optionLetters[index]}</i>
          <span><strong>{option.label}</strong><small>{option.instruction}</small></span>
        </label>)}
      </div>
    </fieldset>
    <footer>
      <span>
        {history.length > 0 && <button type="button" onClick={onBack} disabled={pending}>返回上一题</button>}
        <button type="button" onClick={onRestart} disabled={pending}>修改目标</button>
      </span>
      <button
        type="button"
        className="path-lab-clarification-continue"
        onClick={onContinue}
        disabled={pending || !selectedOptionId}
      >
        {pending ? '正在继续…' : prompt.step === prompt.total ? '生成完整路径' : '下一题'}
      </button>
    </footer>
  </section>
}
