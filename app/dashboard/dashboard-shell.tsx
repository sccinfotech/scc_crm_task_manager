'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/app/components/dashboard/sidebar';
import { Header } from '@/app/components/dashboard/header';
import type { ModulePermissions } from '@/lib/permissions';

interface DashboardShellProps {
    children: React.ReactNode;
    userEmail?: string;
    userFullName?: string;
    userRole?: string;
    modulePermissions?: ModulePermissions;
}

const SIDEBAR_STATE_KEY = 'sidebar-collapsed';

function getInitialSidebarState(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function DashboardShell({
    children,
    userEmail,
    userFullName,
    userRole,
    modulePermissions,
}: DashboardShellProps) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => getInitialSidebarState());
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') {
            localStorage.setItem(SIDEBAR_STATE_KEY, String(isSidebarCollapsed));
        }
    }, [isSidebarCollapsed, isHydrated]);

    // Pages that render their own in-content headers or intentionally hide the global header
    // For these pages, we hide the global header to prevent duplicates or flickering
    const hideGlobalHeader =
        pathname === '/dashboard/leads' ||
        pathname === '/dashboard/users' ||
        pathname === '/dashboard/clients' ||
        pathname === '/dashboard/projects' ||
        pathname === '/dashboard/settings' ||
        pathname?.startsWith('/dashboard/leads/') || // lead detail page also has custom header
        pathname?.startsWith('/dashboard/clients/') || // client detail page also has custom header
        pathname?.startsWith('/dashboard/projects/') ||
        pathname?.startsWith('/dashboard/settings/'); // settings subpages

    const getTitle = () => {
        if (pathname?.includes('clients')) return 'Clients';
        if (pathname?.includes('projects')) return 'Projects';
        if (pathname?.includes('logs')) return 'Logs';
        if (pathname?.includes('settings')) return 'Settings';
        return 'Dashboard';
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--background)]">
            <Sidebar
                isMobileOpen={isMobileMenuOpen}
                setIsMobileOpen={setIsMobileMenuOpen}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                userEmail={userEmail}
                userFullName={userFullName}
                userRole={userRole}
                modulePermissions={modulePermissions}
            />

            <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}>
                {!hideGlobalHeader && (
                    <Header
                        pageTitle={getTitle()}
                        isMobileMenuOpen={isMobileMenuOpen}
                        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        isSidebarCollapsed={isSidebarCollapsed}
                        onSidebarToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    />
                )}

                <main className={`flex-1 overflow-hidden ${hideGlobalHeader ? 'p-0' : 'p-4 lg:p-6'}`}>
                    <div className="h-full w-full">{children}</div>
                </main>
            </div>
        </div>
    );
}
