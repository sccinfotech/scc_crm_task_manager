'use client'

import { useEffect, useState } from 'react'
import { ProjectForm } from './project-form'
import { ProjectFormData } from '@/lib/projects/actions'
import { createClient, type ClientFormData } from '@/lib/clients/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { ClientModal } from '@/app/dashboard/clients/client-modal'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialData?: Partial<ProjectFormData>
  isLoading?: boolean
  onSubmit: (formData: ProjectFormData) => Promise<{ error: string | null }>
  clients: ClientSelectOption[]
  clientsError: string | null
  canViewAmount: boolean
  technologyTools: TechnologyTool[]
  technologyToolsError: string | null
  teamMembers: StaffSelectOption[]
  teamMembersError: string | null
  canCreateClient?: boolean
  selectedClientId?: string
  onSelectedClientIdChange?: (id: string) => void
  onClientCreated?: (newClientId: string) => void
}

export function ProjectModal({
  isOpen,
  onClose,
  mode,
  initialData,
  isLoading = false,
  onSubmit,
  clients,
  clientsError,
  canViewAmount,
  technologyTools,
  technologyToolsError,
  teamMembers,
  teamMembersError,
  canCreateClient = false,
  selectedClientId = '',
  onSelectedClientIdChange,
  onClientCreated,
}: ProjectModalProps) {
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSuccess = () => {
    onClose()
  }

  const clientIdValue = mode === 'edit' ? (initialData?.client_id ?? '') : selectedClientId

  const handleCreateClientSubmit = async (formData: ClientFormData) => {
    const result = await createClient(formData)
    if (!result.error && result.data) {
      onClientCreated?.(result.data.id)
      setCreateClientModalOpen(false)
      return { error: null }
    }
    return { error: result.error ?? 'Failed to create client' }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop - does not close modal; use Cancel/Close button */}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

        {/* Modal */}
        <div
          className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-lg font-semibold text-[#1E1B4B] sm:text-xl">
              {mode === 'create' ? 'Create New Project' : 'Edit Project'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              data-tooltip="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[calc(100dvh-140px)] overflow-y-auto px-4 py-4 sm:max-h-[calc(100vh-200px)] sm:px-6 sm:py-6">
            {mode === 'edit' && isLoading ? (
              <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading project details">
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="h-12 rounded-xl bg-gray-200" />
                    <div className="h-12 rounded-xl bg-gray-200" />
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="h-12 rounded-xl bg-gray-200" />
                    <div className="h-12 rounded-xl bg-gray-200" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <div className="h-10 w-20 rounded-xl bg-gray-200" />
                  <div className="h-10 w-24 rounded-xl bg-gray-200" />
                </div>
              </div>
            ) : (
            <ProjectForm
              initialData={initialData}
              onSubmit={onSubmit}
              onSuccess={handleSuccess}
              submitLabel={mode === 'create' ? 'Create Project' : 'Update Project'}
              mode={mode}
              clients={clients}
              clientsError={clientsError}
              canViewAmount={canViewAmount}
              technologyTools={technologyTools}
              technologyToolsError={technologyToolsError}
              teamMembers={teamMembers}
              teamMembersError={teamMembersError}
              canCreateClient={canCreateClient}
              clientIdValue={clientIdValue}
              onClientIdChange={onSelectedClientIdChange}
              onCreateClientClick={() => setCreateClientModalOpen(true)}
            />
            )}
          </div>
        </div>
      </div>

      <ClientModal
        isOpen={createClientModalOpen}
        onClose={() => setCreateClientModalOpen(false)}
        mode="create"
        onSubmit={handleCreateClientSubmit}
      />
    </>
  )
}
