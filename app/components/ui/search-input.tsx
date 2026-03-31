'use client'

import { useState, useEffect, useRef } from 'react'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    inputClassName?: string
    debounceMs?: number
    minLength?: number
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className = '',
    inputClassName = '',
    debounceMs = 350,
    minLength = 0,
}: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value)
    const lastFiredValue = useRef(value)
    const isInitialMount = useRef(true)

    // Sync with external value changes (e.g. Clear Filters)
    // We ONLY sync if the incoming value is different from the last value we fired.
    // This prevents the "feedback loop" where the URL update overwrites the user's current typing.
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        if (value !== lastFiredValue.current) {
            setLocalValue(value)
            lastFiredValue.current = value
        }
    }, [value])

    // Debounce logic
    useEffect(() => {
        const timer = setTimeout(() => {
            // Don't fire if nothing changed relative to what we last sent
            if (localValue === lastFiredValue.current) return

            const shouldSearch = localValue.length >= minLength || localValue === ''
            if (shouldSearch) {
                lastFiredValue.current = localValue
                onChange(localValue)
            }
        }, debounceMs)

        return () => clearTimeout(timer)
    }, [localValue, onChange, debounceMs, minLength])

    return (
        <div className={`relative ${className}`}>
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
            </div>
            <input
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder={placeholder}
                className={`block w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-[#1E1B4B] placeholder-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/20 min-h-9 ${inputClassName}`}
            />
        </div>
    )
}
