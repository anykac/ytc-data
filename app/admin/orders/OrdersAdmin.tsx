'use client'
import { useMemo, useState } from 'react'
import { upsertOrder } from '@/actions/admin'
import CrudTable from '@/components/admin/CrudTable'
import CustomerTabs from '@/components/admin/CustomerTabs'
import Combobox from '@/components/ui/Combobox'
import { DEFAULT_CUSTOMER_NAME } from '@/lib/constants'

type Customer = { id: string; name: string }
type Order = { id: string; order_number: string; order_date: string; due_date: string; active: boolean; customer_id: string }
type Model = { id: string; name: string; customer_id: string }
type Line = { order_id: string; model_id: string; quantity: number; models: { name: string } }
type FormLine = { modelId: string; quantity: number }
type Form = { id?: string; orderNumber: string; orderDate: string; dueDate: string; active: boolean; customerId: string; lines: FormLine[] }

export default function OrdersAdmin({ orders, models, lines, customers }: { orders: Order[]; models: Model[]; lines: Line[]; customers: Customer[] }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    () => customers.find((c) => c.name === DEFAULT_CUSTOMER_NAME)?.id ?? customers[0]?.id ?? ''
  )
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const blank = (): Form => ({
    orderNumber: '', orderDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0], active: true, customerId: selectedCustomerId,
    lines: [{ modelId: '', quantity: 0 }],
  })

  const ordersForCustomer = useMemo(
    () => orders.filter((o) => o.customer_id === selectedCustomerId),
    [orders, selectedCustomerId]
  )
  const modelsForFormCustomer = useMemo(
    () => (form ? models.filter((m) => m.customer_id === form.customerId) : []),
    [models, form]
  )

  function selectCustomer(customerId: string) {
    setSelectedCustomerId(customerId)
    setForm(null)
    setError('')
  }

  function linesFor(orderId: string): FormLine[] {
    return lines.filter((l) => l.order_id === orderId).map((l) => ({ modelId: l.model_id, quantity: l.quantity }))
  }

  function edit(o: Order) {
    setForm({ id: o.id, orderNumber: o.order_number, orderDate: o.order_date, dueDate: o.due_date, active: o.active, customerId: o.customer_id, lines: linesFor(o.id) })
    setError('')
  }

  function toggleActive(o: Order) {
    submit({ id: o.id, orderNumber: o.order_number, orderDate: o.order_date, dueDate: o.due_date, active: !o.active, customerId: o.customer_id, lines: linesFor(o.id) })
  }

  function setLine(i: number, field: keyof FormLine, value: string | number) {
    if (!form) return
    const updated = form.lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l)
    setForm({ ...form, lines: updated })
  }

  async function submit(data: Form) {
    setSaving(true); setError('')
    const result = await upsertOrder({ ...data, lines: data.lines.filter((l) => l.modelId && l.quantity > 0) })
    if (result.error) setError(result.error)
    else setForm(null)
    setSaving(false)
  }

  const displayOrders = ordersForCustomer.map((o) => ({
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
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Due date</label>
              <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-full cursor-pointer" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Line items</label>
            <div className="space-y-2">
              {form.lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Combobox
                      options={modelsForFormCustomer.map((m) => ({ id: m.id, label: m.name }))}
                      value={line.modelId || undefined}
                      onChange={(id) => setLine(i, 'modelId', id ?? '')}
                      placeholder="Select model…"
                      className="w-full"
                    />
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      required
                      value={line.modelId}
                      onChange={() => {}}
                      className="absolute inset-x-0 bottom-0 h-0 w-full opacity-0 pointer-events-none"
                    />
                  </div>
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
          <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
          <button onClick={() => { setForm(blank()); setError('') }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer">
            + New order
          </button>
        </div>
        <CustomerTabs customers={customers} selectedId={selectedCustomerId} onSelect={selectCustomer} />
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
          deactivateLabel="In Progress"
          activateLabel="Completed"
        />
      </div>
    </div>
  )
}
