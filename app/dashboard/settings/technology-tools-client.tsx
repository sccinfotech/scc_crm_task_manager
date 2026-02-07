'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TechnologyToolsTable } from './technology-tools-table'
import { TechnologyToolModal } from './technology-tool-modal'
import { TechnologyToolDeleteModal } from './technology-tool-delete-modal'
import {
  createTechnologyTool,
  updateTechnologyTool,
  deleteTechnologyTool,
  type TechnologyTool,
  type TechnologyToolFormData,
} from '@/lib/settings/technology-tools-actions'
import { useToast } from '@/app/components/ui/toast-context'

interface TechnologyToolsClientProps {
  tools: TechnologyTool[]
  canWrite: boolean
}

export function TechnologyToolsClient({ tools, canWrite }: TechnologyToolsClientProps) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<TechnologyTool | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleCreate = async (formData: TechnologyToolFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create tools.')
      return { error: 'Permission denied' }
    }
    const result = await createTechnologyTool(formData)
    if (!result.error) {
      showSuccess('Tool Added', `${formData.name} has been added.`)
      router.refresh()
    } else {
      showError('Creation Failed', result.error)
    }
    return { error: result.error }
  }

  const handleUpdate = async (formData: TechnologyToolFormData) => {
    if (!selectedTool) return { error: 'No tool selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update tools.')
      return { error: 'Permission denied' }
    }
    const result = await updateTechnologyTool(selectedTool.id, formData)
    if (!result.error) {
      showSuccess('Tool Updated', `${formData.name} has been updated.`)
      router.refresh()
    } else {
      showError('Update Failed', result.error)
    }
    return { error: result.error }
  }

  const handleDelete = async () => {
    if (!selectedTool) return
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete tools.')
      return
    }
    setDeleting(true)
    const result = await deleteTechnologyTool(selectedTool.id)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Tool Deleted', `${selectedTool.name} has been removed.`)
      setDeleteModalOpen(false)
      setSelectedTool(null)
      router.refresh()
    } else {
      showError('Delete Failed', result.error)
    }
  }

  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      {/* Technology & Tools: single module header (no Settings title) */}
      <section className="flex-1 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E1B4B]">Technology & Tools</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              title="Refresh"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              disabled={!canWrite}
              title={canWrite ? 'Add tool' : 'Read-only access'}
              className="btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Tool
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col">
          <TechnologyToolsTable
          tools={tools}
          canWrite={canWrite}
          onEdit={(tool) => {
            setSelectedTool(tool)
            setEditModalOpen(true)
          }}
          onDelete={(tool) => {
            setSelectedTool(tool)
            setDeleteModalOpen(true)
          }}
        />
        </div>
      </section>

      <TechnologyToolModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />

      <TechnologyToolModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        mode="edit"
        initialData={selectedTool ?? undefined}
        onSubmit={handleUpdate}
      />

      <TechnologyToolDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        toolName={selectedTool?.name || ''}
        isLoading={deleting}
      />
    </div>
  )
}
