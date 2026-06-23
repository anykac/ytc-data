'use client'
import { useState } from 'react'
import { upsertStation } from '@/actions/admin'
import CrudTable from '@/components/admin/CrudTable'

type Station = { id: string; name: string; sequence: number; active: boolean }
const blank = (): Omit<Station, 'id'> & { id?: string } => ({ name: '', sequence: 1, active: true })

export default function StationsAdmin({ stations }: { stations: Station[] }) {
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function edit(s: Station) { setForm({ ...s }); setError('') }
  function toggleActive(s: Station) { submit({ ...s, active: !s.active }) }

  async function submit(data: typeof form) {
    if (!data) return
    setSaving(true); setError('')
    try {
      await upsertStation(data as Parameters<typeof upsertStation>[0])
      setForm(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Stations</h1>
        <button onClick={() => { setForm(blank()); setError('') }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + New station
        </button>
      </div>

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); submit(form) }} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm">
          <h2 className="font-medium text-gray-800">{form.id ? 'Edit station' : 'New station'}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Sequence</label>
              <input required type="number" min={1} value={form.sequence}
                onChange={(e) => setForm({ ...form, sequence: parseInt(e.target.value) || 1 })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
          </div>
        </form>
      )}

      <CrudTable
        columns={[
          { key: 'sequence', label: 'Seq' },
          { key: 'name', label: 'Name' },
          { key: 'active', label: 'Status' },
        ]}
        rows={stations}
        onEdit={edit}
        onToggleActive={toggleActive}
      />
    </div>
  )
}
