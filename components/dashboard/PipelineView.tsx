import type { PipelineRow } from '@/lib/db/dashboard'

function attainmentColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400'
  if (pct >= 90) return 'text-green-600 font-medium'
  if (pct >= 70) return 'text-amber-600 font-medium'
  return 'text-red-600 font-medium'
}

export default function PipelineView({ rows }: { rows: PipelineRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No entries for this date.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Station</th>
            <th className="px-4 py-3 font-medium text-right">Attainment %</th>
            <th className="px-4 py-3 font-medium text-right">WIP In (Tambak)</th>
            <th className="px-4 py-3 font-medium text-right">Gap to Goal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={row.stationId} className="bg-white hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <span className="text-gray-400 mr-2 text-xs">{i + 1}</span>
                {row.stationName}
              </td>
              <td className={`px-4 py-3 text-right ${attainmentColor(row.attainmentPct)}`}>
                {row.attainmentPct !== null ? `${row.attainmentPct}%` : '—'}
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {row.wip === null ? '—' : row.wip}
              </td>
              <td className={`px-4 py-3 text-right ${row.gapToGoal > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                {row.gapToGoal > 0 ? `-${row.gapToGoal}` : row.gapToGoal === 0 ? '✓' : `+${Math.abs(row.gapToGoal)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
