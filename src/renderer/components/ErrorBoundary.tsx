import * as React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Where the boundary sits — shown in the logs to locate the failure */
  scope?: string
  /** When this value changes, a previous error is cleared automatically */
  resetKey?: string | number
  /** 'screen' renders inside the layout; 'app' fills the window */
  variant?: 'screen' | 'app'
}

interface ErrorBoundaryState {
  error: Error | null
}

// Error boundaries can only be class components (React has no hook equivalent).
// This is a safety net: a render exception shows a friendly message instead of
// unmounting the whole app into a white screen. It does not replace fixing the cause.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.scope ?? 'unknown'}]`, error, info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    // Deliberately not using the i18n hook: the boundary may sit outside the provider
    // and must keep working even if translations are what broke.
    const isApp = this.props.variant === 'app'
    return (
      <div
        role="alert"
        className={
          isApp
            ? 'flex h-screen w-screen items-center justify-center bg-background p-6'
            : 'flex items-center justify-center p-6'
        }
      >
        <div className="max-w-md rounded-2xl border border-danger/25 bg-card p-6 text-center text-card-foreground shadow-card">
          <AlertTriangle className="mx-auto h-10 w-10 text-danger" />
          <h2 className="mt-3 text-lg font-bold text-foreground">حدث خطأ غير متوقع / Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            بياناتك محفوظة ولم تتأثر. اضغط «إعادة المحاولة» للمتابعة.
            <br />
            Your data is safe. Press “Retry” to continue.
          </p>
          <p
            className="mt-3 break-words rounded-lg bg-muted p-2 text-start text-[11px] text-muted-foreground"
            dir="ltr"
          >
            {error.message}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
          >
            <RotateCcw className="h-4 w-4" />
            إعادة المحاولة / Retry
          </button>
        </div>
      </div>
    )
  }
}
