'use client'

import { UserForm } from '@/app/components/users/user-form'
import {
    createUser,
    CreateUserFormData,
    UpdateUserFormData,
} from '@/lib/users/actions'
import { useRouter } from 'next/navigation'

export function CreateUserClient() {
    const router = useRouter()

    const handleSubmit = async (data: CreateUserFormData | UpdateUserFormData) => {
        if (!('email' in data)) {
            return { error: 'Company email is required for user creation' }
        }

        const result = await createUser(data)
        if (result.success) {
            router.push('/dashboard/users')
            router.refresh()
        }
        return result
    }

    return (
        <div className="bg-white shadow sm:rounded-lg">
            <div className="px-3 py-4 sm:px-5 sm:py-5">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-3">Add New User</h3>
                <div className="mt-1 max-w-xl text-sm text-gray-500">
                    <p>Create a new user account. Module permissions can be set from the user list.</p>
                </div>
                <div className="mt-4">
                    <UserForm
                        mode="create"
                        onSubmit={handleSubmit}
                        onCancel={() => router.back()}
                    />
                </div>
            </div>
        </div>
    )
}
