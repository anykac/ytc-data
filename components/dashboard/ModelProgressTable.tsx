import Link from 'next/link'
import type { ModelProgressRow } from '@/lib/db/dashboard'

export default function ModelProgressTable({ rows }: { rows: ModelProgressRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No active orders found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Order #</th>
            <th className="px-4 py-3 font-medium">Model</th>
            <th className="px-4 py-3 font-medium text-right">Ordered</th>
            <th className="px-4 py-3 font-medium text-right">Produced</th>
            <th className="px-4 py-3 font-medium text-right">Balance</th>
            <th className="px-4 py-3 font-medium text-right">Due Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={`${row.orderId}-${row.modelId}`} className="bg-white hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-700">{row.orderNumber}</td>
              <td className="px-4 py-3 font-medium text-blue-600 hover:text-blue-800">
                <Link href={`/dashboard/progress/${row.orderId}/${row.modelId}`}>
                  {row.modelName}
                </Link>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{row.totalOrdered.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-gray-700">{row.totalProduced.toLocaleString()}</td>
              <td className={`px-4 py-3 text-right font-medium ${row.balanceRemaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {row.balanceRemaining > 0 ? row.balanceRemaining.toLocaleString() : '✓ Complete'}
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{row.dueDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
