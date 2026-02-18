'use client'

import { useState, useEffect } from 'react'
import { UserRole, ModulePermissions } from '@/lib/users/actions'
import { MODULES } from '@/lib/constants'
import {
    EMAIL_INPUT_PATTERN,
    EMAIL_VALIDATION_MESSAGE,
    isValidEmailFormat,
    normalizeRequiredEmail,
} from '@/lib/validation/email'

type UserFormProps = {
    initialData?: {
        id: string
        email: string
        full_name: string | null
        role: UserRole
        is_active: boolean
        module_permissions: ModulePermissions
    }
    mode: 'create' | 'edit'
    onSubmit: (data: any) => Promise<{ error?: string; success?: boolean }>
    onCancel: () => void
    readOnly?: boolean
}

export function UserForm({ initialData, mode, onSubmit, onCancel, readOnly = false }: UserFormProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        email: initialData?.email || '',
        full_name: initialData?.full_name || '',
        password: '', // Only for create
        role: initialData?.role || 'staff' as UserRole, // Default to staff if nothing selected
        is_active: initialData?.is_active ?? true,
        module_permissions: initialData?.module_permissions || {} as ModulePermissions
    })

    // Initialize permissions with 'none' for all modules if empty
    useEffect(() => {
        if (Object.keys(formData.module_permissions).length === 0) {
            const initialPermissions: ModulePermissions = {}
            MODULES.forEach(m => {
                initialPermissions[m.id] = 'none'
            })
            setFormData(prev => ({ ...prev, module_permissions: initialPermissions }))
        }
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (readOnly) return
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handlePermissionChange = (moduleId: string, level: 'read' | 'write' | 'none') => {
        if (readOnly) return
        setFormData(prev => ({
            ...prev,
            module_permissions: {
                ...prev.module_permissions,
                [moduleId]: level
            }
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (readOnly) return
        setLoading(true)
        setError(null)

        // Validate
        if (mode === 'create' && !formData.password) {
            setError("Password is required for new users")
            setLoading(false)
            return
        }

        let payload = formData
        if (mode === 'create') {
            const normalizedEmail = normalizeRequiredEmail(formData.email)
            if (!normalizedEmail || !isValidEmailFormat(normalizedEmail)) {
                setError(EMAIL_VALIDATION_MESSAGE)
                setLoading(false)
                return
            }
            payload = {
                ...formData,
                email: normalizedEmail,
            }
        }

        try {
            const result = await onSubmit(payload)
            if (result.error) {
                setError(result.error)
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    const showPermissions = formData.role === 'staff' || formData.role === 'client'

    const inputClasses = "block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm hover:border-slate-300"
    const labelClasses = "block text-sm font-semibold text-slate-700 mb-1.5"

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 animate-fade-in">
                    <div className="flex gap-3">
                        <svg className="h-5 w-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-rose-800">{error}</p>
                    </div>
                </div>
            )}

            {/* Profile Group */}
            <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">User Profile</h3>

                <div className="grid gap-5 md:grid-cols-2">
                    {/* Full Name */}
                    <div className="md:col-span-2">
                        <label className={labelClasses}>Full Name <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            name="full_name"
                            required
                            value={formData.full_name || ''}
                            onChange={handleChange}
                            placeholder="Alex Morgan"
                            className={inputClasses}
                            disabled={readOnly}
                        />
                    </div>

                    {/* Email */}
                    <div className={mode === 'create' ? 'md:col-span-1' : 'md:col-span-2'}>
                        <label className={labelClasses}>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            pattern={EMAIL_INPUT_PATTERN}
                            title={EMAIL_VALIDATION_MESSAGE}
                            required
                            disabled={mode === 'edit' || readOnly}
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="alex@example.com"
                            className={`${inputClasses} disabled:bg-slate-100 disabled:shadow-none disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed`}
                        />
                    </div>

                    {/* Password - Only for Create */}
                    {mode === 'create' && (
                        <div className="md:col-span-1">
                            <label className={labelClasses}>Initial Password <span className="text-rose-500">*</span></label>
                            <input
                                type="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Set secure password"
                                className={inputClasses}
                                disabled={readOnly}
                            />
                        </div>
                    )}
                </div>

                <div className="grid gap-5 md:grid-cols-2 border-t border-slate-100 pt-5">
                    {/* Role */}
                    <div>
                        <label className={labelClasses}>System Role</label>
                        <div className="relative">
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                disabled={readOnly}
                                className={`${inputClasses} appearance-none cursor-pointer disabled:bg-slate-100 disabled:shadow-none disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed`}
                            >
                                <option value="staff">Staff</option>
                                <option value="client">Client</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className={labelClasses}>Account Status</label>
                        <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl w-fit">
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, is_active: true }))}
                                disabled={readOnly}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.is_active ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Active
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, is_active: false }))}
                                disabled={readOnly}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!formData.is_active ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Inactive
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Permissions Section */}
            {showPermissions && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Access Permissions</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        {MODULES.map((module) => (
                            <div key={module.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-50 last:border-0 pb-4 last:pb-0">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-[#06B6D4]"></div>
                                    <span className="text-sm font-semibold text-slate-700">{module.label}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
                                    {(['none', 'read', 'write'] as const).map((level) => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => handlePermissionChange(module.id, level)}
                                            disabled={readOnly}
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${(formData.module_permissions[module.id] || 'none') === level
                                                    ? 'bg-white text-[#06B6D4] shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                                } ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-end items-center gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading || readOnly}
                    className="btn-gradient-smooth rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-[#06B6D4]/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Saving...' : mode === 'create' ? 'Create User' : 'Save Changes'}
                </button>
            </div>
        </form>
    )
}
