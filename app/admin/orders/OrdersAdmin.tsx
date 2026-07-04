'use client'
import { useState } from 'react'
import { upsertOrder } from '@/actions/admin'
import CrudTable from '@/components/admin/CrudTable'

type Order = { id: string; order_number: string; order_date: string; due_date: string; active: boolean }
type Model = { id: string; name: string }
type Line = { order_id: string; model_id: string; quantity: number; models: { name: string } }
type FormLine = { modelId: string; quantity: number }
type Form = { id?: string; orderNumber: string; orderDate: string; dueDate: string; active: boolean; lines: FormLine[] }

const blank = (): Form => ({
  orderNumber: '', orderDate: new Date().toISOString().split('T')[0],
  dueDate: new Date().toISOString().split('T')[0], active: true, lines: [{ modelId: '', quantity: 0 }],
})

export default function OrdersAdmin({ orders, models, lines }: { orders: Order[]; models: Model[]; lines: Line[] }) {
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function linesFor(orderId: string): FormLine[] {
    return lines.filter((l) => l.order_id === orderId).map((l) => ({ modelId: l.model_id, quantity: l.quantity }))
  }

  function edit(o: Order) {
    setForm({ id: o.id, orderNumber: o.order_number, orderDate: o.order_date, dueDate: o.due_date, active: o.active, lines: linesFor(o.id) })
    setError('')
  }

  function toggleActive(o: Order) {
    submit({ id: o.id, orderNumber: o.order_number, orderDate: o.order_date, dueDate: o.due_date, active: !o.active, lines: linesFor(o.id) })
  }

  function setLine(i: number, field: keyof FormLine, value: string | number) {
    if (!form) return
    const updated = form.lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l)
    setForm({ ...form, lines: updated })
  }

  async function submit(data: Form) {
    setSaving(true); setError('')
    try {
      await upsertOrder({ ...data, lines: data.lines.filter((l) => l.modelId && l.quantity > 0) })
      setForm(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const displayOrders = orders.map((o) => ({
    ...o,
    line_summary: lines.filter((l) => l.order_id === o.id).map((l) => `${l.models.name} ×${l.quantity}`).join(', ') || '—',
  }))

  return (
    <div className="space-y-4">

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); submit(form) }} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-lg shadow-sm">
          <h2 className="font-medium text-gray-800">{form.id ? 'Edit order' : 'New order'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Order number</label>
              <input required value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Order date</label>
              <input required type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Due date</label>
              <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Line items</label>
            <div className="space-y-2">
              {form.lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select required value={line.modelId} onChange={(e) => setLine(i, 'modelId', e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm flex-1 bg-white text-gray-900">
                    <option value="">Select model…</option>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input required type="number" min={1} placeholder="Qty" value={line.quantity || ''}
                    onChange={(e) => setLine(i, 'quantity', parseInt(e.target.value) || 0)}
                    className="border rounded px-2 py-1.5 text-sm text-gray-900 bg-white w-24" />
                  {form.lines.length > 1 && (
                    <button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { modelId: '', quantity: 0 }] })}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800">
              + Add line
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
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

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
          <button onClick={() => { setForm(blank()); setError('') }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            + New order
          </button>
        </div>
        <CrudTable
          columns={[
            { key: 'order_number', label: 'Order #' },
            { key: 'order_date', label: 'Order date' },
            { key: 'due_date', label: 'Due date' },
            { key: 'line_summary' as keyof typeof displayOrders[0], label: 'Models' },
            { key: 'active', label: 'Status' },
          ]}
          rows={displayOrders}
          onEdit={(r) => { const o = orders.find((x) => x.id === r.id); if (o) edit(o) }}
          onToggleActive={(r) => { const o = orders.find((x) => x.id === r.id); if (o) toggleActive(o) }}
          deactivateLabel="Completed"
          activateLabel="In Progress"
        />
      </div>
    </div>
  )
}
