import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Une erreur est survenue
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {this.state.error?.message ?? 'Erreur inconnue'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Recharger
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
