'use client'
import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { fetchStepPeriodData } from '@/actions/dashboard'
import type { StepPeriodPoint } from '@/lib/db/order-model-tracker'

type Props = {
  modelId: string
  stationId: string
  prevStationId: string | null
  stationName: string
}

export default function StepOutputChart({ modelId, stationId, prevStationId, stationName }: Props) {
  const [data, setData] = useState<StepPeriodPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchStepPeriodData(modelId, stationId, prevStationId)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load chart data'))
      .finally(() => setLoading(false))
  }, [modelId, stationId, prevStationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        Loading chart…
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-red-500">{error}</div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        No production data for this step yet.
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-4">{stationName} — Output over time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 48, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            interval="preserveStartEnd"
          />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={40} />
          <Tooltip />
          <Legend verticalAlign="top" height={28} />
          <Bar yAxisId="left" dataKey="periodOutput" name="Period output" fill="#60a5fa" />
          <Bar yAxisId="left" dataKey="activeInputs" name="Active inputs (WIP)" fill="#34d399" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulativeOutput"
            name="Cumulative output"
            stroke="#1d4ed8"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
