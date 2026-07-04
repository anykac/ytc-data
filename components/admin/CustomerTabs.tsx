'use client'

type Customer = { id: string; name: string }

export default function CustomerTabs({ customers, selectedId, onSelect }: {
  customers: Customer[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-2 border-b border-gray-200">
      {customers.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer ${
            selectedId === c.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
