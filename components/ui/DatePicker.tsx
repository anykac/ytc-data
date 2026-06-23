'use client'
import { useRouter } from 'next/navigation'

export default function DatePicker({ value }: { value: string }) {
  const router = useRouter()
  return (
    <input
      type="date"
      defaultValue={value}
      className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
      onChange={(e) => router.push(`?date=${e.target.value}`)}
    />
  )
}
