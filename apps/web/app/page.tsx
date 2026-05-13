 'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth'

export default function Home() {
  const router = useRouter()
  const { session, isHydrated } = useAuthStore()

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Ignore network failures and clear local state below.
    } finally {
      useAuthStore.getState().logout()
      router.push('/login')
    }
  }

  // Show nothing while hydrating to avoid flashing unauthenticated UI
  if (!isHydrated) {
    return null
  }

  if (session) {
    const isSuperAdmin = session.user.roles.includes('SUPER_ADMIN')

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">SVGOI</p>
              <h1 className="text-2xl font-semibold tracking-tight">Appraisal System</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                {session.user.firstName} {session.user.lastName}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <Link
              href="/appraisals"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold">My Appraisals</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">View and manage your appraisal submissions.</p>
            </Link>

            {(isSuperAdmin || session.user.roles.includes('HOD')) && (
              <Link
                href="/hod-review"
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold">HOD Review</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Review and score department appraisals.</p>
              </Link>
            )}

            {(isSuperAdmin || session.user.roles.includes('COMMITTEE')) && (
              <Link
                href="/committee-review"
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold">Committee Review</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Review assigned appraisals.</p>
              </Link>
            )}

            {(isSuperAdmin || session.user.roles.includes('HR')) && (
              <Link
                href="/hr-dashboard"
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold">HR Dashboard</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Finalize and export appraisal results.</p>
              </Link>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-700">SVGOI</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Appraisal System</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enterprise appraisal management for SVGOI faculty, employees, HOD review, and finalization.
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/login"
            className="block w-full rounded-full bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="block w-full rounded-full border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  )
}
