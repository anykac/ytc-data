import { getModelProgress } from '@/lib/db/dashboard'
import ModelProgressTable from '@/components/dashboard/ModelProgressTable'

export default async function ModelProgressPage() {
  const rows = await getModelProgress()

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Model Progress</h1>
      <ModelProgressTable rows={rows} />
    </div>
  )
}
