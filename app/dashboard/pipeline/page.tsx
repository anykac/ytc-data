import { getPipelineData } from '@/lib/db/dashboard'
import { getActiveOrders, getFilteredModels } from '@/lib/db/filters'
import PipelineView from '@/components/dashboard/PipelineView'
import DatePicker from '@/components/ui/DatePicker'
import OrderPicker from '@/components/ui/OrderPicker'
import ModelPicker from '@/components/ui/ModelPicker'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; orderId?: string; modelId?: string }>
}) {
  const params = await searchParams
  const date = ISO_DATE.test(params.date ?? '') ? params.date! : new Date().toISOString().split('T')[0]
  const orderId = params.orderId
  const modelId = params.modelId

  // Fetch orders and models in parallel; derive modelIds from the already-fetched models
  // to avoid a second round-trip to order_lines.
  const [orders, models] = await Promise.all([
    getActiveOrders(),
    getFilteredModels(orderId),
  ])
  const modelIds = modelId ? [modelId] : orderId ? models.map((m) => m.id) : undefined
  const rows = await getPipelineData(date, modelIds)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <OrderPicker orders={orders} selectedId={orderId} />
          <ModelPicker models={models} selectedId={modelId} />
          <DatePicker value={date} />
        </div>
      </div>
      <PipelineView rows={rows} />
    </div>
  )
}
