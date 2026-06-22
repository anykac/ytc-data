import { getDailySummary } from '@/lib/db/dashboard'
import DailySummaryTable from '@/components/dashboard/DailySummaryTable'
import DatePicker from '@/components/ui/DatePicker'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const date = params.date ?? new Date().toISOString().split('T')[0]
  const rows = await getDailySummary(date)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Daily Summary</h1>
        <DatePicker value={date} />
      </div>
      <DailySummaryTable rows={rows} />
    </div>
  )
}
