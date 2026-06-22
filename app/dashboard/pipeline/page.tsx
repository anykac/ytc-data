import { getPipelineData } from '@/lib/db/dashboard'
import PipelineView from '@/components/dashboard/PipelineView'
import DatePicker from '@/components/ui/DatePicker'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const date = params.date ?? new Date().toISOString().split('T')[0]
  const rows = await getPipelineData(date)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
        <DatePicker value={date} />
      </div>
      <PipelineView rows={rows} />
    </div>
  )
}
