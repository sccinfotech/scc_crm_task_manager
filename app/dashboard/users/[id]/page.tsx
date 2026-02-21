import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { EditUserClient } from './edit-user-client'
import { getUser } from '@/lib/users/actions'
import { getProjectsPage } from '@/lib/projects/actions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/app/components/dashboard/header'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

function sanitizeDashboardPath(value?: string): string | null {
    const normalized = value?.trim()
    if (!normalized) return null
    if (!normalized.startsWith('/dashboard')) return null
    if (normalized.startsWith('//')) return null
    return normalized
}

interface EditUserPageProps {
    params: Promise<{ id: string }>
    searchParams: Promise<{ returnTo?: string; tab?: string }>
}

export default async function EditUserPage({ params, searchParams }: EditUserPageProps) {
    const currentUser = await requireAuth()
    const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'read')
    const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.users, 'write')

    if (!canRead) {
        redirect('/dashboard?error=unauthorized')
    }

    const { id } = await params
    const query = await searchParams
    const safeReturnTo = sanitizeDashboardPath(query.returnTo)

    const { data: user, error } = await getUser(id)

    if (error || !user) {
        notFound()
    }

    const assignedProjectsResult = await getProjectsPage({
        staffUserId: id,
        page: 1,
        pageSize: 100,
        sortField: 'created_at',
        sortDirection: 'desc',
    })

    const breadcrumbLinkHref = safeReturnTo || '/dashboard/users'
    const userLabel = user.full_name || user.email
    const breadcrumb = (
        <div className="flex items-center gap-2 text-sm">
            <Link
                href={breadcrumbLinkHref}
                className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
            >
                Users
            </Link>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span
                className="font-['Poppins',sans-serif] text-lg font-bold text-[#0C4A6E] truncate max-w-[220px] sm:max-w-[380px]"
                title={userLabel}
            >
                {userLabel}
            </span>
        </div>
    )

    return (
        <div className="flex h-full flex-col">
            <Header
                pageTitle={userLabel}
                breadcrumb={breadcrumb}
                userId={currentUser.id}
            />
            <div className="flex-1 overflow-hidden px-2.5 pt-2 pb-2 sm:px-3 lg:px-4">
                <EditUserClient
                    user={user}
                    canWrite={canWrite}
                    assignedProjects={assignedProjectsResult.data}
                    assignedProjectsError={assignedProjectsResult.error}
                />
            </div>
        </div>
    )
}
