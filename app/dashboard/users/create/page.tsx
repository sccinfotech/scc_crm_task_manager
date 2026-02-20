import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { DashboardLayout } from '@/app/components/dashboard/dashboard-layout'
import { CreateUserClient } from './create-user-client'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

export default async function CreateUserPage() {
    const currentUser = await requireAuth()
    const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')
    const canCreate = currentUser.role === 'admin'

    if (!canWrite || !canCreate) {
        redirect('/dashboard?error=unauthorized')
    }

    return (
        <DashboardLayout
            pageTitle="Create User"
            userEmail={currentUser.email}
            userFullName={currentUser.fullName}
            userRole={currentUser.role}
            modulePermissions={currentUser.modulePermissions}
        >
            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <CreateUserClient />
            </div>
        </DashboardLayout>
    )
}
