'use client'

import { NotificationsBell } from '@/app/components/notifications/notifications-bell'

interface HeaderProps {
  pageTitle?: string
  breadcrumb?: React.ReactNode
  isMobileMenuOpen?: boolean
  onMobileMenuToggle?: () => void
  isSidebarCollapsed?: boolean
  onSidebarToggle?: () => void
  userId?: string
}

export function Header({
  pageTitle = 'Dashboard',
  breadcrumb,
  isMobileMenuOpen = false,
  onMobileMenuToggle,
  isSidebarCollapsed = false,
  onSidebarToggle,
  userId,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Mobile menu | Sidebar toggle (arrow) | Module title */}
        <div className="flex items-center gap-3">
          {onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="rounded-lg p-2 text-[#1E1B4B] hover:bg-gray-100 transition-colors lg:hidden"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}

          {breadcrumb ? (
            <div className="flex items-center">{breadcrumb}</div>
          ) : (
            <h2 className="text-lg font-semibold text-[#1E1B4B]">{pageTitle}</h2>
          )}
        </div>

        <div className="flex items-center gap-3">
          {userId && (
            <div className="hidden sm:flex">
              {/* Notifications */}
              <NotificationsBell userId={userId} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
