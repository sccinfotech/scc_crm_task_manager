'use client'

import { UserForm } from '@/app/components/users/user-form'
import {
    updateUser,
    UserData,
    CreateUserFormData,
    UpdateUserFormData,
} from '@/lib/users/actions'
import { useRouter } from 'next/navigation'

type EditUserClientProps = {
    user: UserData
    readOnly?: boolean
}

export function EditUserClient({ user, readOnly = false }: EditUserClientProps) {
    const router = useRouter()

    const handleSubmit = async (data: CreateUserFormData | UpdateUserFormData) => {
        if (readOnly) {
            return { error: 'Read-only access', success: false }
        }

        const payload: UpdateUserFormData = 'email' in data
            ? {
                full_name: data.full_name,
                designation: data.designation,
                joining_date: data.joining_date,
                role: data.role,
                is_active: data.is_active,
                personal_email: data.personal_email,
                personal_mobile_no: data.personal_mobile_no,
                home_mobile_no: data.home_mobile_no,
                address: data.address,
                date_of_birth: data.date_of_birth,
                photo_url: data.photo_url,
            }
            : data

        const result = await updateUser(user.id, payload)
        if (result.success) {
            router.push('/dashboard/users')
            router.refresh()
        }
        return result
    }

    return (
        <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Edit User</h3>
                <div className="mt-5">
                    <UserForm
                        mode="edit"
                        initialData={user}
                        onSubmit={handleSubmit}
                        onCancel={() => router.back()}
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    )
}
