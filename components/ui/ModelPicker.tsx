'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Combobox from './Combobox'

type Model = { id: string; name: string }

export default function ModelPicker({ models, selectedId }: { models: Model[]; selectedId: string | undefined }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(id: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) { params.set('modelId', id) } else { params.delete('modelId') }
    router.push(`?${params.toString()}`)
  }

  return (
    <Combobox
      options={models.map((m) => ({ id: m.id, label: m.name }))}
      value={selectedId}
      onChange={onChange}
      placeholder="All models"
    />
  )
}
