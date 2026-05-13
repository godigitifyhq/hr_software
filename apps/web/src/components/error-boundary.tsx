'use client'

import Link from 'next/link'
import { Component, ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('Application error boundary caught an error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">SVGOI</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The application hit an unexpected error. You can retry the page or return to the dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
