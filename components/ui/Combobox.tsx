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
  // Always-fresh snapshot so the outside-click/blur handlers below (registered once,
  // or deferred a tick) never resync against a stale `options`/`value` closure.
  const latestRef = useRef({ options, value })
  useEffect(() => {
    latestRef.current = { options, value }
  })

  // Show the full list until the displayed text actually diverges from the current
  // selection (or is empty) — otherwise reopening a filled-in box would filter down
  // to just the one already-selected option instead of letting you browse everything.
  const filtered = (query === '' || query === selected?.label)
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  function resyncQuery() {
    const { options, value } = latestRef.current
    setQuery(options.find((o) => o.id === value)?.label ?? '')
  }

  // Close when clicking outside, discarding any typed-but-unselected text so the
  // box never displays something other than what was actually committed via onChange.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        resyncQuery()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Sync input text when the selected ID changes externally (e.g. order change clears model).
  // Depend on `value` (stable prop) not `selected` (new object reference each render).
  useEffect(() => {
    setQuery(options.find((o) => o.id === value)?.label ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function select(option: Option | undefined) {
    onChange(option?.id)
    setQuery(option?.label ?? '')
    setOpen(false)
  }

  function handleBlur() {
    // Deferred: a mousedown-driven option `select()` runs synchronously before blur
    // fires, so this needs to run after that settles (covers keyboard tab-away, which
    // the outside-mousedown listener above doesn't catch).
    setTimeout(() => {
      setOpen(false)
      resyncQuery()
    }, 0)
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? 'w-44'}`}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white w-full outline-none focus:ring-2 focus:ring-blue-300"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full min-w-max bg-white border border-gray-300 rounded-lg shadow-lg max-h-52 overflow-auto text-sm">
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
