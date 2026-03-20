import { requireAuth } from '@/lib/auth/utils';
import { DashboardShell } from './dashboard-shell';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await requireAuth();

    return (
        <DashboardShell
            userEmail={user.email}
            userFullName={user.fullName}
            userPhotoUrl={user.photoUrl}
            userRole={user.role}
            modulePermissions={user.modulePermissions}
        >
            {children}
        </DashboardShell>
    );
}
