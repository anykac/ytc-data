'use client'
import { useRouter, useSearchParams } from 'next/navigation'

type Model = { id: string; name: string }

export default function ModelPicker({ models, selectedId }: { models: Model[]; selectedId: string | undefined }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('modelId', e.target.value)
    } else {
      params.delete('modelId')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <select
      value={selectedId ?? ''}
      onChange={onChange}
      className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white"
    >
      <option value="">All models</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  )
}
