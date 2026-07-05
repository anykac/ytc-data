'use client'
import { useState } from 'react'
import { upsertLead } from '@/actions/admin'
import CrudTable from '@/components/admin/CrudTable'

type Lead = { id: string; name: string; active: boolean }
type Form = { id?: string; name: string; password: string; active: boolean }
const blank = (): Form => ({ name: '', password: '', active: true })

export default function LeadsAdmin({ leads }: { leads: Lead[] }) {
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function edit(l: Lead) { setForm({ id: l.id, name: l.name, password: '', active: l.active }); setError('') }
  function toggleActive(l: Lead) { submit({ id: l.id, name: l.name, password: '', active: !l.active }) }

  async function submit(data: Form) {
    setSaving(true); setError('')
    const result = await upsertLead({
      id: data.id,
      name: data.name,
      // undefined = leave password unchanged; never send empty string (action rejects)
      password: data.password.length > 0 ? data.password : undefined,
      active: data.active,
    })
    if (result.error) setError(result.error)
    else setForm(null)
    setSaving(false)
  }

  return (
    <div className="space-y-4">

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); submit(form) }} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-md shadow-sm">
          <h2 className="font-medium text-gray-800">{form.id ? 'Edit lead' : 'New lead'}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Password {form.id && <span className="text-gray-400">(leave blank to keep existing)</span>}
              </label>
              <input type="password" required={!form.id} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
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
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <button onClick={() => { setForm(blank()); setError('') }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer">
            + New lead
          </button>
        </div>
        <CrudTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'active', label: 'Status' },
          ]}
          rows={leads}
          onEdit={edit}
          onToggleActive={toggleActive}
        />
      </div>
    </div>
  )
}
