'use client'

import Link from 'next/link'

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16 text-slate-900">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">SVGOI</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">500 - Server error</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The page could not be rendered because the app encountered an unexpected error.
        </p>
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error.message || 'Unexpected application error'}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={() => reset()}
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
