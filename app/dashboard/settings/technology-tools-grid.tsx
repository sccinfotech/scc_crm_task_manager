'use client'

import { EmptyState } from '@/app/components/empty-state'
import type { TechnologyTool } from '@/lib/settings/technology-tools-actions'

interface TechnologyToolsGridProps {
    tools: TechnologyTool[]
    canWrite: boolean
    onEdit: (tool: TechnologyTool) => void
    onDelete: (tool: TechnologyTool) => void
}

export function TechnologyToolsGrid({ tools, canWrite, onEdit, onDelete }: TechnologyToolsGridProps) {
    if (tools.length === 0) {
        return (
            <div className="flex h-full w-full min-h-[400px] items-center justify-center bg-transparent">
                <div className="w-full max-w-lg">
                    <EmptyState
                        title="No tools discovered"
                        description="Start building your tech stack by adding your first technology or tool."
                        variant="default"
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="h-full w-full overflow-y-auto p-4 lg:p-6 custom-scrollbar bg-slate-50/20">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {tools.map((tool) => (
                    <div
                        key={tool.id}
                        className="group relative flex items-center justify-between overflow-visible rounded-2xl border border-white/40 bg-white/70 px-5 py-3 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-indigo-400/30 hover:shadow-md active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 duration-500"
                    >
                        {/* Status Dot: Half-inside, Half-outside at top-right */}
                        <div
                            className={`absolute -right-1.5 -top-1.5 z-20 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200/50 transition-all duration-300 ${tool.is_active
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:scale-110'
                                    : 'bg-slate-300 group-hover:scale-110'
                                }`}
                        />

                        <div className="relative z-10 flex-1 overflow-hidden pr-3">
                            <h3 className="truncate font-sans text-[15px] font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {tool.name}
                            </h3>
                        </div>

                        <div className="relative z-10 flex items-center gap-1 border-l border-slate-100 pl-3">
                            {canWrite ? (
                                <>
                                    <button
                                        onClick={() => onEdit(tool)}
                                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-indigo-500 hover:text-white active:scale-90"
                                        title="Edit Tool"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onDelete(tool)}
                                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all hover:bg-red-500 hover:text-white active:scale-90"
                                        title="Delete Tool"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <div className="h-8 w-8 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
