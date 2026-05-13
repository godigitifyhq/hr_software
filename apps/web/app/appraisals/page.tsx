'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth'
import { formatDate } from '@/lib/date-utils'

interface Appraisal {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'HOD_REVIEW' | 'COMMITTEE_REVIEW' | 'HR_FINALIZED' | 'CLOSED'
  cycle?: { name: string }
  submittedAt?: string
  finalScore?: number
  finalPercent?: number
  createdAt: string
  updatedAt: string
}

export default function AppraisalsPage() {
  const router = useRouter()
  const { session, isHydrated } = useAuthStore()
  const [appraisals, setAppraisals] = useState<Appraisal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { session, isHydrated } = useAuthStore.getState();
    
    // Wait for hydration before checking authentication
    if (!isHydrated) {
      const unsubscribe = useAuthStore.subscribe(
        (state) => {
          if (state.isHydrated) {
            if (!state.session) {
              router.push('/login');
            } else {
              fetchAppraisals();
            }
            unsubscribe();
          }
        }
      );
      return;
    }
    
    // If already hydrated, check session immediately
    if (!session) {
      router.push('/login');
      return;
    }
    
    fetchAppraisals();
  }, [router])

  async function fetchAppraisals() {
    try {
      setLoading(true)
      setError(null)
      const { data } = await apiClient.get('/appraisals')
      setAppraisals(data.data || [])
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load appraisals'
      console.error('Appraisals fetch error:', {
        status: err?.response?.status,
        message,
        data: err?.response?.data
      })
      setError(message)
      setAppraisals([])
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = {
    DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
    SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
    HOD_REVIEW: { label: 'HOD Review', color: 'bg-yellow-100 text-yellow-700' },
    COMMITTEE_REVIEW: { label: 'Committee Review', color: 'bg-purple-100 text-purple-700' },
    HR_FINALIZED: { label: 'Finalized', color: 'bg-green-100 text-green-700' },
    CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-700' }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">My Appraisals</h1>
          </div>
          <button
            onClick={fetchAppraisals}
            disabled={loading}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
              <p className="text-sm text-slate-600">Loading appraisals…</p>
            </div>
          </div>
        ) : appraisals.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg
                className="h-6 w-6 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold">No appraisals yet</h3>
            <p className="mb-6 text-sm text-slate-600">
              Appraisals will appear here when created for your current appraisal cycle.
            </p>
            <button
              onClick={fetchAppraisals}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {appraisals.map((appraisal) => {
              const status = statusConfig[appraisal.status]
              return (
                <Link
                  key={appraisal.id}
                  href={`/appraisals/${appraisal.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {appraisal.cycle?.name || 'Appraisal Cycle'}
                        </h3>
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-slate-600">
                        <span>Created: {formatDate(appraisal.createdAt)}</span>
                        {appraisal.submittedAt && <span>Submitted: {formatDate(appraisal.submittedAt)}</span>}
                      </div>
                      {appraisal.finalScore !== undefined && appraisal.finalScore !== null && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-slate-900">
                            Final Score: <span className="font-semibold">{appraisal.finalScore.toFixed(2)}</span>
                            {appraisal.finalPercent !== undefined && (
                              <span className="ml-2 text-slate-600">
                                ({appraisal.finalPercent.toFixed(1)}%)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <svg
                        className="h-5 w-5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
