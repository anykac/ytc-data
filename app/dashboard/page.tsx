import { getDailySummary } from '@/lib/db/dashboard'
import { getActiveOrders, getFilteredModels, resolveModelIds } from '@/lib/db/filters'
import DailySummaryTable from '@/components/dashboard/DailySummaryTable'
import DatePicker from '@/components/ui/DatePicker'
import OrderPicker from '@/components/ui/OrderPicker'
import ModelPicker from '@/components/ui/ModelPicker'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; orderId?: string; modelId?: string }>
}) {
  const params = await searchParams
  const date = params.date ?? new Date().toISOString().split('T')[0]
  const orderId = params.orderId
  const modelId = params.modelId

  const modelIds = await resolveModelIds(orderId, modelId)
  const [orders, models, rows] = await Promise.all([
    getActiveOrders(),
    getFilteredModels(orderId),
    getDailySummary(date, modelIds),
  ])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Daily Summary</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <OrderPicker orders={orders} selectedId={orderId} />
          <ModelPicker models={models} selectedId={modelId} />
          <DatePicker value={date} />
        </div>
      </div>
      <DailySummaryTable rows={rows} />
    </div>
  )
}
