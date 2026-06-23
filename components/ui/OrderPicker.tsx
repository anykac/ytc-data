'use client'
import { useRouter, useSearchParams } from 'next/navigation'

type Order = { id: string; order_number: string }

export default function OrderPicker({ orders, selectedId }: { orders: Order[]; selectedId: string | undefined }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('orderId', e.target.value)
    } else {
      params.delete('orderId')
    }
    // Clear model when order changes — model list will change
    params.delete('modelId')
    router.push(`?${params.toString()}`)
  }

  return (
    <select
      value={selectedId ?? ''}
      onChange={onChange}
      className="border rounded px-3 py-1.5 text-sm"
    >
      <option value="">All orders</option>
      {orders.map((o) => (
        <option key={o.id} value={o.id}>{o.order_number}</option>
      ))}
    </select>
  )
}
