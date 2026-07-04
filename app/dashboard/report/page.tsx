import { getFullDataReport, type FullDataReportRow } from '@/lib/db/dashboard'
import FullDataReport from '@/components/dashboard/FullDataReport'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function ReportPage() {
  async function fetchReport(startDate: string, endDate: string): Promise<FullDataReportRow[]> {
    'use server'
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || startDate > endDate) {
      throw new Error('Invalid date range')
    }
    return getFullDataReport(startDate, endDate)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Full Data Report</h1>
      <FullDataReport fetchReport={fetchReport} />
    </div>
  )
}
