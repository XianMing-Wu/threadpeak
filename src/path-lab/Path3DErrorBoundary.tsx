import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = Readonly<{
  children: ReactNode
  resetKey: string
}>

type State = Readonly<{ failed: boolean }>

export class Path3DErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The public test surface deliberately does not echo raw chunk/runtime errors.
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return <div className="path-lab-runtime-load-error" role="alert">
        <strong>3D 运行时加载失败</strong>
        <span>输入与质量报告仍然保留；请刷新页面后重试。</span>
      </div>
    }
    return this.props.children
  }
}
