import type { PropsWithChildren, ReactNode } from 'react'
import { Component } from 'react'
import { ErrorLayout } from '../layouts/ErrorLayout'

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<
  PropsWithChildren,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorLayout
          title="Application error"
          description="Something unexpected happened while rendering the admin portal."
        />
      )
    }

    return this.props.children
  }
}
