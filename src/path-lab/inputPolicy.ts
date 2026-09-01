export type GoalSubmitKey = Readonly<{
  key: string
  shiftKey: boolean
  isComposing: boolean
  keyCode?: number
}>

/**
 * Keep goal submission independent from React so the IME boundary is executable
 * in the fast Node test suite. keyCode 229 covers Safari/WebKit composition
 * events that may report isComposing=false while an IME candidate is settling.
 */
export function shouldSubmitGoalFromKey(event: GoalSubmitKey): boolean {
  return event.key === 'Enter'
    && !event.shiftKey
    && !event.isComposing
    && event.keyCode !== 229
}
