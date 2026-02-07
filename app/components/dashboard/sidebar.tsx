'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { logout } from '@/lib/auth/actions'
import { canReadModule, MODULE_PERMISSION_IDS, ModulePermissions } from '@/lib/permissions'

interface SidebarProps {
  isMobileOpen: boolean
  setIsMobileOpen: (open: boolean) => void
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  userEmail?: string
  userFullName?: string
  userRole?: string
  modulePermissions?: ModulePermissions
}

const SETTINGS_HREF = '/dashboard/settings'

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { name: 'Leads', href: '/dashboard/leads', icon: LeadsIcon, moduleId: MODULE_PERMISSION_IDS.leads },
  { name: 'Clients', href: '/dashboard/clients', icon: ClientsIcon, moduleId: MODULE_PERMISSION_IDS.clients },
  { name: 'Projects', href: '/dashboard/projects', icon: ProjectsIcon, moduleId: MODULE_PERMISSION_IDS.projects },
  { name: 'Users', href: '/dashboard/users', icon: UsersIcon, moduleId: MODULE_PERMISSION_IDS.users },
  { name: 'Logs', href: '/dashboard/logs', icon: LogsIcon, moduleId: MODULE_PERMISSION_IDS.logs },
  {
    name: 'Settings',
    href: SETTINGS_HREF,
    icon: SettingsIcon,
    moduleId: MODULE_PERMISSION_IDS.settings,
    children: [{ name: 'Technology & Tools', href: SETTINGS_HREF }],
  },
]

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function LeadsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function ClientsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function ProjectsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function LogsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export function Sidebar({
  isMobileOpen,
  setIsMobileOpen,
  isCollapsed,
  setIsCollapsed,
  userEmail,
  userFullName,
  userRole,
  modulePermissions,
}: SidebarProps) {
  const pathname = usePathname()
  const [isProfileExpanded, setIsProfileExpanded] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)

  // Keep Settings expanded when on a settings route
  useEffect(() => {
    if (pathname?.startsWith(SETTINGS_HREF)) {
      setIsSettingsExpanded(true)
    }
  }, [pathname])

  // Close profile and settings when sidebar collapses
  useEffect(() => {
    if (isCollapsed) {
      setIsProfileExpanded(false)
      setIsSettingsExpanded(false)
    }
  }, [isCollapsed])

  // Get user initials for avatar
  const getInitials = () => {
    if (userFullName) {
      const names = userFullName.split(' ')
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      }
      return userFullName.substring(0, 2).toUpperCase()
    }
    if (userEmail) {
      return userEmail.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-40 h-full bg-white shadow-lg transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
          overflow-hidden
        `}
      >
        {/* Curved Top Edge - Decorative Element */}
        <div className="absolute top-0 left-0 right-0 h-12 overflow-hidden pointer-events-none">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-r from-[#06B6D4]/20 to-[#0891b2]/20 blur-2xl"></div>
          <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#06B6D4]/5 to-transparent"></div>
        </div>

        <div className="flex h-full flex-col relative">
          {/* Logo Section - Colored Box */}
          <div className={`transition-all duration-300 ${isCollapsed ? 'mx-2 mt-2' : 'mx-4 mt-4'}`}>
            <div className="rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#0891b2] shadow-md shadow-[#06B6D4]/20 p-4">
              <div className={`flex items-center justify-between transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}>
                <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  {!isCollapsed && (
                    <h1 className="text-lg font-bold text-white whitespace-nowrap">CRM Pro</h1>
                  )}
                </div>
                {/* Top Collapse Arrow - Only show when expanded */}
                {!isCollapsed && (
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 flex-shrink-0"
                    aria-label="Collapse sidebar"
                    data-tooltip="Collapse"
                  >
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className={`flex-1 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'px-2 py-4' : 'px-4 py-6'} scrollbar-hide`}>
            <ul className="space-y-2">
              {menuItems.filter(item => {
                if (!item.moduleId) return true
                if (item.moduleId === MODULE_PERMISSION_IDS.projects) {
                  return (
                    userRole === 'admin' ||
                    userRole === 'manager' ||
                    userRole === 'staff' ||
                    canReadModule({ role: userRole, modulePermissions }, item.moduleId)
                  )
                }
                return canReadModule({ role: userRole, modulePermissions }, item.moduleId)
              }).map((item) => {
                const hasChildren = 'children' in item && item.children && item.children.length > 0
                const Icon = item.icon

                // Expandable item (Settings): show toggle + sub-items when expanded. Only highlight parent when no child is active.
                if (hasChildren && !isCollapsed) {
                  const isAnyChildActive = item.children?.some(
                    (c) => pathname === c.href || pathname?.startsWith(c.href + '/')
                  )
                  const isParentActive =
                    (pathname === item.href || pathname?.startsWith(item.href + '/')) && !isAnyChildActive
                  return (
                    <li key={item.href}>
                      <button
                        type="button"
                        onClick={() => setIsSettingsExpanded((prev) => !prev)}
                        className={`
                          group relative flex w-full items-center rounded-xl text-sm font-medium transition-all duration-200
                          gap-3 px-4 py-3.5 text-left
                          ${isParentActive
                            ? 'bg-[#06B6D4]/10 text-[#06B6D4] shadow-sm'
                            : 'text-[#1E1B4B] hover:bg-[#06B6D4]/5'
                          }
                        `}
                      >
                        {isParentActive && (
                          <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#06B6D4]"></span>
                        )}
                        <span
                          className={`flex-shrink-0 ${isParentActive ? 'text-[#06B6D4]' : 'text-gray-500 group-hover:text-[#06B6D4]'}`}
                        >
                          <Icon />
                        </span>
                        <span className="whitespace-nowrap font-medium flex-1">{item.name}</span>
                        <svg
                          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isSettingsExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isSettingsExpanded && item.children && (
                        <ul className="mt-1 ml-4 space-y-1 border-l-2 border-slate-100 pl-3">
                          {item.children.map((child) => {
                            const isChildActive = pathname === child.href || pathname?.startsWith(child.href + '/')
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={() => {
                                    if (window.innerWidth < 1024) setIsMobileOpen(false)
                                  }}
                                  className={`
                                    group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                                    ${isChildActive
                                      ? 'bg-[#06B6D4]/10 text-[#06B6D4]'
                                      : 'text-slate-600 hover:bg-[#06B6D4]/5 hover:text-[#06B6D4]'
                                    }
                                  `}
                                >
                                  <span className="whitespace-nowrap">{child.name}</span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                }

                // Collapsed sidebar: Settings as single link (no sub-menu)
                if (hasChildren && isCollapsed) {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (window.innerWidth < 1024) setIsMobileOpen(false)
                        }}
                        className={`
                          group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200
                          justify-center px-2 py-3.5
                          ${isActive ? 'bg-[#06B6D4]/10 text-[#06B6D4] shadow-sm' : 'text-[#1E1B4B] hover:bg-[#06B6D4]/5'}
                        `}
                      >
                        <span className={`flex-shrink-0 ${isActive ? 'text-[#06B6D4]' : 'text-gray-500 group-hover:text-[#06B6D4]'}`}>
                          <Icon />
                        </span>
                        <span className="absolute left-full ml-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-900 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-gray-900">
                          {item.name}
                        </span>
                      </Link>
                    </li>
                  )
                }

                // Regular item (no children)
                let isActive = false
                if (item.href === '/dashboard') {
                  isActive = pathname === '/dashboard'
                } else {
                  isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024) setIsMobileOpen(false)
                      }}
                      className={`
                        group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200
                        ${isCollapsed ? 'justify-center px-2 py-3.5' : 'gap-3 px-4 py-3.5'}
                        ${isActive
                          ? 'bg-[#06B6D4]/10 text-[#06B6D4] shadow-sm'
                          : 'text-[#1E1B4B] hover:bg-[#06B6D4]/5'
                        }
                      `}
                    >
                      {isActive && !isCollapsed && (
                        <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#06B6D4]"></span>
                      )}
                      <span
                        className={`
                          flex items-center justify-center flex-shrink-0
                          ${isActive ? 'text-[#06B6D4]' : 'text-gray-500 group-hover:text-[#06B6D4]'}
                        `}
                      >
                        <Icon />
                      </span>
                      {!isCollapsed && (
                        <span className="whitespace-nowrap font-medium">{item.name}</span>
                      )}
                      {isCollapsed && (
                        <span className="absolute left-full ml-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-900 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-gray-900">
                          {item.name}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Bottom Toggle Button - Desktop Only - Only show when collapsed */}
          {isCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              className="
                absolute bottom-20 left-1/2 -translate-x-1/2
                h-9 w-9
                flex items-center justify-center
                rounded-lg
                bg-[#06B6D4]/10
                text-[#06B6D4]
                hover:bg-[#06B6D4]/20
                transition-all duration-200
                hidden lg:flex
                shadow-sm
                border border-[#06B6D4]/20
              "
              aria-label="Expand sidebar"
              data-tooltip="Expand"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Bottom Section - Enhanced Profile Section */}
          <div className={`border-t border-gray-100 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-3'}`}>
            {isCollapsed ? (
              /* Collapsed - Logout Button Directly */
              <form action={logout}>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center justify-center rounded-xl bg-red-500 px-2 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 active:bg-red-700 shadow-sm"
                  aria-label="Logout"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </form>
            ) : (
              /* Expanded Profile Section */
              <div className="space-y-2">
                {/* MY PROFILE Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Profile</h3>
                </div>

                {/* Profile Card */}
                <div className="relative rounded-xl bg-gray-50/80 border border-gray-100 p-2.5">
                  {/* Profile Picture & Info */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-[#06B6D4] to-[#0891b2] text-sm font-semibold text-white shadow-md flex-shrink-0">
                      {getInitials()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1E1B4B] truncate">
                        {userFullName || userEmail || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'}
                      </p>
                    </div>
                    {/* Dropdown Arrow - Changes direction based on expanded state */}
                    <button
                      onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                      className="p-1 rounded-lg hover:bg-gray-100 transition-colors duration-200 flex-shrink-0"
                      aria-label="Toggle profile"
                    >
                      <svg
                        className={`h-4 w-4 text-green-500 transition-transform duration-200 ${isProfileExpanded ? 'rotate-180' : ''
                          }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Logout Button - Shown when expanded */}
                  {isProfileExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 active:bg-red-700 shadow-sm"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[#1E1B4B]">Confirm Logout</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to logout? You will need to login again to access your account.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <form action={logout} className="flex-1">
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600 active:bg-red-700 transition-colors duration-200 shadow-sm"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
