'use client'

interface HeaderProps {
  pageTitle?: string
  breadcrumb?: React.ReactNode
  isMobileMenuOpen?: boolean
  onMobileMenuToggle?: () => void
  isSidebarCollapsed?: boolean
  onSidebarToggle?: () => void
}

export function Header({
  pageTitle = 'Dashboard',
  breadcrumb,
  isMobileMenuOpen = false,
  onMobileMenuToggle,
  isSidebarCollapsed = false,
  onSidebarToggle,
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

          {/* Sidebar collapse/expand arrow - left of module title, desktop only */}
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="hidden lg:flex h-10 w-10 min-w-[40px] min-h-[40px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#06B6D4] transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          )}

          {breadcrumb ? (
            <div className="flex items-center">{breadcrumb}</div>
          ) : (
            <h2 className="text-lg font-semibold text-[#1E1B4B]">{pageTitle}</h2>
          )}
        </div>
      </div>
    </header>
  )
}

