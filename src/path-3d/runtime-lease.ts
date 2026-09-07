/** Owns one asynchronous renderer attempt; late completions cannot revive it. */
export function createRuntimeLease<T extends { dispose(): void }>() {
  const controller = new AbortController()
  let current: T | undefined
  return {
    signal: controller.signal,
    get current() { return current },
    attach(instance: T): boolean {
      if (controller.signal.aborted) { instance.dispose(); return false }
      current = instance
      return true
    },
    dispose() {
      if (controller.signal.aborted) return
      controller.abort()
      const instance = current
      current = undefined
      instance?.dispose()
    },
  }
}
