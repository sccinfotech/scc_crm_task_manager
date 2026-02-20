'use client'

import { useState, useSyncExternalStore } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { ModulePermissions } from '@/lib/permissions'

interface DashboardLayoutProps {
  children: React.ReactNode
  pageTitle?: string
  breadcrumb?: React.ReactNode
  userEmail?: string
  userFullName?: string
  userRole?: string
  modulePermissions?: ModulePermissions
  hideHeader?: boolean
}

const SIDEBAR_STATE_KEY = 'sidebar-collapsed'
const SIDEBAR_STATE_EVENT = 'sidebar-collapsed-change'

function getServerSidebarState(): boolean {
  return false
}

function getClientSidebarState(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_STATE_KEY) === 'true'
  } catch {
    return false
  }
}

function subscribeSidebarState(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_STATE_KEY) {
      callback()
    }
  }
  const onLocalChange = () => callback()

  window.addEventListener('storage', onStorage)
  window.addEventListener(SIDEBAR_STATE_EVENT, onLocalChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SIDEBAR_STATE_EVENT, onLocalChange)
  }
}

function setClientSidebarState(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed))
    window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT))
  } catch (error) {
    // Silently fail if localStorage is unavailable
    console.warn('Failed to save sidebar state to localStorage:', error)
  }
}

export function DashboardLayout({
  children,
  pageTitle,
  breadcrumb,
  userEmail,
  userFullName,
  userRole,
  modulePermissions,
  hideHeader = false,
}: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isSidebarCollapsed = useSyncExternalStore(
    subscribeSidebarState,
    getClientSidebarState,
    getServerSidebarState
  )

  // Close mobile menu on navigation (but keep sidebar state for desktop)
  const handleSidebarToggle = (collapsed: boolean) => {
    setClientSidebarState(collapsed)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={handleSidebarToggle}
        userEmail={userEmail}
        userFullName={userFullName}
        userRole={userRole}
        modulePermissions={modulePermissions}
      />

      {/* Main Content Area */}
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
        {/* Header - Conditionally rendered */}
        {!hideHeader && (
          <Header
            pageTitle={pageTitle}
            breadcrumb={breadcrumb}
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
