'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface DashboardLayoutProps {
  children: React.ReactNode
  pageTitle?: string
  userEmail?: string
  userFullName?: string
  userRole?: string
  hideHeader?: boolean
}

const SIDEBAR_STATE_KEY = 'sidebar-collapsed'

// Helper function to get initial sidebar state from localStorage
function getInitialSidebarState(): boolean {
  if (typeof window === 'undefined') {
    return false // Default to open during SSR
  }
  try {
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY)
    return savedState === 'true'
  } catch {
    return false // Default to open if localStorage is unavailable
  }
}

export function DashboardLayout({
  children,
  pageTitle,
  userEmail,
  userFullName,
  userRole,
  hideHeader = false,
}: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Initialize state from localStorage synchronously to prevent flash
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => getInitialSidebarState())
  const [isHydrated, setIsHydrated] = useState(false)

  // Mark as hydrated after first render
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Save sidebar state to localStorage whenever it changes (only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      try {
        localStorage.setItem(SIDEBAR_STATE_KEY, String(isSidebarCollapsed))
      } catch (error) {
        // Silently fail if localStorage is unavailable
        console.warn('Failed to save sidebar state to localStorage:', error)
      }
    }
  }, [isSidebarCollapsed, isHydrated])

  // Close mobile menu on navigation (but keep sidebar state for desktop)
  const handleSidebarToggle = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F3FF]">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={handleSidebarToggle}
        userEmail={userEmail}
        userFullName={userFullName}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
        {/* Header - Conditionally rendered */}
        {!hideHeader && (
          <Header
            pageTitle={pageTitle}
            isMobileMenuOpen={isMobileMenuOpen}
            onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            isSidebarCollapsed={isSidebarCollapsed}
            onSidebarToggle={() => handleSidebarToggle(!isSidebarCollapsed)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-4 lg:p-6">
          <div className="h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}

