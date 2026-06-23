'use client'
import { useState, useEffect } from 'react'
import { upsertModel } from '@/actions/admin'
import CrudTable from '@/components/admin/CrudTable'

type Model = { id: string; name: string; active: boolean }
type Station = { id: string; name: string; sequence: number }
type Config = { model_id: string; station_id: string }
type Form = { id?: string; name: string; active: boolean; stationIds: string[] }
const blank = (): Form => ({ name: '', active: true, stationIds: [] })

export default function ModelsAdmin({
  models, stations, configs: configsProp,
}: { models: Model[]; stations: Station[]; configs: Config[] }) {
  const [configs, setConfigs] = useState(configsProp)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync when server re-renders with fresh config data after a save
  useEffect(() => { setConfigs(configsProp) }, [configsProp])

  function configFor(modelId: string) {
    return configs.filter((c) => c.model_id === modelId).map((c) => c.station_id)
  }

  function edit(m: Model) {
    setForm({ id: m.id, name: m.name, active: m.active, stationIds: configFor(m.id) })
    setError('')
  }

  function toggleActive(m: Model) {
    submit({ id: m.id, name: m.name, active: !m.active, stationIds: configFor(m.id) })
  }

  function toggleStation(stationId: string) {
    if (!form) return
    const ids = form.stationIds.includes(stationId)
      ? form.stationIds.filter((id) => id !== stationId)
      : [...form.stationIds, stationId]
    setForm({ ...form, stationIds: ids })
  }

  async function submit(data: Form) {
    setSaving(true); setError('')
    try {
      await upsertModel(data as Parameters<typeof upsertModel>[0])
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
        <h1 className="text-xl font-semibold text-gray-900">Models</h1>
        <button onClick={() => { setForm(blank()); setError('') }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + New model
        </button>
      </div>

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); submit(form) }} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm">
          <h2 className="font-medium text-gray-800">{form.id ? 'Edit model' : 'New model'}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stations this model flows through</label>
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
                {stations.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer hover:bg-white rounded px-1 py-0.5">
                    <input type="checkbox" checked={form.stationIds.includes(s.id)} onChange={() => toggleStation(s.id)} />
                    <span className="text-gray-400 text-xs w-5 shrink-0">{s.sequence}</span>
                    {s.name}
                  </label>
                ))}
              </div>
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
        columns={[{ key: 'name', label: 'Name' }, { key: 'active', label: 'Status' }]}
        rows={models}
        onEdit={edit}
        onToggleActive={toggleActive}
      />
    </div>
  )
}
