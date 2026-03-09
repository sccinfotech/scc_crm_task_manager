'use client';

import { useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/app/components/dashboard/sidebar';
import { Header } from '@/app/components/dashboard/header';
import { SidebarProvider } from '@/app/components/dashboard/sidebar-context';
import type { ModulePermissions } from '@/lib/permissions';

interface DashboardShellProps {
    children: React.ReactNode;
    userEmail?: string;
    userFullName?: string;
    userRole?: string;
    modulePermissions?: ModulePermissions;
}

const SIDEBAR_STATE_KEY = 'sidebar-collapsed';
const SIDEBAR_STATE_EVENT = 'sidebar-collapsed-change';

function getServerSidebarState(): boolean {
    return false;
}

function getClientSidebarState(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    } catch {
        return false;
    }
}

function subscribeSidebarState(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const onStorage = (event: StorageEvent) => {
        if (event.key === SIDEBAR_STATE_KEY) {
            callback();
        }
    };
    const onLocalChange = () => callback();

    window.addEventListener('storage', onStorage);
    window.addEventListener(SIDEBAR_STATE_EVENT, onLocalChange);

    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(SIDEBAR_STATE_EVENT, onLocalChange);
    };
}

function setClientSidebarState(collapsed: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed));
        window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT));
    } catch {
        // Ignore localStorage access failures.
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
    const isSidebarCollapsed = useSyncExternalStore(
        subscribeSidebarState,
        getClientSidebarState,
        getServerSidebarState
    );

    // Pages that render their own in-content headers or intentionally hide the global header
    // For these pages, we hide the global header to prevent duplicates or flickering
    const hideGlobalHeader =
        pathname === '/dashboard' ||
        pathname === '/dashboard/leads' ||
        pathname === '/dashboard/users' ||
        pathname === '/dashboard/clients' ||
        pathname === '/dashboard/projects' ||
        pathname === '/dashboard/quotations' ||
        pathname === '/dashboard/accounting' ||
        pathname === '/dashboard/logs' ||
        pathname === '/dashboard/settings' ||
        pathname?.startsWith('/dashboard/leads/') || // lead detail page also has custom header
        pathname?.startsWith('/dashboard/users/') || // user detail page also has custom header
        pathname?.startsWith('/dashboard/clients/') || // client detail page also has custom header
        pathname?.startsWith('/dashboard/projects/') ||
        pathname?.startsWith('/dashboard/quotations/') || // quotation detail page has custom header
        pathname?.startsWith('/dashboard/accounting') ||
        pathname?.startsWith('/dashboard/settings/'); // settings subpages

    const getTitle = () => {
        if (pathname?.includes('users')) return 'Users';
        if (pathname?.includes('clients')) return 'Clients';
        if (pathname?.includes('projects')) return 'Projects';
        if (pathname?.includes('quotations')) return 'Quotations';
        if (pathname?.includes('accounting')) return 'Accounting';
        if (pathname?.includes('logs')) return 'Logs';
        if (pathname?.includes('settings')) return 'Settings';
        return 'Dashboard';
    };

    return (
        <SidebarProvider
            isSidebarCollapsed={isSidebarCollapsed}
            onSidebarToggle={() => setClientSidebarState(!isSidebarCollapsed)}
            isMobileMenuOpen={isMobileMenuOpen}
            onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
            <div className="flex h-screen overflow-hidden bg-[var(--background)]">
                <Sidebar
                    isMobileOpen={isMobileMenuOpen}
                    setIsMobileOpen={setIsMobileMenuOpen}
                    isCollapsed={isSidebarCollapsed}
                    setIsCollapsed={setClientSidebarState}
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
                            onSidebarToggle={() => setClientSidebarState(!isSidebarCollapsed)}
                        />
                    )}

                    <main className={`flex-1 overflow-hidden ${hideGlobalHeader ? 'p-0' : 'p-4 lg:p-6'}`}>
                        <div className="h-full w-full">{children}</div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
