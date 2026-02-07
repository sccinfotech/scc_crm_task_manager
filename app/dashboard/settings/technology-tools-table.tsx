import { EmptyState } from '@/app/components/empty-state'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'

interface TechnologyToolsTableProps {
  tools: TechnologyTool[]
  canWrite: boolean
  onEdit: (tool: TechnologyTool) => void
  onDelete: (tool: TechnologyTool) => void
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
          : 'bg-slate-100 text-slate-600 ring-slate-500/20'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-600' : 'bg-slate-500'}`}></span>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function TechnologyToolsTable({ tools, canWrite, onEdit, onDelete }: TechnologyToolsTableProps) {
  if (tools.length === 0) {
    return (
      <div className="flex h-full w-full min-h-[320px] items-center justify-center bg-white">
        <div className="w-full max-w-lg">
          <EmptyState
            title="No tools yet"
            description="Add your first technology or tool to use in projects."
            variant="default"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white">
      <table className="w-full table-fixed divide-y divide-gray-100">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="bg-gray-50/50">
            <th className="w-[60%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Tool Name
            </th>
            <th className="w-[20%] px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="w-[20%] px-4 sm:px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
              {canWrite ? 'Actions' : 'View'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {tools.map((tool) => (
            <tr key={tool.id} className="group transition-all duration-200 hover:bg-slate-50">
              <td className="px-4 sm:px-6 py-3">
                <span className="text-sm font-semibold text-gray-900">{tool.name}</span>
              </td>
              <td className="px-4 sm:px-6 py-3">
                <StatusPill active={tool.is_active} />
              </td>
              <td className="px-4 sm:px-6 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {canWrite && (
                    <>
                      <Tooltip content="Edit tool" position="left">
                        <button
                          onClick={() => onEdit(tool)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete tool" position="left">
                        <button
                          onClick={() => onDelete(tool)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Tooltip>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
