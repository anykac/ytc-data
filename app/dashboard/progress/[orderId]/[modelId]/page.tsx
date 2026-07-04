import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { getOrderModelSteps } from '@/lib/db/order-model-tracker'
import StepTrackerTable from '@/components/dashboard/StepTrackerTable'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OrderModelTrackerPage({
  params,
}: {
  params: Promise<{ orderId: string; modelId: string }>
}) {
  await requireRole('supervisor')
  const { orderId, modelId } = await params

  if (!UUID_RE.test(orderId) || !UUID_RE.test(modelId)) {
    redirect('/dashboard/progress')
  }

  let result: Awaited<ReturnType<typeof getOrderModelSteps>>
  try {
    result = await getOrderModelSteps(orderId, modelId)
  } catch {
    redirect('/dashboard/progress')
  }

  const { rows, orderNumber, modelName } = result

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard/progress" className="hover:text-gray-700">
          Model Progress
        </Link>
        <span>›</span>
        <span className="text-gray-900">{modelName}</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{modelName}</h1>
        <p className="text-sm text-gray-500">Order {orderNumber}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No station configuration found for this model.
        </p>
      ) : (
        <StepTrackerTable rows={rows} modelId={modelId} />
      )}
    </div>
  )
}
