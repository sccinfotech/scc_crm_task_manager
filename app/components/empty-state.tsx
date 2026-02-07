'use client'

import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'leads' | 'projects' | 'followups' | 'search' | 'users'
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  const defaultIcons = {
    leads: (
      <svg
        className="w-24 h-24 sm:w-32 sm:h-32 text-[#06B6D4]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    projects: (
      <svg
        className="w-24 h-24 sm:w-32 sm:h-32 text-[#06B6D4]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
    followups: (
      <svg
        className="w-24 h-24 sm:w-32 sm:h-32 text-[#06B6D4]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    users: (
      <svg
        className="w-24 h-24 sm:w-32 sm:h-32 text-[#6366F1]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    search: (
      <svg
        className="w-24 h-24 sm:w-32 sm:h-32 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
    default: (
      <svg
        className="w-24 h-24 sm:w-32 sm:h-32 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
    ),
  }

  const displayIcon = icon || defaultIcons[variant]

  return (
    <div className="flex flex-col items-center justify-center w-full py-8 px-4 sm:py-12">
      {/* Animated Icon Container */}
      <div className="relative mb-6">
        {/* Floating background circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-[#06B6D4]/10 to-[#7C3AED]/10 animate-pulse"></div>
          <div className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#06B6D4]/20 to-[#7C3AED]/20 animate-ping"></div>
        </div>

        {/* Icon with animation */}
        <div className="relative transform transition-all duration-500 hover:scale-110 animate-bounce-slow">
          {displayIcon}
        </div>
      </div>

      {/* Content */}
      <div className="text-center max-w-md mx-auto space-y-3">
        <h3 className="text-xl sm:text-2xl font-bold text-[#1E1B4B] animate-fade-in">
          {title}
        </h3>
        {description && (
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed animate-fade-in-delay">
            {description}
          </p>
        )}
      </div>

      {/* Action Button */}
      {actionLabel && onAction && (
        <div className="mt-8 animate-fade-in-delay-2">
          <button
            onClick={onAction}
            className="btn-gradient-smooth rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}
