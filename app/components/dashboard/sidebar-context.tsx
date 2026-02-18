'use client'

import { createContext, useContext } from 'react'

interface SidebarContextValue {
  isSidebarCollapsed: boolean
  onSidebarToggle: () => void
  isMobileMenuOpen: boolean
  onMobileMenuToggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  return ctx
}

export function SidebarProvider({
  isSidebarCollapsed,
  onSidebarToggle,
  isMobileMenuOpen,
  onMobileMenuToggle,
  children,
}: SidebarContextValue & { children: React.ReactNode }) {
  return (
    <SidebarContext.Provider
      value={{
        isSidebarCollapsed,
        onSidebarToggle,
        isMobileMenuOpen,
        onMobileMenuToggle,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

const btnClass =
  'flex h-10 w-10 min-w-[40px] min-h-[40px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#06B6D4] transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 flex-shrink-0'

/** Top bar button: mobile = open/close menu. Desktop/webview intentionally hides this control. */
export function SidebarToggleButton() {
  const ctx = useSidebar()
  if (!ctx) return null

  const { isMobileMenuOpen, onMobileMenuToggle } = ctx

  return (
    <button
      type="button"
      onClick={onMobileMenuToggle}
      className={`lg:hidden ${btnClass}`}
      aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
      title={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
    >
      {isMobileMenuOpen ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  )
}
