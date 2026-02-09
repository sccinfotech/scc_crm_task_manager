'use client'

import { useState } from 'react'

interface EndWorkModalProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  onSubmit: (doneNotes: string) => Promise<void>
  isLoading?: boolean
}

export function EndWorkModal({
  isOpen,
  onClose,
  projectName,
  onSubmit,
  isLoading = false,
}: EndWorkModalProps) {
  const [notes, setNotes] = useState('')

  if (!isOpen) return null

  const canSubmit = notes.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || isLoading) return
    await onSubmit(notes.trim())
    setNotes('')
    onClose()
  }

  const handleClose = () => {
    if (!isLoading) {
      setNotes('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-xl">
        <h3 className="text-xl font-bold text-[#1E1B4B] mb-2">End work – Done points</h3>
        <p className="text-sm text-slate-600 mb-2">
          What did you do from start to end? Add tasks completed in this session (saved to work history).
        </p>
        <p className="text-xs text-slate-500 mb-4 truncate" title={projectName}>
          Project: {projectName}
        </p>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Done points <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Homepage layout, API integration, testing, code review"
          className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm min-h-[140px] resize-y focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          rows={5}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-slate-500 mb-4">
          Required. Describe what you completed in this work session before ending.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !canSubmit}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? 'Saving...' : 'End & save'}
          </button>
        </div>
      </div>
    </div>
  )
}
