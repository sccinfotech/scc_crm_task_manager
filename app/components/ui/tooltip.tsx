'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
    content: string
    children: React.ReactNode
    position?: 'top' | 'bottom' | 'left' | 'right'
    wrapperClassName?: string
}

export function Tooltip({ children, content, position = 'top', wrapperClassName = '' }: TooltipProps) {
    const [active, setActive] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const targetRef = useRef<HTMLDivElement>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const updateCoords = () => {
        if (targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect()
            const scrollY = window.scrollY
            const scrollX = window.scrollX

            let top = 0
            let left = 0

            switch (position) {
                case 'top':
                    top = rect.top + scrollY - 10
                    left = rect.left + scrollX + rect.width / 2
                    break
                case 'bottom':
                    top = rect.bottom + scrollY + 10
                    left = rect.left + scrollX + rect.width / 2
                    break
                case 'left':
                    top = rect.top + scrollY + rect.height / 2
                    left = rect.left + scrollX - 10
                    break
                case 'right':
                    top = rect.top + scrollY + rect.height / 2
                    left = rect.right + scrollX + 10
                    break
            }

            setCoords({ top, left })
        }
    }

    const showTooltip = () => {
        updateCoords()
        setActive(true)
    }

    const hideTooltip = () => {
        setActive(false)
    }

    return (
        <div
            ref={targetRef}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            className={`inline-block ${wrapperClassName}`.trim()}
        >
            {children}
            {mounted && active && createPortal(
                <div
                    className={`fixed z-[9999] pointer-events-none transition-all duration-200 transform
            ${position === 'top' ? '-translate-x-1/2 -translate-y-full' : ''}
            ${position === 'bottom' ? '-translate-x-1/2' : ''}
            ${position === 'left' ? '-translate-x-full -translate-y-1/2' : ''}
            ${position === 'right' ? '-translate-y-1/2' : ''}
          `}
                    style={{
                        top: coords.top,
                        left: coords.left,
                    }}
                >
                    {/* Tooltip Box */}
                    <div className="bg-[#0F172A] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/50 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                        {content}
                    </div>

                    {/* Arrow */}
                    <div
                        className={`absolute w-0 h-0 border-solid
              ${position === 'top' ? 'left-1/2 -translate-x-1/2 top-full border-t-[#0F172A] border-l-transparent border-r-transparent border-b-transparent border-[5px]' : ''}
              ${position === 'bottom' ? 'left-1/2 -translate-x-1/2 bottom-full border-b-[#0F172A] border-l-transparent border-r-transparent border-t-transparent border-[5px]' : ''}
              ${position === 'left' ? 'top-1/2 -translate-y-1/2 left-full border-l-[#0F172A] border-t-transparent border-b-transparent border-r-transparent border-[5px]' : ''}
              ${position === 'right' ? 'top-1/2 -translate-y-1/2 right-full border-r-[#0F172A] border-t-transparent border-b-transparent border-l-transparent border-[5px]' : ''}
            `}
                    />
                </div>,
                document.body
            )}
        </div>
    )
}
