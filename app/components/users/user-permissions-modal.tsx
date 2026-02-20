'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserData, ModulePermissions } from '@/lib/users/actions'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'

interface UserPermissionsModalProps {
  isOpen: boolean
  onClose: () => void
  user?: UserData
  onSubmit: (permissions: ModulePermissions) => Promise<{ error?: string; success?: boolean }>
}

const PERMISSION_MODULES = [
  { id: MODULE_PERMISSION_IDS.leads, label: 'Leads' },
  { id: MODULE_PERMISSION_IDS.clients, label: 'Clients' },
  { id: MODULE_PERMISSION_IDS.projects, label: 'Projects' },
  { id: MODULE_PERMISSION_IDS.logs, label: 'Logs' },
  { id: MODULE_PERMISSION_IDS.settings, label: 'System Settings' },
  { id: MODULE_PERMISSION_IDS.users, label: 'User Management' },
] as const

function buildDefaultPermissions(): ModulePermissions {
  const defaults: ModulePermissions = {}
  PERMISSION_MODULES.forEach((module) => {
    defaults[module.id] = 'none'
  })
  return defaults
}

export function UserPermissionsModal({
  isOpen,
  onClose,
  user,
  onSubmit,
}: UserPermissionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<ModulePermissions>(buildDefaultPermissions())

  const normalizedPermissions = useMemo(() => {
    const merged = buildDefaultPermissions()
    if (user?.module_permissions) {
      PERMISSION_MODULES.forEach((module) => {
        const value = user.module_permissions[module.id]
        if (value === 'read' || value === 'write') {
          merged[module.id] = value
        }
      })
    }
    return merged
  }, [user])

  useEffect(() => {
    if (isOpen) {
      setPermissions(normalizedPermissions)
      setError(null)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, normalizedPermissions])

  if (!isOpen || !user) return null

  const handlePermissionChange = (moduleId: string, level: 'none' | 'read' | 'write') => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: level,
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await onSubmit(permissions)
      if (result.error) {
        setError(result.error)
        return
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update module permissions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-[#1E1B4B]">Set Module Permissions</h2>
            <p className="text-xs text-slate-500 mt-1">
              {user.full_name || user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {PERMISSION_MODULES.map((module) => (
            <div
              key={module.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-100 rounded-xl p-4"
            >
              <span className="text-sm font-semibold text-slate-700">{module.label}</span>
              <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
                {(['none', 'read', 'write'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handlePermissionChange(module.id, level)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      (permissions[module.id] || 'none') === level
                        ? 'bg-white text-[#06B6D4] shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end items-center gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn-gradient-smooth rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-[#06B6D4]/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}
