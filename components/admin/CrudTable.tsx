'use client'
import { useState } from 'react'

type Column<T> = { key: keyof T; label: string }

type CrudTableProps<T extends { id: string; active?: boolean }> = {
  columns: Column<T>[]
  rows: T[]
  onEdit: (row: T) => void
  onToggleActive: (row: T) => void
  onDelete?: (row: T) => void
  onReorder?: (draggedId: string, targetId: string) => void
  activateLabel?: string
  deactivateLabel?: string
}

export default function CrudTable<T extends { id: string; active?: boolean }>({
  columns,
  rows,
  onEdit,
  onToggleActive,
  onDelete,
  onReorder,
  activateLabel = 'Activate',
  deactivateLabel = 'Deactivate',
}: CrudTableProps<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No records yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-left">
          <tr>
            {onReorder && <th className="px-2 py-3 w-8" />}
            {columns.map((col) => (
              <th key={String(col.key)} className="px-4 py-3 font-medium">{col.label}</th>
            ))}
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`bg-white hover:bg-gray-50 ${row.active === false ? 'opacity-50' : ''} ${draggedId === row.id ? 'opacity-40' : ''}`}
              draggable={!!onReorder}
              onDragStart={onReorder ? () => setDraggedId(row.id) : undefined}
              onDragOver={onReorder ? (e) => e.preventDefault() : undefined}
              onDrop={onReorder && draggedId && draggedId !== row.id
                ? () => { onReorder(draggedId, row.id); setDraggedId(null) }
                : undefined}
              onDragEnd={onReorder ? () => setDraggedId(null) : undefined}
            >
              {onReorder && (
                <td className="px-2 py-3 text-gray-300 cursor-grab select-none text-center">⠿</td>
              )}
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
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => onToggleActive(row)}
                  className={`text-xs font-medium cursor-pointer ${row.active === false ? 'text-green-600 hover:text-green-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {row.active === false ? activateLabel : deactivateLabel}
                </button>
                {onDelete && row.active === false && (
                  <button
                    onClick={() => onDelete(row)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
