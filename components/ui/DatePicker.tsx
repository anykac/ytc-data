'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function DatePicker({ value }: { value: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', e.target.value)
    router.push(`?${params.toString()}`)
  }

  return (
    <input
      type="date"
      defaultValue={value}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white cursor-pointer"
      onChange={onChange}
    />
  )
}
