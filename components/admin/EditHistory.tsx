'use client'
import { useEffect, useState, useTransition } from 'react'
import type { EditHistoryRow } from '@/lib/db/admin'

function currentMonthBounds() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(first), end: fmt(last) }
}

function FieldValue({ prev, new: next }: { prev: number; new: number }) {
  if (prev === next) return <span className="text-gray-700">{next}</span>
  return (
    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
      {prev} → {next}
    </span>
  )
}

type Props = {
  fetchHistory: (startDate: string, endDate: string) => Promise<EditHistoryRow[]>
}

export default function EditHistory({ fetchHistory }: Props) {
  const [{ start, end }, setRange] = useState(currentMonthBounds)
  const [rows, setRows] = useState<EditHistoryRow[]>([])
  const [loadError, setLoadError] = useState(false)
  const [isPending, startTransition] = useTransition()

  const rangeError = start > end ? 'Start date must be on or before end date.' : null

  useEffect(() => {
    if (rangeError) return
    startTransition(async () => {
      try {
        const data = await fetchHistory(start, end)
        setRows(data)
        setLoadError(false)
      } catch {
        setLoadError(true)
      }
    })
  }, [start, end, rangeError, fetchHistory])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={start}
          onChange={(e) => setRange({ start: e.target.value, end })}
          className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
        />
        <span className="text-sm text-gray-500">to</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setRange({ start, end: e.target.value })}
          className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
        />
      </div>

      {rangeError && <p className="text-sm text-red-600">{rangeError}</p>}

      {!rangeError && !loadError && isPending && rows.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      )}

      {!rangeError && loadError && (
        <p className="text-sm text-red-600 py-8 text-center">Failed to load edit history — please try again.</p>
      )}

      {!rangeError && !loadError && !isPending && rows.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">No edits found for this date range.</p>
      )}

      {!rangeError && !loadError && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Edited At</th>
                <th className="px-4 py-3 font-medium">Editor</th>
                <th className="px-4 py-3 font-medium">Entry</th>
                <th className="px-4 py-3 font-medium text-right">Target</th>
                <th className="px-4 py-3 font-medium text-right">Actual</th>
                <th className="px-4 py-3 font-medium text-right">PAX</th>
                <th className="px-4 py-3 font-medium text-right">Defects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.editId} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(row.editedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.editedByName}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.entryDate} · {row.period} · {row.stationName} · {row.modelName}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FieldValue prev={row.target.prev} new={row.target.new} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FieldValue prev={row.actual.prev} new={row.actual.new} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FieldValue prev={row.pax.prev} new={row.pax.new} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FieldValue prev={row.defects.prev} new={row.defects.new} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
