'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

/** Matches standard form inputs (rounded-xl, padding, focus ring) across dashboard forms. */
const TRIGGER_BASE_CLASSES =
  'flex w-full items-center gap-2 text-left rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 min-h-[2.75rem]'

export interface ListboxDropdownOption<T extends string = string> {
  value: T
  label: string
  /** Optional secondary line (e.g. HSN description); included in search when searchable */
  detail?: string
}

interface ListboxDropdownProps<T extends string = string> {
  value: T
  options: ListboxDropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  /** Optional placeholder when value is empty and no matching option (e.g. "Select...") */
  placeholder?: string
  /** Optional placeholder for the search input (when searchable) */
  searchPlaceholder?: string
  /** Optional id for label association */
  id?: string
  /** Extra classes for the trigger button (e.g. form height) */
  className?: string
  disabled?: boolean
  searchable?: boolean
  /** Render the options panel in a portal to avoid overflow clipping. */
  portal?: boolean
}

export function ListboxDropdown<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = '',
  searchPlaceholder = 'Search...',
  id,
  className = '',
  disabled = false,
  searchable = false,
  portal = true,
}: ListboxDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedOption = options.find((opt) => opt.value === value)
  const displayLabel = selectedOption ? selectedOption.label : placeholder
  const triggerTitle =
    selectedOption && selectedOption.detail
      ? `${selectedOption.label}\n${selectedOption.detail}`
      : selectedOption?.label || undefined

  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const updatePanelPosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const margin = 6
    const maxHeight = 224 // matches max-h-56
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let left = rect.left
    let top = rect.bottom + margin
    const width = rect.width

    // Keep within viewport horizontally
    if (left + width > viewportW - 8) {
      left = Math.max(8, viewportW - width - 8)
    }
    if (left < 8) left = 8

    // If not enough space below, open upwards
    const neededH = Math.min(maxHeight, 8 + 36 * Math.min(6, options.length)) + (searchable ? 48 : 0)
    if (top + neededH > viewportH - 8) {
      const upTop = rect.top - margin - neededH
      if (upTop >= 8) {
        top = upTop
      }
    }

    setPanelStyle({
      position: 'fixed',
      left,
      top,
      width,
      zIndex: 9999,
    })
  }

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
      const inTrigger = triggerRef.current?.contains(target) ?? false
      const inDropdownShell = dropdownRef.current?.contains(target) ?? false
      const inPanel = panelRef.current?.contains(target) ?? false
      if (!inTrigger && !inDropdownShell && !inPanel) setOpen(false)
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
  }, [open, searchable])

  useLayoutEffect(() => {
    if (!open) return
    if (!portal) return
    updatePanelPosition()

    const onScroll = () => updatePanelPosition()
    const onResize = () => updatePanelPosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, portal, options.length, searchable])

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!searchable || !q) return options
    return options.filter((option) => {
      const hay = `${option.label} ${option.detail ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, searchable, searchQuery])

  const panel = (
    <div
      ref={panelRef}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      style={portal && panelStyle ? panelStyle : undefined}
    >
      {searchable && (
        <div className="p-2 border-b border-slate-100">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none transition-colors focus:border-[#06B6D4] focus:ring-1 focus:ring-[#06B6D4]"
              placeholder={searchPlaceholder}
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
        {filteredOptions.map((option) => {
          const isSelected = option.value === value
          return (
            <li key={option.value} role="option" aria-selected={isSelected}>
              <button
                type="button"
                title={option.detail ? `${option.label}\n${option.detail}` : option.label}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isSelected ? 'bg-cyan-50/80 font-medium text-cyan-800' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-snug">{option.label}</span>
                  {option.detail ? (
                    <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500 line-clamp-3">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
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
        {searchable && filteredOptions.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500 text-center">No options found</li>
        )}
      </ul>
    </div>
  )

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={triggerTitle}
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
        portal && portalReady && panelStyle
          ? createPortal(panel, document.body)
          : <div className="absolute left-0 top-full z-40 mt-1 min-w-full">{panel}</div>
      )}
    </div>
  )
}
