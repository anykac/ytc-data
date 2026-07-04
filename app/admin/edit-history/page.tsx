import { requireRole } from '@/lib/auth/session'
import { getEditHistory, type EditHistoryRow } from '@/lib/db/admin'
import EditHistory from '@/components/admin/EditHistory'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function EditHistoryPage() {
  await requireRole('supervisor')

  async function fetchHistory(startDate: string, endDate: string): Promise<EditHistoryRow[]> {
    'use server'
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || startDate > endDate) {
      throw new Error('Invalid date range')
    }
    return getEditHistory(startDate, endDate)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Edit History</h1>
      <EditHistory fetchHistory={fetchHistory} />
    </div>
  )
}
