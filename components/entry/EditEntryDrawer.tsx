'use client'

import { useTransition, useState } from 'react'
import { searchEntries, editEntry, type EditResult } from '@/actions/entry'
import { PERIOD_ORDER as PERIODS } from '@/lib/constants'

const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900'
const BASE_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900'

type Station = { id: string; name: string }
type Lead = { id: string; name: string }

type NameRelation = { name: string } | { name: string }[] | null

type SearchResultRow = {
  id: string
  date: string
  period: string
  target: number
  actual: number
  pax: number
  defects: number
  created_at: string
  stations: NameRelation
  models: NameRelation
  leads: NameRelation
}

function relName(rel: NameRelation): string {
  if (!rel) return '—'
  return Array.isArray(rel) ? (rel[0]?.name ?? '—') : rel.name
}

type Props = {
  stations: Station[]
  leads: Lead[]
  onClose: () => void
}

type EditFormState = {
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

function editFormFromRow(row: SearchResultRow): EditFormState {
  return {
    target: String(row.target),
    actual: String(row.actual),
    pax: String(row.pax),
    defects: String(row.defects),
    leadName: '',
    password: '',
  }
}

export default function EditEntryDrawer({ stations, leads, onClose }: Props) {
  const [stationId, setStationId] = useState('')
  const [period, setPeriod] = useState<string>(PERIODS[0])
  const [date, setDate] = useState(today())
  const [results, setResults] = useState<SearchResultRow[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, startSearch] = useTransition()

  const [selected, setSelected] = useState<SearchResultRow | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [editResult, setEditResult] = useState<EditResult | null>(null)
  const [isSaving, startSave] = useTransition()
  const [savedMessage, setSavedMessage] = useState(false)

  function set(field: keyof EditFormState, value: string) {
    setEditForm(prev => prev && { ...prev, [field]: value })
    setEditResult(null)
  }

  function runSearch() {
    setSearchError(null)
    setSelected(null)
    setEditForm(null)
    startSearch(async () => {
      try {
        const rows = await searchEntries(stationId, period, date)
        setResults(rows as SearchResultRow[])
      } catch {
        setSearchError('Search failed — please try again.')
        setResults(null)
      }
    })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSavedMessage(false)
    runSearch()
  }

  function selectRow(row: SearchResultRow) {
    setSelected(row)
    setEditForm(editFormFromRow(row))
    setEditResult(null)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !editForm) return
    setEditResult(null)
    startSave(async () => {
      const res = await editEntry({
        entryId: selected.id,
        leadName: editForm.leadName,
        password: editForm.password,
        target: Number(editForm.target),
        actual: Number(editForm.actual),
        pax: Number(editForm.pax),
        defects: Number(editForm.defects),
      })
      setEditResult(res)
      if (res.status === 'success') {
        setSelected(null)
        setEditForm(null)
        setSavedMessage(true)
        runSearch()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white h-full w-full max-w-lg shadow-lg p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit Previous Entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!selected && (
          <>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Station</label>
                <select
                  required
                  value={stationId}
                  onChange={e => setStationId(e.target.value)}
                  className={BASE_SELECT}
                >
                  <option value="" className="text-gray-400">Select station</option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Period</label>
                  <select
                    required
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className={BASE_SELECT}
                  >
                    {PERIODS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={`${INPUT_CLS} cursor-pointer`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {isSearching ? 'Searching…' : 'Search'}
              </button>
            </form>

            {savedMessage && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                Saved.
              </p>
            )}

            {searchError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {searchError}
              </p>
            )}

            {results && results.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No entries found.</p>
            )}

            {results && results.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Station</th>
                      <th className="px-3 py-2 font-medium">Period</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Target</th>
                      <th className="px-3 py-2 font-medium">Actual</th>
                      <th className="px-3 py-2 font-medium">PAX</th>
                      <th className="px-3 py-2 font-medium">Defects</th>
                      <th className="px-3 py-2 font-medium">Submitted by</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map(row => (
                      <tr
                        key={row.id}
                        onClick={() => selectRow(row)}
                        className="bg-white hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-3 py-2 text-gray-800">{relName(row.stations)}</td>
                        <td className="px-3 py-2 text-gray-800">{row.period}</td>
                        <td className="px-3 py-2 text-gray-800">{relName(row.models)}</td>
                        <td className="px-3 py-2 text-gray-800">{row.target}</td>
                        <td className="px-3 py-2 text-gray-800">{row.actual}</td>
                        <td className="px-3 py-2 text-gray-800">{row.pax}</td>
                        <td className="px-3 py-2 text-gray-800">{row.defects}</td>
                        <td className="px-3 py-2 text-gray-800">{relName(row.leads)}</td>
                        <td className="px-3 py-2 text-gray-800">
                          {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {selected && editForm && (
          <form onSubmit={handleSave} className="space-y-4">
            <button
              type="button"
              onClick={() => { setSelected(null); setEditForm(null); setEditResult(null) }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to results
            </button>

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
                    max={field === 'defects' && editForm.actual !== '' ? Number(editForm.actual) : undefined}
                    value={editForm[field]}
                    onInvalid={field === 'defects' ? e => e.currentTarget.setCustomValidity('Value must be less than or equal to Actual output') : undefined}
                    onChange={e => {
                      if (field === 'defects') e.currentTarget.setCustomValidity('')
                      set(field, e.target.value)
                    }}
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Lead</label>
                <select
                  required
                  value={editForm.leadName}
                  onChange={e => set('leadName', e.target.value)}
                  className={BASE_SELECT}
                >
                  <option value="" className="text-gray-400">Select lead</option>
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
                  value={editForm.password}
                  onChange={e => set('password', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Lead password"
                />
              </div>
            </div>

            {editResult?.status === 'auth_failed' && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Incorrect password — edit not saved.
              </p>
            )}
            {editResult?.status === 'error' && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {editResult.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
