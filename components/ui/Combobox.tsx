'use client'
import { useState, useRef, useEffect } from 'react'

type Option = { id: string; label: string }

interface ComboboxProps {
  options: Option[]
  value: string | undefined
  onChange: (id: string | undefined) => void
  placeholder: string
  className?: string
}

export default function Combobox({ options, value, onChange, placeholder, className }: ComboboxProps) {
  const selected = options.find((o) => o.id === value)
  const [query, setQuery] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query === ''
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  // Close when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Sync input text when selected value changes externally (e.g. order change clears model)
  useEffect(() => {
    setQuery(selected?.label ?? '')
  }, [selected])

  function select(option: Option | undefined) {
    onChange(option?.id)
    setQuery(option?.label ?? '')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="border rounded px-3 py-1.5 text-sm text-gray-900 bg-white w-44 outline-none focus:ring-2 focus:ring-blue-300"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full min-w-max bg-white border rounded shadow-lg max-h-52 overflow-auto text-sm">
          <li
            onMouseDown={() => select(undefined)}
            className="px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-400 italic"
          >
            {placeholder}
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">No results</li>
          ) : (
            filtered.map((o) => (
              <li
                key={o.id}
                onMouseDown={() => select(o)}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${o.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-900'}`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
