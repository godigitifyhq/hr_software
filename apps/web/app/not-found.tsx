import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16 text-slate-900">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">SVGOI</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">404 - Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The page you requested does not exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Back to Home
          </Link>
          <Link
            href="/appraisals"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            My Appraisals
          </Link>
        </div>
      </div>
    </div>
  )
}
