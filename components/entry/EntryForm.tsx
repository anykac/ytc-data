'use client'

import { useTransition, useState } from 'react'
import { submitEntry, type EntryResult } from '@/actions/entry'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900'
const BASE_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white'

function selectCls(value: string) {
  return `${BASE_SELECT} ${value ? 'text-gray-900' : 'text-gray-400'}`
}

type Station = { id: string; name: string; sequence: number }
type Model   = { id: string; name: string }
type Lead    = { id: string; name: string }

type Props = {
  stations: Station[]
  models: Model[]
  leads: Lead[]
}

type FormState = {
  date: string
  period: string
  stationId: string
  modelId: string
  target: string
  actual: string
  pax: string
  defects: string
  leadName: string
  password: string
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function emptyForm(leads: Lead[]): FormState {
  return {
    date: today(),
    period: 'P1',
    stationId: '',
    modelId: '',
    target: '',
    actual: '',
    pax: '',
    defects: '',
    leadName: leads[0]?.name ?? '',
    password: '',
  }
}

export default function EntryForm({ stations, models, leads }: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm(leads))
  const [result, setResult] = useState<EntryResult | null>(null)
  const [pendingPayload, setPendingPayload] = useState<ReturnType<typeof buildPayload> | null>(null)
  const [isPending, startTransition] = useTransition()

  const showConfirm = pendingPayload !== null

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setResult(null)
  }

  function resetDataFields() {
    setForm(prev => ({ ...emptyForm(leads), leadName: prev.leadName }))
  }

  function buildPayload(confirmDuplicate = false) {
    return {
      date: form.date,
      period: form.period,
      stationId: form.stationId,
      modelId: form.modelId,
      target: Number(form.target),
      actual: Number(form.actual),
      pax: Number(form.pax),
      defects: Number(form.defects),
      leadName: form.leadName,
      password: form.password,
      confirmDuplicate,
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    const payload = buildPayload()
    startTransition(async () => {
      const res = await submitEntry(payload)
      if (res.status === 'duplicate') {
        setPendingPayload(payload)
      } else {
        setResult(res)
        if (res.status === 'success') resetDataFields()
      }
    })
  }

  function handleConfirmDuplicate() {
    if (!pendingPayload) return
    const payload = { ...pendingPayload, confirmDuplicate: true }
    setPendingPayload(null)
    startTransition(async () => {
      const res = await submitEntry(payload)
      setResult(res)
      if (res.status === 'success') resetDataFields()
    })
  }

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          message="An entry already exists for this station, model, period, and date. Submit anyway?"
          onConfirm={handleConfirmDuplicate}
          onCancel={() => setPendingPayload(null)}
          isPending={isPending}
        />
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-gray-900">Log Production Entry</h1>

        {/* Date + Period */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Period</label>
            <select
              required
              value={form.period}
              onChange={e => set('period', e.target.value)}
              className={`${BASE_SELECT} text-gray-900`}
            >
              {PERIODS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Station + Model */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Station</label>
            <select
              required
              value={form.stationId}
              onChange={e => set('stationId', e.target.value)}
              className={selectCls(form.stationId)}
            >
              <option value="">Select station</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Model</label>
            <select
              required
              value={form.modelId}
              onChange={e => set('modelId', e.target.value)}
              className={selectCls(form.modelId)}
            >
              <option value="">Select model</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Numeric fields */}
        <div className="grid grid-cols-2 gap-4">
          {(['target', 'actual', 'pax', 'defects'] as const).map(field => (
            <div key={field} className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {{ target: 'Target output', actual: 'Actual output', pax: 'PAX', defects: 'Defects' }[field]}
              </label>
              <input
                type="number"
                required
                min={0}
                max={field === 'defects' && form.actual !== '' ? Number(form.actual) : undefined}
                value={form[field]}
                onInvalid={field === 'defects' ? e => e.currentTarget.setCustomValidity('Value must be less than or equal to Actual output') : undefined}
                onChange={e => {
                  if (field === 'defects') e.currentTarget.setCustomValidity('')
                  set(field, e.target.value)
                }}
                className={INPUT_CLS}
                placeholder="0"
              />
            </div>
          ))}
        </div>

        {/* Lead + Password */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Lead</label>
            <select
              required
              value={form.leadName}
              onChange={e => set('leadName', e.target.value)}
              className={selectCls(form.leadName)}
            >
              <option value="">Select lead</option>
              {leads.map(l => (
                <option key={l.id} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => set('password', e.target.value)}
              className={INPUT_CLS}
              placeholder="Lead password"
            />
          </div>
        </div>

        {/* Status messages */}
        {result?.status === 'auth_failed' && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Incorrect password — submission not recorded.
          </p>
        )}
        {result?.status === 'success' && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Submitted successfully.
          </p>
        )}
        {result?.status === 'error' && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {result.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {isPending ? 'Submitting…' : 'Submit Entry'}
        </button>
      </form>
    </>
  )
}
