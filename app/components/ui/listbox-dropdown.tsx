'use client'

import { useState, useEffect, useRef } from 'react'

const TRIGGER_BASE_CLASSES =
  'flex w-full items-center gap-2 text-left rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-slate-300 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 min-h-9'

export interface ListboxDropdownOption {
  value: string
  label: string
}

interface ListboxDropdownProps {
  value: string
  options: ListboxDropdownOption[]
  onChange: (value: string) => void
  ariaLabel: string
  /** Optional placeholder when value is empty and no matching option (e.g. "Select...") */
  placeholder?: string
  /** Optional id for label association */
  id?: string
  /** Extra classes for the trigger button (e.g. form height) */
  className?: string
  disabled?: boolean
}

export function ListboxDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '',
  id,
  className = '',
  disabled = false,
}: ListboxDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((opt) => opt.value === value)
  const displayLabel = selectedOption ? selectedOption.label : placeholder

  useEffect(() => {
    if (!open) return

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
        <div className="absolute left-0 top-full z-40 mt-1 min-w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <ul role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
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
          </ul>
        </div>
      )}
    </div>
  )
}
