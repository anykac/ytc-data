'use client'

type Column<T> = { key: keyof T; label: string }

type CrudTableProps<T extends { id: string; active?: boolean }> = {
  columns: Column<T>[]
  rows: T[]
  onEdit: (row: T) => void
  onToggleActive: (row: T) => void
}

export default function CrudTable<T extends { id: string; active?: boolean }>({
  columns,
  rows,
  onEdit,
  onToggleActive,
}: CrudTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No records yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="px-4 py-3 font-medium">{col.label}</th>
            ))}
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className={`bg-white hover:bg-gray-50 ${row.active === false ? 'opacity-50' : ''}`}>
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3 text-gray-800">
                  {col.key === 'active'
                    ? (row[col.key] ? 'Active' : 'Inactive')
                    : String(row[col.key] ?? '')}
                </td>
              ))}
              <td className="px-4 py-3 text-right space-x-2">
                <button
                  onClick={() => onEdit(row)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => onToggleActive(row)}
                  className={`text-xs font-medium ${row.active === false ? 'text-green-600 hover:text-green-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {row.active === false ? 'Activate' : 'Deactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
