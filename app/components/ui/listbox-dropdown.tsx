'use client'

import { useState, useEffect, useRef } from 'react'

const TRIGGER_BASE_CLASSES =
  'flex w-full items-center gap-2 text-left rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-slate-300 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 min-h-9'

export interface ListboxDropdownOption<T extends string = string> {
  value: T
  label: string
}

interface ListboxDropdownProps<T extends string = string> {
  value: T
  options: ListboxDropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  /** Optional placeholder when value is empty and no matching option (e.g. "Select...") */
  placeholder?: string
  /** Optional id for label association */
  id?: string
  /** Extra classes for the trigger button (e.g. form height) */
  className?: string
  disabled?: boolean
  searchable?: boolean
}

export function ListboxDropdown<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '',
  id,
  className = '',
  disabled = false,
  searchable = false,
}: ListboxDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedOption = options.find((opt) => opt.value === value)
  const displayLabel = selectedOption ? selectedOption.label : placeholder

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      return
    }

    if (searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`${TRIGGER_BASE_CLASSES} ${className} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className="truncate min-w-0">{displayLabel}</span>
        <svg
          className={`ml-auto h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {searchable && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-colors focus:border-[#06B6D4] focus:ring-1 focus:ring-[#06B6D4]"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          <ul role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto py-1">
            {options
              .filter((option) =>
                searchable
                  ? option.label.toLowerCase().includes(searchQuery.toLowerCase())
                  : true
              )
              .map((option) => {
                const isSelected = option.value === value
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${isSelected
                          ? 'bg-cyan-50/80 font-medium text-cyan-800'
                          : 'text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <span className="truncate min-w-0">{option.label}</span>
                      {isSelected ? (
                        <svg
                          className="ml-auto h-4 w-4 flex-shrink-0 text-cyan-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            {searchable && options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500 text-center">No options found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
