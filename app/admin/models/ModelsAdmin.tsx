'use client'
import { useState, useEffect, useMemo } from 'react'
import { upsertModel } from '@/actions/admin'
import CrudTable from '@/components/admin/CrudTable'
import CustomerTabs from '@/components/admin/CustomerTabs'
import { DEFAULT_CUSTOMER_NAME } from '@/lib/constants'

type Customer = { id: string; name: string }
type Model = { id: string; name: string; active: boolean; customer_id: string }
type Station = { id: string; name: string; sequence: number; customer_id: string }
type Config = { model_id: string; station_id: string }
type Form = { id?: string; name: string; active: boolean; stationIds: string[]; customerId: string }

export default function ModelsAdmin({
  models, stations, configs: configsProp, customers,
}: { models: Model[]; stations: Station[]; configs: Config[]; customers: Customer[] }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    () => customers.find((c) => c.name === DEFAULT_CUSTOMER_NAME)?.id ?? customers[0]?.id ?? ''
  )
  const [configs, setConfigs] = useState(configsProp)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const blank = (): Form => ({ name: '', active: true, stationIds: [], customerId: selectedCustomerId })

  const modelsForCustomer = useMemo(
    () => models.filter((m) => m.customer_id === selectedCustomerId),
    [models, selectedCustomerId]
  )
  const stationsForFormCustomer = useMemo(
    () => (form ? stations.filter((s) => s.customer_id === form.customerId) : []),
    [stations, form]
  )

  // Sync when server re-renders with fresh config data after a save
  useEffect(() => { setConfigs(configsProp) }, [configsProp])

  function selectCustomer(customerId: string) {
    setSelectedCustomerId(customerId)
    setForm(null)
    setError('')
  }

  function configFor(modelId: string) {
    return configs.filter((c) => c.model_id === modelId).map((c) => c.station_id)
  }

  function edit(m: Model) {
    setForm({ id: m.id, name: m.name, active: m.active, stationIds: configFor(m.id), customerId: m.customer_id })
    setError('')
  }

  function toggleActive(m: Model) {
    submit({ id: m.id, name: m.name, active: !m.active, stationIds: configFor(m.id), customerId: m.customer_id })
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
      await upsertModel(data)
      setForm(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">

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
                {stationsForFormCustomer.map((s) => (
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
            <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Models</h1>
          <button onClick={() => { setForm(blank()); setError('') }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer">
            + New model
          </button>
        </div>
        <CustomerTabs customers={customers} selectedId={selectedCustomerId} onSelect={selectCustomer} />
        <CrudTable
          columns={[{ key: 'name', label: 'Name' }, { key: 'active', label: 'Status' }]}
          rows={modelsForCustomer}
          onEdit={edit}
          onToggleActive={toggleActive}
        />
      </div>
    </div>
  )
}
