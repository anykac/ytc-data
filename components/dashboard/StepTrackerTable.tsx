'use client'
import { useState } from 'react'
import type { StepTrackerRow } from '@/lib/db/order-model-tracker'
import StepOutputChart from './StepOutputChart'

type Props = {
  rows: StepTrackerRow[]
  modelId: string
}

export default function StepTrackerTable({ rows, modelId }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-none w-[520px]">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Step</th>
                <th className="px-4 py-3 font-medium text-right">Cumulative Output</th>
                <th className="px-4 py-3 font-medium text-right">Active Inputs</th>
                <th className="px-4 py-3 font-medium text-right">Order Attainment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr
                  key={row.stationId}
                  onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
                  className={`cursor-pointer transition-colors ${
                    selectedIdx === i
                      ? 'bg-blue-50 border-l-2 border-blue-500'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.stationName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {row.cumulativeOutput.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {i === 0 ? '—' : row.activeInputs.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    row.attainmentPct === null ? 'text-gray-400' :
                    row.attainmentPct >= 100 ? 'text-green-600' :
                    row.attainmentPct >= 75 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {row.attainmentPct === null ? '—' : `${row.attainmentPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedIdx !== null && (
          <p className="text-xs text-gray-400 mt-2 px-1">
            Click the same row again to dismiss the chart.
          </p>
        )}
      </div>

      {selectedIdx !== null && (
        <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-200 p-4">
          <StepOutputChart
            modelId={modelId}
            stationId={rows[selectedIdx].stationId}
            prevStationId={selectedIdx > 0 ? rows[selectedIdx - 1].stationId : null}
            stationName={rows[selectedIdx].stationName}
          />
        </div>
      )}
    </div>
  )
}
