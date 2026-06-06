import { Component } from "react"
import type { ReactNode } from "react"

interface Props {
  name: string
  children: ReactNode
  /** When this changes, clear the error and retry — auto-recovers from transient
   *  streaming-reshape crashes (assistant-ui index races). */
  resetKey?: unknown
  /** Render nothing instead of the red box for noisy transient crashes. */
  silent?: boolean
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary:" + this.props.name + "]", error.message, error.stack, info)
  }

  render() {
    if (this.state.error) {
      if (this.props.silent) return null
      return (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <b>Error in {this.props.name}:</b> {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
