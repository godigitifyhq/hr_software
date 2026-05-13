'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth'

interface AppraisalItem {
  id?: string
  key: string
  points: number
  weight: number
  notes?: string
}

interface AppraisalDetail {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'HOD_REVIEW' | 'COMMITTEE_REVIEW' | 'HR_FINALIZED' | 'CLOSED'
  locked: boolean
  user: { id: string; firstName: string; lastName: string; email: string }
  cycle: { name: string }
  items: AppraisalItem[]
}

export default function AppraisalEditPage() {
  const router = useRouter()
  const params = useParams()
  const appraisalId = params?.id as string
  const { session, isHydrated } = useAuthStore()
  const [appraisal, setAppraisal] = useState<AppraisalDetail | null>(null)
  const [items, setItems] = useState<AppraisalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { session, isHydrated } = useAuthStore.getState()

    if (!isHydrated) {
      const unsubscribe = useAuthStore.subscribe(state => {
        if (state.isHydrated) {
          if (!state.session) {
            router.push('/login')
          } else {
            fetchAppraisal()
          }
          unsubscribe()
        }
      })
      return
    }

    if (!session) {
      router.push('/login')
      return
    }

    fetchAppraisal()
  }, [router, appraisalId])

  async function fetchAppraisal() {
    try {
      setLoading(true)
      setError(null)
      const { data } = await apiClient.get(`/appraisals/${appraisalId}`)
      setAppraisal(data.data)
      setItems(
        (data.data.items || []).map((item: AppraisalItem) => ({
          id: item.id,
          key: item.key,
          points: item.points,
          weight: item.weight,
          notes: item.notes || ''
        }))
      )
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to load appraisal for editing'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = appraisal?.status === 'DRAFT' && !appraisal.locked && appraisal.user.id === session?.user.id
  const totalWeight = items.reduce((sum, item) => sum + Number(item.weight || 0), 0)
  const weightedScore =
    totalWeight > 0 ? items.reduce((sum, item) => sum + Number(item.points || 0) * Number(item.weight || 0), 0) / totalWeight : 0
  const weightedPercent = totalWeight > 0 ? (weightedScore / 4) * 100 : 0

  function updateItem(index: number, field: keyof AppraisalItem, value: string) {
    setItems(current => {
      const next = [...current]
      const item = { ...next[index] }

      if (field === 'points' || field === 'weight') {
        item[field] = Number(value)
      } else {
        item[field] = value
      }

      next[index] = item
      return next
    })
  }

  function addItem() {
    setItems(current => [...current, { key: '', points: 0, weight: 0, notes: '' }])
  }

  function removeItem(index: number) {
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSave() {
    const invalidItem = items.find(item => !item.key.trim())
    if (invalidItem) {
      setError('Every appraisal item needs a key before saving.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await apiClient.put(`/appraisals/${appraisalId}`, {
        items: items.map(item => ({
          id: item.id,
          key: item.key.trim(),
          points: Number(item.points),
          weight: Number(item.weight),
          notes: item.notes?.trim() || undefined
        }))
      })
      router.push(`/appraisals/${appraisalId}`)
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to save appraisal'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-sm text-slate-600">Loading appraisal editor…</p>
        </div>
      </div>
    )
  }

  if (error && !appraisal) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <Link href={`/appraisals/${appraisalId}`} className="mt-6 inline-block rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Back to appraisal
          </Link>
        </div>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-sm font-medium text-slate-700">This appraisal can no longer be edited.</p>
          <Link href={`/appraisals/${appraisalId}`} className="mt-6 inline-block rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Back to appraisal
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <Link href={`/appraisals/${appraisalId}`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Back to appraisal
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Edit Draft</h1>
            <p className="text-sm text-slate-600">{appraisal?.cycle.name}</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>Weighted score: {weightedScore.toFixed(2)}</p>
            <p>{weightedPercent.toFixed(1)}%</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Appraisee</h2>
              <p className="text-sm text-slate-600">
                {appraisal?.user.firstName} {appraisal?.user.lastName} • {appraisal?.user.email}
              </p>
            </div>
            <button
              onClick={addItem}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id || `${item.key}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Key</label>
                    <input
                      value={item.key}
                      onChange={event => updateItem(index, 'key', event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Points</label>
                    <input
                      type="number"
                      min={0}
                      max={4}
                      step={1}
                      value={item.points}
                      onChange={event => updateItem(index, 'points', event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Weight</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={item.weight}
                      onChange={event => updateItem(index, 'weight', event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-900"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes</label>
                    <input
                      value={item.notes || ''}
                      onChange={event => updateItem(index, 'notes', event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-900"
                    />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <button
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <Link
              href={`/appraisals/${appraisalId}`}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
