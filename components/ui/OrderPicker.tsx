'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Combobox from './Combobox'

type Order = { id: string; order_number: string }

export default function OrderPicker({ orders, selectedId }: { orders: Order[]; selectedId: string | undefined }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(id: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) { params.set('orderId', id) } else { params.delete('orderId') }
    params.delete('modelId') // clear model when order changes
    router.push(`?${params.toString()}`)
  }

  return (
    <Combobox
      options={orders.map((o) => ({ id: o.id, label: o.order_number }))}
      value={selectedId}
      onChange={onChange}
      placeholder="All orders"
    />
  )
}
