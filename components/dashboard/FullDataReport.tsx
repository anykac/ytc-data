'use client'
import { useEffect, useState, useTransition } from 'react'
import type { FullDataReportRow } from '@/lib/db/dashboard'

const CSV_HEADERS = ['Date', 'Period', 'Station', 'Model', 'Target', 'Actual', 'PAX', 'Defects', 'Submitted By', 'Submitted At', 'Edited']

function currentMonthBounds() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(first), end: fmt(last) }
}

function csvEscape(value: string | number | boolean): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: FullDataReportRow[]): string {
  const lines = rows.map((row) =>
    [
      row.date,
      row.period,
      row.stationName,
      row.modelName,
      row.target,
      row.actual,
      row.pax,
      row.defects,
      row.submittedByName,
      row.createdAt,
      row.edited ? 'Yes' : 'No',
    ]
      .map(csvEscape)
      .join(',')
  )
  return [CSV_HEADERS.join(','), ...lines].join('\n')
}

function groupByDate(rows: FullDataReportRow[]): { date: string; rows: FullDataReportRow[] }[] {
  const groups: { date: string; rows: FullDataReportRow[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.date === row.date) last.rows.push(row)
    else groups.push({ date: row.date, rows: [row] })
  }
  return groups
}

type Props = {
  fetchReport: (startDate: string, endDate: string) => Promise<FullDataReportRow[]>
}

export default function FullDataReport({ fetchReport }: Props) {
  const [{ start, end }, setRange] = useState(currentMonthBounds)
  const [rows, setRows] = useState<FullDataReportRow[]>([])
  const [loadError, setLoadError] = useState(false)
  const [isPending, startTransition] = useTransition()

  const rangeError = start > end ? 'Start date must be on or before end date.' : null

  useEffect(() => {
    if (rangeError) return
    startTransition(async () => {
      try {
        const data = await fetchReport(start, end)
        setRows(data)
        setLoadError(false)
      } catch {
        setLoadError(true)
      }
    })
  }, [start, end, rangeError, fetchReport])

  function handleExportCsv() {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `full-data-report_${start}_to_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const groups = groupByDate(rows)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={rows.length === 0}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {rangeError && <p className="text-sm text-red-600">{rangeError}</p>}

      {!rangeError && !loadError && isPending && rows.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      )}

      {!rangeError && loadError && (
        <p className="text-sm text-red-600 py-8 text-center">Failed to load report — please try again.</p>
      )}

      {!rangeError && !loadError && !isPending && rows.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">No entries found for this date range.</p>
      )}

      {!rangeError && !loadError && rows.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.date} className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th colSpan={10} className="bg-gray-100 px-4 py-2 font-medium text-gray-900 text-sm">
                      {group.date}
                    </th>
                  </tr>
                  <tr>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Station</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium text-right">Target</th>
                    <th className="px-4 py-3 font-medium text-right">Actual</th>
                    <th className="px-4 py-3 font-medium text-right">PAX</th>
                    <th className="px-4 py-3 font-medium text-right">Defects</th>
                    <th className="px-4 py-3 font-medium">Submitted By</th>
                    <th className="px-4 py-3 font-medium">Submitted At</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.rows.map((row, i) => (
                    <tr key={`${group.date}-${row.period}-${i}`} className="bg-white hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{row.period}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.stationName}</td>
                      <td className="px-4 py-3 text-gray-700">{row.modelName}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.target}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.actual}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.pax}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.defects}</td>
                      <td className="px-4 py-3 text-gray-700">{row.submittedByName}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {row.edited && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            edited
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
