'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth'
import { formatDate, formatDateTime } from '@/lib/date-utils'

interface AppraisalItem {
  id: string
  key: string
  description?: string
  points: number
  weight: number
  notes?: string
}

interface AppraisalCycle {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  departmentId?: string
}

interface AppraisalDetail {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'HOD_REVIEW' | 'COMMITTEE_REVIEW' | 'HR_FINALIZED' | 'CLOSED'
  cycle: AppraisalCycle
  user: User
  items: AppraisalItem[]
  submittedAt?: string
  finalScore?: number
  finalPercent?: number
  hodRemarks?: string
  committeeNotes?: string
  locked: boolean
  createdAt: string
  updatedAt: string
}

export default function AppraisalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const appraisalId = params?.id as string
  const { session, isHydrated } = useAuthStore()
  const [appraisal, setAppraisal] = useState<AppraisalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hodSaving, setHodSaving] = useState(false)
  const [committeeSaving, setCommitteeSaving] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [committeeNotesDraft, setCommitteeNotesDraft] = useState('')
  const [hodMetrics, setHodMetrics] = useState({
    academicsAveragePercent: '',
    scopusPaperCount: '',
    impactFactor: '',
    hodRemarksPoints: '',
    memoIssues: '',
    remarks: ''
  })

  useEffect(() => {
    setCommitteeNotesDraft(appraisal?.committeeNotes || '')
  }, [appraisal?.committeeNotes])

  useEffect(() => {
    const { session, isHydrated } = useAuthStore.getState();
    
    if (!isHydrated) {
      const unsubscribe = useAuthStore.subscribe(
        (state) => {
          if (state.isHydrated) {
            if (!state.session) {
              router.push('/login');
            } else {
              fetchAppraisal();
            }
            unsubscribe();
          }
        }
      );
      return;
    }
    
    if (!session) {
      router.push('/login');
      return;
    }
    
    fetchAppraisal();
  }, [router, appraisalId])

  async function fetchAppraisal() {
    try {
      setLoading(true)
      setError(null)
      const { data } = await apiClient.get(`/appraisals/${appraisalId}`)
      setAppraisal(data.data)
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load appraisal'
      console.error('Appraisal fetch error:', {
        status: err?.response?.status,
        message,
        data: err?.response?.data
      })
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = {
    DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: '✏️' },
    SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: '✓' },
    HOD_REVIEW: { label: 'HOD Review', color: 'bg-yellow-100 text-yellow-700', icon: '👁️' },
    COMMITTEE_REVIEW: { label: 'Committee Review', color: 'bg-purple-100 text-purple-700', icon: '👥' },
    HR_FINALIZED: { label: 'Finalized', color: 'bg-green-100 text-green-700', icon: '✓✓' },
    CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: '🔒' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link href="/appraisals" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Appraisals
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
              <p className="text-sm text-slate-600">Loading appraisal…</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !appraisal) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <Link href="/appraisals" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Appraisals
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-medium text-red-800">{error || 'Appraisal not found'}</p>
            <button
              onClick={() => router.push('/appraisals')}
              className="mt-4 rounded-full bg-red-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Back to Appraisals
            </button>
          </div>
        </main>
      </div>
    )
  }

  const status = statusConfig[appraisal.status]
  const canEdit = appraisal.status === 'DRAFT' && !appraisal.locked && appraisal.user.id === session?.user.id
  const canSubmit = canEdit && appraisal.items.length > 0
  const canHodScore = Boolean(
    (session?.user.roles.includes('HOD') || session?.user.roles.includes('HR') || session?.user.roles.includes('SUPER_ADMIN')) &&
      appraisal.status === 'SUBMITTED' &&
      !appraisal.locked
  )
  const canCommitteeReview = Boolean(
    (session?.user.roles.includes('COMMITTEE') || session?.user.roles.includes('HR') || session?.user.roles.includes('SUPER_ADMIN')) &&
      ['HOD_REVIEW', 'COMMITTEE_REVIEW'].includes(appraisal.status)
  )

  async function handleSubmit() {
    if (!canSubmit) {
      return
    }

    const confirmed = window.confirm('Submit this appraisal now? You will not be able to edit it after submission.')
    if (!confirmed) {
      return
    }

    try {
      setSubmitting(true)
      await apiClient.post(`/appraisals/${appraisalId}/submit`)
      router.push('/appraisals')
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to submit appraisal'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  function parseMetricValue(value: string) {
    if (value.trim() === '') {
      return undefined
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  async function handleHodScore() {
    try {
      setHodSaving(true)
      setError(null)
      setActionNotice(null)

      const payload = {
        metrics: {
          academicsAveragePercent: parseMetricValue(hodMetrics.academicsAveragePercent),
          scopusPaperCount: parseMetricValue(hodMetrics.scopusPaperCount),
          impactFactor: parseMetricValue(hodMetrics.impactFactor),
          hodRemarksPoints: parseMetricValue(hodMetrics.hodRemarksPoints),
          memoIssues: parseMetricValue(hodMetrics.memoIssues)
        },
        remarks: hodMetrics.remarks.trim() || undefined
      }

      const { data } = await apiClient.post(`/hod/appraisals/${appraisalId}/score`, payload)
      const updatedAppraisal = data?.data?.appraisal ?? data?.data
      if (updatedAppraisal) {
        setAppraisal(updatedAppraisal)
      }
      setActionNotice('HOD score saved successfully.')
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to save HOD score'
      setError(message)
    } finally {
      setHodSaving(false)
    }
  }

  async function handleCommitteeReview() {
    if (!committeeNotesDraft.trim()) {
      setError('Committee notes are required before finalizing the review.')
      return
    }

    try {
      setCommitteeSaving(true)
      setError(null)
      setActionNotice(null)

      const { data } = await apiClient.post(`/appraisals/${appraisalId}/committee-review`, {
        notes: committeeNotesDraft.trim()
      })

      if (data?.data) {
        setAppraisal(data.data)
      }
      setActionNotice('Committee review saved and finalized.')
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to save committee review'
      setError(message)
    } finally {
      setCommitteeSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <Link href="/appraisals" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to Appraisals
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{appraisal.cycle.name}</h1>
          </div>
          <span className={`inline-block rounded-full px-4 py-2 text-sm font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* User Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Appraisal Details</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-600">Appraisee</p>
              <p className="text-lg font-medium text-slate-900">
                {appraisal.user.firstName} {appraisal.user.lastName}
              </p>
              <p className="text-sm text-slate-600">{appraisal.user.email}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Appraisal Cycle</p>
              <p className="text-lg font-medium text-slate-900">{appraisal.cycle.name}</p>
              <p className="text-sm text-slate-600">
                {formatDate(appraisal.cycle.startDate)} - {formatDate(appraisal.cycle.endDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Created</p>
              <p className="text-lg font-medium text-slate-900">{formatDateTime(appraisal.createdAt)}</p>
            </div>
            {appraisal.submittedAt && (
              <div>
                <p className="text-sm text-slate-600">Submitted</p>
                <p className="text-lg font-medium text-slate-900">{formatDateTime(appraisal.submittedAt)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Final Score */}
        {appraisal.finalScore !== undefined && appraisal.finalScore !== null && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-green-900">Final Score</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm text-green-700">Score</p>
                <p className="text-3xl font-bold text-green-900">{appraisal.finalScore.toFixed(2)}</p>
              </div>
              {appraisal.finalPercent !== undefined && (
                <div>
                  <p className="text-sm text-green-700">Percentage</p>
                  <p className="text-3xl font-bold text-green-900">{appraisal.finalPercent.toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remarks */}
        {appraisal.hodRemarks && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
            <h2 className="text-lg font-semibold mb-2">HOD Remarks</h2>
            <p className="text-slate-700">{appraisal.hodRemarks}</p>
          </div>
        )}

        {appraisal.committeeNotes && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
            <h2 className="text-lg font-semibold mb-2">Committee Notes</h2>
            <p className="text-slate-700">{appraisal.committeeNotes}</p>
          </div>
        )}

        {actionNotice && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {actionNotice}
          </div>
        )}

        {canHodScore && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-sky-950">HOD Score</h2>
              <p className="text-sm text-sky-800">
                Enter the review metrics used for the HOD scoring calculation. Unused fields default to zero.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-sky-900">Academics average %</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hodMetrics.academicsAveragePercent}
                  onChange={event => setHodMetrics(current => ({ ...current, academicsAveragePercent: event.target.value }))}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-sky-900">Scopus papers</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={hodMetrics.scopusPaperCount}
                  onChange={event => setHodMetrics(current => ({ ...current, scopusPaperCount: event.target.value }))}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-sky-900">Impact factor</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hodMetrics.impactFactor}
                  onChange={event => setHodMetrics(current => ({ ...current, impactFactor: event.target.value }))}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-sky-900">HOD remarks points</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={hodMetrics.hodRemarksPoints}
                  onChange={event => setHodMetrics(current => ({ ...current, hodRemarksPoints: event.target.value }))}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-sky-900">Memo issues</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={hodMetrics.memoIssues}
                  onChange={event => setHodMetrics(current => ({ ...current, memoIssues: event.target.value }))}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-sky-900">Remarks</span>
                <textarea
                  rows={3}
                  value={hodMetrics.remarks}
                  onChange={event => setHodMetrics(current => ({ ...current, remarks: event.target.value }))}
                  className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
                  placeholder="Optional HOD review remarks"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleHodScore}
                disabled={hodSaving}
                className="rounded-full bg-sky-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:opacity-60"
              >
                {hodSaving ? 'Saving score…' : 'Save HOD Score'}
              </button>
            </div>
          </div>
        )}

        {canCommitteeReview && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-violet-950">Committee Review</h2>
              <p className="text-sm text-violet-800">
                Add committee notes and finalize the appraisal for HR.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-violet-900">Committee notes</span>
              <textarea
                rows={4}
                value={committeeNotesDraft}
                onChange={event => setCommitteeNotesDraft(event.target.value)}
                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-violet-500"
                placeholder="Summarize the committee review and decision"
              />
            </label>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleCommitteeReview}
                disabled={committeeSaving}
                className="rounded-full bg-violet-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-60"
              >
                {committeeSaving ? 'Saving review…' : 'Approve and Finalize'}
              </button>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Appraisal Items</h2>
          {appraisal.items.length === 0 ? (
            <p className="text-slate-600">No items in this appraisal</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Key</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Description</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900">Points</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900">Weight</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {appraisal.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.key}</td>
                      <td className="px-4 py-3 text-slate-700">{item.description || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{item.points.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{item.weight.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-600">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/appraisals"
            className="rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
          >
            Back to Appraisals
          </Link>
          {canEdit && (
            <Link
              href={`/appraisals/${appraisal.id}/edit`}
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Edit Draft
            </Link>
          )}
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-sky-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Appraisal'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
