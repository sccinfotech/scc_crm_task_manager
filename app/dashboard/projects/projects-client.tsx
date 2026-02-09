'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ProjectsTable } from './projects-table'
import { ProjectsFilters } from './projects-filters'
import { ProjectModal } from './project-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { Pagination } from '@/app/components/ui/pagination'
import {
  createProject,
  updateProject,
  getProject,
  deleteProject,
  ProjectFormData,
  Project,
  ProjectStatus,
  ProjectSortField,
  type ProjectListItem,
} from '@/lib/projects/actions'
import type { ClientSelectOption } from '@/lib/clients/actions'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'
import type { StaffSelectOption } from '@/lib/users/actions'
import { useToast } from '@/app/components/ui/toast-context'

interface ProjectsClientProps {
  projects: ProjectListItem[]
  totalCount: number
  page: number
  pageSize: number
  initialSearch: string
  initialStatus: ProjectStatus | 'all'
  initialSortField: ProjectSortField | null
  initialSortDirection: 'asc' | 'desc'
  canWrite: boolean
  canViewAmount: boolean
  canCreateClient?: boolean
  userRole?: string
  showClientColumn?: boolean
  clients: ClientSelectOption[]
  clientsError: string | null
  technologyTools: TechnologyTool[]
  technologyToolsError: string | null
  teamMembers: StaffSelectOption[]
  teamMembersError: string | null
}

export function ProjectsClient({
  projects,
  totalCount,
  page,
  pageSize,
  initialSearch,
  initialStatus,
  initialSortField,
  initialSortDirection,
  canWrite,
  canViewAmount,
  canCreateClient = false,
  userRole,
  showClientColumn = true,
  clients,
  clientsError,
  technologyTools,
  technologyToolsError,
  teamMembers,
  teamMembersError,
}: ProjectsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { success: showSuccess, error: showError } = useToast()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [deleteProjectName, setDeleteProjectName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedClientIdForNewProject, setSelectedClientIdForNewProject] = useState('')

  const canCreate = canWrite

  const buildSearchParams = useCallback(
    (updates: {
      search?: string
      status?: string
      sort?: string | null
      sortDir?: string
      page?: number
    }) => {
      const params = new URLSearchParams()
      const search = updates.search !== undefined ? updates.search : initialSearch
      const status = updates.status !== undefined ? updates.status : initialStatus
      const sort = updates.sort !== undefined ? updates.sort : initialSortField
      const sortDir = updates.sortDir !== undefined ? updates.sortDir : initialSortDirection
      const pageNum = updates.page !== undefined ? updates.page : page
      if (search) params.set('search', search)
      if (status && status !== 'all') params.set('status', status)
      if (sort) {
        params.set('sort', sort)
        params.set('sortDir', sortDir)
      }
      if (pageNum > 1) params.set('page', String(pageNum))
      return params.toString()
    },
    [initialSearch, initialStatus, initialSortField, initialSortDirection, page]
  )

  const handleSort = (field: ProjectSortField | null) => {
    if (!field) {
      router.push(`${pathname}?${buildSearchParams({ sort: null, sortDir: undefined, page: 1 })}`)
      return
    }
    const nextDir =
      initialSortField === field
        ? initialSortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : 'asc'
    const nextSort = initialSortField === field && initialSortDirection === 'desc' ? null : field
    router.push(
      `${pathname}?${buildSearchParams({
        sort: nextSort ?? undefined,
        sortDir: nextSort ? nextDir : undefined,
        page: 1,
      })}`
    )
  }

  const handleCreate = async (formData: ProjectFormData) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to create projects.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await createProject(formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Project Created', `${formData.name} has been created successfully.`)
      router.refresh()
    } else {
      showError('Creation Failed', result.error)
    }
    return result
  }

  const handleUpdate = async (formData: ProjectFormData) => {
    if (!selectedProjectId) return { error: 'No project selected' }
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to update projects.')
      return { error: 'Permission denied' }
    }
    setLoading(true)
    const result = await updateProject(selectedProjectId, formData)
    setLoading(false)
    if (!result.error) {
      showSuccess('Project Updated', `Information for ${formData.name} has been saved.`)
      router.refresh()
    } else {
      showError('Update Failed', result.error)
    }
    return result
  }

  const handleView = (projectId: string) => {
    router.push(`/dashboard/projects/${projectId}`)
  }

  const handleEdit = async (projectId: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to edit projects.')
      return
    }
    setLoading(true)
    const result = await getProject(projectId)
    setLoading(false)
    if (result.data) {
      setSelectedProject(result.data)
      setSelectedProjectId(projectId)
      setEditModalOpen(true)
    } else {
      showError('Error', result.error || 'Failed to load project for editing')
    }
  }

  const handleCloseEdit = () => {
    setEditModalOpen(false)
    setSelectedProjectId(null)
    setSelectedProject(null)
  }

  const handleDelete = (projectId: string, projectName: string) => {
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete projects.')
      return
    }
    setSelectedProjectId(projectId)
    setDeleteProjectName(projectName)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedProjectId) return
    if (!canWrite) {
      showError('Read-only Access', 'You do not have permission to delete projects.')
      return
    }

    setDeleting(true)
    const result = await deleteProject(selectedProjectId)
    setDeleting(false)

    if (!result.error) {
      showSuccess('Project Deleted', `${deleteProjectName} has been removed successfully.`)
      setDeleteModalOpen(false)
      setSelectedProjectId(null)
      setDeleteProjectName('')
      router.refresh()
    } else {
      showError('Delete Failed', result.error || 'Failed to delete project')
    }
  }

  const handleCloseDelete = () => {
    setDeleteModalOpen(false)
    setSelectedProjectId(null)
    setDeleteProjectName('')
  }

  const getInitialEditData = (): Partial<ProjectFormData> | undefined => {
    if (!selectedProject) return undefined
    return {
      name: selectedProject.name,
      logo_url: selectedProject.logo_url || undefined,
      client_id: selectedProject.client_id,
      project_amount: selectedProject.project_amount ?? undefined,
      priority: selectedProject.priority ?? 'medium',
      start_date: selectedProject.start_date,
      developer_deadline_date: selectedProject.developer_deadline_date || undefined,
      client_deadline_date: selectedProject.client_deadline_date || undefined,
      website_links: selectedProject.website_links || undefined,
      reference_links: selectedProject.reference_links || undefined,
      technology_tool_ids: selectedProject.technology_tools?.map((tool) => tool.id) ?? [],
      team_member_ids: selectedProject.team_members?.map((member) => member.id) ?? [],
    }
  }

  const handleFilterChange = (updates: { search?: string; status?: ProjectStatus | 'all' }) => {
    const q = buildSearchParams({
      ...updates,
      page: 1,
    })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleClearFilters = () => {
    router.push(pathname)
  }

  const handlePageChange = (newPage: number) => {
    const q = buildSearchParams({ page: newPage })
    router.push(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <>
      <div className="flex h-full flex-col p-4 lg:p-6">
        {/* Page Title, Refresh, and Create Project Button */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1E1B4B]">Projects</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              disabled={!canCreate}
              title={
                !canWrite
                  ? 'Read-only access'
                  : 'Create project'
              }
              className={`btn-gradient-smooth rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${!canCreate ? 'hover:shadow-lg hover:-translate-y-0' : ''}`}
            >
              Create Project
            </button>
          </div>
        </div>

        {/* Full Height Table Container */}
        <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
          <ProjectsFilters
            statusFilter={initialStatus}
            onStatusChange={(s) => handleFilterChange({ status: s })}
            searchQuery={initialSearch}
            onSearchChange={(q) => handleFilterChange({ search: q })}
            onClearFilters={handleClearFilters}
          />

          {loading && (
            <div className="border-b border-gray-200 bg-blue-50 px-6 py-3">
              <p className="text-sm text-blue-800">Loading...</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <ProjectsTable
              projects={projects}
              canWrite={canWrite}
              showClientColumn={showClientColumn}
              showWorkActions={userRole === 'staff'}
              onWorkUpdated={() => router.refresh()}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              sortField={initialSortField}
              sortDirection={initialSortField ? initialSortDirection : undefined}
              onSort={handleSort}
              isFiltered={initialStatus !== 'all' || initialSearch.trim() !== ''}
            />
          </div>
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Create Modal */}
      <ProjectModal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false)
          setSelectedClientIdForNewProject('')
        }}
        mode="create"
        onSubmit={handleCreate}
        clients={clients}
        clientsError={clientsError}
        canViewAmount={canViewAmount}
        technologyTools={technologyTools}
        technologyToolsError={technologyToolsError}
        teamMembers={teamMembers}
        teamMembersError={teamMembersError}
        canCreateClient={canCreateClient}
        selectedClientId={selectedClientIdForNewProject}
        onSelectedClientIdChange={setSelectedClientIdForNewProject}
        onClientCreated={(newClientId) => {
          router.refresh()
          setSelectedClientIdForNewProject(newClientId)
        }}
      />

      {/* Edit Modal */}
      <ProjectModal
        isOpen={editModalOpen}
        onClose={handleCloseEdit}
        mode="edit"
        initialData={getInitialEditData()}
        onSubmit={handleUpdate}
        clients={clients}
        clientsError={clientsError}
        canViewAmount={canViewAmount}
        technologyTools={technologyTools}
        technologyToolsError={technologyToolsError}
        teamMembers={teamMembers}
        teamMembersError={teamMembersError}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        projectName={deleteProjectName}
        isLoading={deleting}
      />
    </>
  )
}
