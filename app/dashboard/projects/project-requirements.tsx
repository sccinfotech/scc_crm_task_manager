"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Tooltip } from "@/app/components/ui/tooltip"
import { EmptyState } from "@/app/components/empty-state"
import { useToast } from "@/app/components/ui/toast-context"
import {
  PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS,
  PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES,
  PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES,
} from "@/lib/projects/requirements-constants"
import {
  createProjectRequirement,
  deleteProjectRequirement,
  getProjectRequirementUploadSignature,
  getProjectRequirements,
  updateProjectRequirement,
  type PricingType,
  type ProjectRequirement,
  type ProjectRequirementFormData,
  type RequirementSummary,
  type RequirementType,
} from "@/lib/projects/requirements-actions"

interface ProjectRequirementsProps {
  projectId: string
  canWrite: boolean
  canViewAmount: boolean
  className?: string
  isActiveTab?: boolean
}

type MilestoneFormItem = {
  id: string
  title: string
  description: string
  dueDate: string
  amount: string
}

const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  initial: "Initial Requirement",
  addon: "Add-On Requirement",
}

const REQUIREMENT_TYPE_STYLES: Record<RequirementType, string> = {
  initial: "bg-cyan-100 text-cyan-800 border-cyan-200",
  addon: "bg-amber-100 text-amber-800 border-amber-200",
}

const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  hourly: "Hour-based",
  fixed: "Fixed",
  milestone: "Milestone-based",
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return "--"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatHours(hours: number | null) {
  if (hours === null || hours === undefined) return "--"
  if (Number.isNaN(hours)) return "--"
  return `${hours}`.replace(/\\.?0+$/, "") + " hrs"
}

function getFileExtension(name: string) {
  const parts = name.split(".")
  if (parts.length < 2) return ""
  return parts[parts.length - 1].toLowerCase()
}

const maxAttachmentSizeMB = PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)

function computeSummary(requirements: ProjectRequirement[]): RequirementSummary {
  let initialAmount = 0
  let addonAmount = 0
  requirements.forEach((req) => {
    const amount = req.amount ?? 0
    if (req.requirement_type === "initial") {
      initialAmount += amount
    } else {
      addonAmount += amount
    }
  })
  return {
    initialAmount: Math.round(initialAmount * 100) / 100,
    addonAmount: Math.round(addonAmount * 100) / 100,
    totalAmount: Math.round((initialAmount + addonAmount) * 100) / 100,
  }
}

function MilestoneRequirementCard({
  req,
  canWrite,
  canViewAmount,
  onEdit,
  onDelete,
}: {
  req: ProjectRequirement
  canWrite: boolean
  canViewAmount: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const milestones = req.milestones ?? []
  const milestoneCount = milestones.length

  return (
    <div className="relative">
      <div className="absolute -left-0.5 top-6 h-3 w-3 rounded-full bg-cyan-500 ring-4 ring-white" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${REQUIREMENT_TYPE_STYLES[req.requirement_type]}`}
            >
              {REQUIREMENT_TYPE_LABELS[req.requirement_type]}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {PRICING_TYPE_LABELS.milestone}
              <span className="ml-1 text-[11px] font-normal text-slate-500">
                • {milestoneCount} milestones
              </span>
            </span>
            <span
              className={`ml-1 text-base font-bold ${canViewAmount ? "text-cyan-700" : "text-slate-500"}`}
            >
              {canViewAmount ? formatCurrency(req.amount) : "Restricted"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Created {formatDate(req.created_at)} •</span>
              <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-800 border border-cyan-100">
                {req.created_by_name || "Unknown User"}
              </span>
            </div>
            {canWrite && (
              <div className="flex items-center gap-1">
                <Tooltip content="Edit requirement">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600"
                    aria-label="Edit requirement"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </Tooltip>
                <Tooltip content="Delete requirement">
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Delete requirement"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex w-full flex-row gap-4">
          <div className="min-w-0 flex-[2] space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Description
            </p>
            {req.description && (
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {req.description}
              </p>
            )}
            {req.attachment_url && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Attachment
                </p>
                <a
                  href={req.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 10-5.656-5.656L5.757 10.757a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  View attachment
                </a>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2 border-l border-slate-200 pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Milestones
            </p>
            {milestoneCount > 0 ? (
              <div className="flex flex-col gap-2">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2"
                  >
                    <div className="flex flex-nowrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                        {milestone.title || "Untitled milestone"}
                      </p>
                      <p
                        className={`shrink-0 text-sm font-bold ${
                          canViewAmount ? "text-cyan-700" : "text-slate-500"
                        }`}
                      >
                        {canViewAmount ? formatCurrency(milestone.amount) : "Restricted"}
                      </p>
                    </div>
                    {milestone.due_date && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Due {formatDate(milestone.due_date)}
                      </p>
                    )}
                    {milestone.description && (
                      <p className="mt-1 text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function RequirementDeleteModal({
  isOpen,
  requirement,
  onClose,
  onConfirm,
  isDeleting,
}: {
  isOpen: boolean
  requirement: ProjectRequirement | null
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen || !requirement) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-[#1E1B4B]">Delete Requirement</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete this requirement? This will remove it from the project scope list.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Requirement</p>
          <p className="text-sm font-semibold text-slate-700">
            {(requirement.description || "").trim() || "Untitled requirement"}
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequirementModal({
  isOpen,
  mode,
  requirement,
  projectId,
  canViewAmount,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  mode: "create" | "edit"
  requirement: ProjectRequirement | null
  projectId: string
  canViewAmount: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { success: showSuccess, error: showError } = useToast()
  const [requirementType, setRequirementType] = useState<RequirementType>("initial")
  const [pricingType, setPricingType] = useState<PricingType>("fixed")
  const [description, setDescription] = useState("")
  const [estimatedHours, setEstimatedHours] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [amount, setAmount] = useState("")
  const [amountEdited, setAmountEdited] = useState(false)
  const [milestones, setMilestones] = useState<MilestoneFormItem[]>([])
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const createMilestone = (): MilestoneFormItem => ({
    id: crypto.randomUUID(),
    title: "",
    description: "",
    dueDate: "",
    amount: "",
  })

  const parseNumber = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  useEffect(() => {
    if (!isOpen) return
    setRequirementType(requirement?.requirement_type ?? "initial")
    setPricingType((requirement?.pricing_type as PricingType) ?? "fixed")
    setDescription(requirement?.description ?? "")
    setEstimatedHours(requirement?.estimated_hours != null ? String(requirement.estimated_hours) : "")
    setHourlyRate(canViewAmount && requirement?.hourly_rate != null ? String(requirement.hourly_rate) : "")
    setAmount(canViewAmount && requirement?.amount != null ? String(requirement.amount) : "")
    setAmountEdited(canViewAmount && requirement?.amount !== null && requirement?.amount !== undefined)
    setMilestones(
      requirement?.milestones?.length
        ? requirement.milestones.map((milestone) => ({
            id: milestone.id ?? crypto.randomUUID(),
            title: milestone.title ?? "",
            description: milestone.description ?? "",
            dueDate: milestone.due_date ?? "",
            amount: canViewAmount && milestone.amount != null ? String(milestone.amount) : "",
          }))
        : []
    )
    setAttachmentUrl(requirement?.attachment_url ?? null)
    setAttachmentFile(null)
    setRemoveAttachment(false)
    setError(null)
  }, [isOpen, requirement, canViewAmount])

  useEffect(() => {
    if (!isOpen) return
    if (pricingType === "fixed") {
      setHourlyRate("")
      setEstimatedHours("")
      setAmountEdited(true)
    } else if (pricingType === "milestone") {
      setHourlyRate("")
      setEstimatedHours("")
      setAmount("")
      setAmountEdited(false)
      setMilestones((prev) => (prev.length > 0 ? prev : [createMilestone()]))
    } else {
      setAmountEdited(false)
    }
  }, [pricingType, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (pricingType !== "hourly") return
    if (amountEdited) return
    const hours = Number.parseFloat(estimatedHours)
    const rate = Number.parseFloat(hourlyRate)
    if (Number.isFinite(hours) && Number.isFinite(rate)) {
      setAmount((Math.round(hours * rate * 100) / 100).toFixed(2))
    } else {
      setAmount("")
    }
  }, [estimatedHours, hourlyRate, amountEdited, isOpen, pricingType])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen) return null

  const validateFile = (file: File) => {
    const extension = getFileExtension(file.name)
    const isAllowedExtension = PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS.includes(extension as typeof PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS[number])
    const isAllowedMime = PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES.includes(file.type as typeof PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES[number])
    if (!isAllowedExtension && !isAllowedMime) {
      showError("Unsupported File", "Allowed types: PDF, DOC/DOCX, XLS/XLSX, PNG/JPG, TXT, RTF, ZIP.")
      return false
    }
    if (file.size > PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES) {
      showError("File Too Large", `Max size is ${maxAttachmentSizeMB} MB.`)
      return false
    }
    return true
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!validateFile(file)) {
      event.target.value = ""
      return
    }
    setAttachmentFile(file)
    setRemoveAttachment(false)
    event.target.value = ""
  }

  const handleRemoveAttachment = () => {
    setAttachmentFile(null)
    setAttachmentUrl(null)
    setRemoveAttachment(true)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (!validateFile(file)) return
    setAttachmentFile(file)
    setRemoveAttachment(false)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleAddMilestone = () => {
    setMilestones((prev) => [...prev, createMilestone()])
  }

  const handleUpdateMilestone = (id: string, field: keyof Omit<MilestoneFormItem, "id">, value: string) => {
    setMilestones((prev) =>
      prev.map((milestone) =>
        milestone.id === id ? { ...milestone, [field]: value } : milestone
      )
    )
  }

  const handleRemoveMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((milestone) => milestone.id !== id))
  }

  const milestoneTotal = milestones.reduce((sum, milestone) => {
    const value = parseNumber(milestone.amount)
    return sum + (value ?? 0)
  }, 0)

  const milestoneTotalRounded = Math.round(milestoneTotal * 100) / 100

  const canEditMilestones = canViewAmount

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const estimated = pricingType === "hourly" ? parseNumber(estimatedHours) : null
    if (estimated !== null && estimated < 0) {
      setError("Estimated hours must be zero or greater.")
      return
    }

    const rate = canViewAmount && pricingType === "hourly" ? parseNumber(hourlyRate) : null
    if (rate !== null && rate < 0) {
      setError("Hourly rate must be zero or greater.")
      return
    }

    let milestonePayload: ProjectRequirementFormData["milestones"] | undefined
    let milestoneAmountTotal: number | null = null

    if (pricingType === "milestone" && canEditMilestones) {
      const normalized = milestones
        .map((milestone) => {
          const titleValue = milestone.title.trim()
          const descriptionValue = milestone.description.trim()
          const amountValue = parseNumber(milestone.amount)
          const dueDateValue = milestone.dueDate.trim()
          return {
            title: titleValue,
            description: descriptionValue ? descriptionValue : null,
            due_date: dueDateValue ? dueDateValue : null,
            amount: amountValue,
            hasContent:
              Boolean(titleValue) ||
              Boolean(descriptionValue) ||
              Boolean(dueDateValue) ||
              amountValue !== null,
          }
        })
        .filter((milestone) => milestone.hasContent)

      if (normalized.length === 0) {
        setError("Please add at least one milestone.")
        return
      }

      for (const milestone of normalized) {
        if (!milestone.title) {
          setError("Milestone title is required.")
          return
        }
        if (milestone.amount === null || milestone.amount < 0) {
          setError("Milestone amount must be zero or greater.")
          return
        }
      }

      milestonePayload = normalized.map((milestone) => ({
        title: milestone.title,
        description: milestone.description ?? null,
        due_date: milestone.due_date ?? null,
        amount: milestone.amount,
      }))

      milestoneAmountTotal = Math.round(
        milestonePayload.reduce((sum, milestone) => sum + (milestone.amount ?? 0), 0) * 100
      ) / 100
    }

    const amountValue = canViewAmount
      ? pricingType === "milestone"
        ? milestoneAmountTotal
        : parseNumber(amount)
      : undefined

    if (amountValue !== null && amountValue !== undefined && amountValue < 0) {
      setError("Amount must be zero or greater.")
      return
    }

    setSubmitting(true)

    let finalAttachmentUrl = removeAttachment ? null : attachmentUrl
    if (attachmentFile) {
      const signatureResult = await getProjectRequirementUploadSignature(projectId)
      if (signatureResult.error || !signatureResult.data) {
        setSubmitting(false)
        showError("Upload Failed", signatureResult.error || "Failed to prepare upload.")
        return
      }

      const signature = signatureResult.data
      try {
        const formData = new FormData()
        formData.append("file", attachmentFile)
        formData.append("api_key", signature.apiKey)
        formData.append("timestamp", String(signature.timestamp))
        formData.append("signature", signature.signature)
        formData.append("folder", signature.folder)

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
          { method: "POST", body: formData }
        )

        if (!response.ok) {
          throw new Error("Upload failed")
        }

        const data = await response.json()
        finalAttachmentUrl = data.secure_url
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        setSubmitting(false)
        showError("Upload Failed", "Could not upload attachment. Please try again.")
        return
      }
    }

    const payload: ProjectRequirementFormData = {
      requirement_type: requirementType,
      pricing_type: pricingType,
      description: description.trim() || null,
      attachment_url: finalAttachmentUrl,
      estimated_hours: pricingType === "hourly" ? estimated : null,
      hourly_rate: canViewAmount && pricingType === "hourly" ? rate : undefined,
      amount: amountValue,
      milestones: pricingType === "milestone" && canEditMilestones ? milestonePayload : undefined,
    }

    const result =
      mode === "create"
        ? await createProjectRequirement(projectId, payload)
        : await updateProjectRequirement(requirement?.id ?? "", payload)

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    showSuccess(
      mode === "create" ? "Requirement Added" : "Requirement Updated",
      mode === "create" ? "Requirement has been saved." : "Changes have been saved."
    )
    await onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1E1B4B]">
              {mode === "create" ? "Add Requirement" : "Edit Requirement"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-180px)] overflow-y-auto px-6 py-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-medium text-rose-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Requirement Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={requirementType}
                onChange={(e) => setRequirementType(e.target.value as RequirementType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                required
              >
                <option value="initial">Initial Requirement</option>
                <option value="addon">Add-On Requirement</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Pricing Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as PricingType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="fixed">{PRICING_TYPE_LABELS.fixed}</option>
                <option value="hourly">{PRICING_TYPE_LABELS.hourly}</option>
                <option value="milestone" disabled={!canViewAmount}>
                  {PRICING_TYPE_LABELS.milestone}
                </option>
              </select>
              {!canViewAmount && (
                <p className="mt-2 text-xs text-slate-500">
                  Milestone-based pricing is available for admins and managers only.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Add requirement details, notes, or scope context."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-y"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Attachment</p>
                <p className="text-xs text-slate-500">
                  Upload supporting files for this requirement.
                </p>
              </div>
              {(attachmentUrl || attachmentFile) && (
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="mt-3">
              {attachmentUrl && !attachmentFile && (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-cyan-700 hover:underline"
                >
                  View current attachment
                </a>
              )}
              {attachmentFile && (
                <p className="text-sm font-semibold text-slate-700">{attachmentFile.name}</p>
              )}
              <div
                className={`mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  isDragging ? "border-cyan-500 bg-cyan-50/60" : "border-slate-200 bg-white"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-sm text-slate-700">
                  <button
                    type="button"
                    className="font-semibold text-cyan-700 hover:text-cyan-800"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Click to upload
                  </button>{" "}
                  or drag and drop a file here.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Supported: PDF, DOC/DOCX, XLS/XLSX, PNG/JPG, TXT, RTF, ZIP • Max size {maxAttachmentSizeMB} MB
                </p>
              </div>
            </div>
          </div>

          {pricingType === "milestone" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Milestones</p>
                  <p className="text-xs text-slate-500">
                    Break this requirement into milestone-based billing checkpoints.
                  </p>
                </div>
                {canEditMilestones && (
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                  >
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-white text-xs">
                      +
                    </span>
                    <span>Add milestone</span>
                  </button>
                )}
              </div>

              {canEditMilestones ? (
                <div className="space-y-4">
                  {milestones.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      No milestones added yet. Add at least one milestone to continue.
                    </div>
                  )}
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id} className="relative rounded-2xl border border-slate-200 bg-white p-4">
                      {milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(milestone.id)}
                          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                          aria-label="Remove milestone"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18M9 6V4h6v2M10 11v6M14 11v6M5 6l1 14h12l1-14" />
                          </svg>
                        </button>
                      )}
                      <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Milestone Title <span className="text-rose-500">*</span>
                          </label>
                          <input
                            value={milestone.title}
                            onChange={(e) => handleUpdateMilestone(milestone.id, "title", e.target.value)}
                            type="text"
                            placeholder={`Milestone ${index + 1}`}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          />
                        </div>
                        <div className="min-w-[160px]">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label>
                          <input
                            value={milestone.amount}
                            onChange={(e) => handleUpdateMilestone(milestone.id, "amount", e.target.value)}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            disabled={!canViewAmount}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100"
                          />
                        </div>
                        <div className="min-w-[160px]">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Due Date</label>
                          <input
                            value={milestone.dueDate}
                            onChange={(e) => handleUpdateMilestone(milestone.id, "dueDate", e.target.value)}
                            type="date"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                        <textarea
                          value={milestone.description}
                          onChange={(e) => handleUpdateMilestone(milestone.id, "description", e.target.value)}
                          rows={3}
                          placeholder="Optional milestone details."
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Milestone details are restricted.
                    </div>
                  )}
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {milestone.title || "Untitled milestone"}
                          </p>
                          {milestone.dueDate && (
                            <p className="text-xs text-slate-500">Due {formatDate(milestone.dueDate)}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-500">Restricted</span>
                      </div>
                      {milestone.description && (
                        <p className="mt-2 text-xs text-slate-500">{milestone.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-600">Milestone Total</span>
                <span className="font-semibold text-slate-800">
                  {canViewAmount ? formatCurrency(milestoneTotalRounded) : "Restricted"}
                </span>
              </div>
            </div>
          ) : pricingType === "hourly" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Hours</label>
                <input
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Price per Hour</label>
                <input
                  value={hourlyRate}
                  onChange={(e) => {
                    setHourlyRate(e.target.value)
                    if (!amountEdited) setAmountEdited(false)
                  }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  disabled={!canViewAmount}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setAmountEdited(true)
                  }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  disabled={!canViewAmount}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100"
                />
                {canViewAmount && (
                  <button
                    type="button"
                    onClick={() => setAmountEdited(false)}
                    className="mt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                  >
                    Use auto-calculation
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Fixed Amount</label>
                <input
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setAmountEdited(true)
                  }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  disabled={!canViewAmount}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100"
                />
              </div>
            </div>
          )}

          {!canViewAmount && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {pricingType === "hourly"
                ? "Hourly rate and amount are visible only to admins and managers."
                : pricingType === "milestone"
                  ? "Milestone amounts are visible only to admins and managers."
                  : "Amount is visible only to admins and managers."}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : mode === "create" ? "Add Requirement" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ProjectRequirements({
  projectId,
  canWrite,
  canViewAmount,
  className = "",
  isActiveTab = true,
}: ProjectRequirementsProps) {
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()
  const [requirements, setRequirements] = useState<ProjectRequirement[]>([])
  const [summary, setSummary] = useState<RequirementSummary>({
    initialAmount: 0,
    addonAmount: 0,
    totalAmount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedRequirement, setSelectedRequirement] = useState<ProjectRequirement | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hasLoadedRef = useRef(false)
  const wasActiveTabRef = useRef(isActiveTab)

  const fetchRequirements = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    const result = await getProjectRequirements(projectId)
    if (result.error) {
      if (!silent) {
        setError(result.error)
        setLoading(false)
      } else {
        showError("Refresh Failed", result.error)
      }
      return
    }

    setRequirements(result.data || [])
    setSummary(result.summary || computeSummary(result.data || []))
    setLoading(false)
  }

  useEffect(() => {
    hasLoadedRef.current = false
  }, [projectId])

  useEffect(() => {
    const wasActive = wasActiveTabRef.current
    wasActiveTabRef.current = isActiveTab
    if (!isActiveTab) return

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      fetchRequirements()
      return
    }

    if (!wasActive) {
      fetchRequirements({ silent: true })
    }
  }, [projectId, isActiveTab])

  const handleOpenCreate = () => {
    if (!canWrite) {
      showError("Read-only Access", "You do not have permission to add requirements.")
      return
    }
    setModalMode("create")
    setSelectedRequirement(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (requirement: ProjectRequirement) => {
    if (!canWrite) {
      showError("Read-only Access", "You do not have permission to edit requirements.")
      return
    }
    setModalMode("edit")
    setSelectedRequirement(requirement)
    setModalOpen(true)
  }

  const handleOpenDelete = (requirement: ProjectRequirement) => {
    if (!canWrite) {
      showError("Read-only Access", "You do not have permission to delete requirements.")
      return
    }
    setSelectedRequirement(requirement)
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedRequirement) return
    setDeleting(true)
    const result = await deleteProjectRequirement(selectedRequirement.id)
    setDeleting(false)
    if (result.error) {
      showError("Delete Failed", result.error)
      return
    }
    showSuccess("Requirement Deleted", "The requirement has been removed.")
    setDeleteModalOpen(false)
    setSelectedRequirement(null)
    await fetchRequirements({ silent: true })
    router.refresh()
  }

  const listContent = (() => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading requirements...
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error}
        </div>
      )
    }

    if (requirements.length === 0) {
      return (
        <EmptyState
          variant="projects"
          title="No requirements yet"
          description={undefined}
          actionLabel={canWrite ? "Add Requirement" : undefined}
          onAction={canWrite ? handleOpenCreate : undefined}
        />
      )
    }

    return (
      <div className="space-y-4">
          {requirements.map((req) => {
            const milestones = req.milestones ?? []
            const milestoneCount = milestones.length
            const milestonePreview = milestones.slice(0, 3)
            const remainingMilestones = milestoneCount - milestonePreview.length
            const dueMilestones = milestones.filter((milestone) => milestone.due_date)
            const nextMilestone = dueMilestones.length
              ? [...dueMilestones].sort((a, b) => {
                  const aTime = new Date(a.due_date as string).getTime()
                  const bTime = new Date(b.due_date as string).getTime()
                  return aTime - bTime
                })[0]
              : null
            const isFixedPricing = req.pricing_type === "fixed"

            if (req.pricing_type === "milestone") {
              return (
                <MilestoneRequirementCard
                  key={req.id}
                  req={req}
                  canWrite={canWrite}
                  canViewAmount={canViewAmount}
                  onEdit={() => handleOpenEdit(req)}
                  onDelete={() => handleOpenDelete(req)}
                />
              )
            }

            return (
              <div key={req.id} className="relative">
                <div className="absolute -left-0.5 top-6 h-3 w-3 rounded-full bg-cyan-500 ring-4 ring-white" />
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${REQUIREMENT_TYPE_STYLES[req.requirement_type]}`}
                      >
                        {REQUIREMENT_TYPE_LABELS[req.requirement_type]}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                          isFixedPricing
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {PRICING_TYPE_LABELS[(req.pricing_type as PricingType) || "hourly"]}
                        {req.pricing_type === "milestone" && (
                          <span className="ml-1 text-[11px] font-normal text-slate-500">
                            • {milestoneCount} milestones
                          </span>
                        )}
                      </span>
                      <span
                        className={`ml-1 text-base font-bold ${
                          canViewAmount ? "text-cyan-700" : "text-slate-500"
                        }`}
                      >
                        {canViewAmount ? formatCurrency(req.amount) : "Restricted"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Created {formatDate(req.created_at)} •</span>
                        <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-800 border border-cyan-100">
                          {req.created_by_name || "Unknown User"}
                        </span>
                      </div>
                      {canWrite && (
                        <div className="flex items-center gap-1">
                          <Tooltip content="Edit requirement">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(req)}
                              className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-cyan-50 hover:text-cyan-600"
                              aria-label="Edit requirement"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete requirement">
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(req)}
                              className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Delete requirement"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr,1fr]">
                    <>
                        <div className="space-y-3">
                          {req.description && (
                            <p className="text-sm text-slate-600 whitespace-pre-line">{req.description}</p>
                          )}
                          {req.attachment_url && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Attachment
                              </p>
                              <a
                                href={req.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 10-5.656-5.656L5.757 10.757a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                View attachment
                              </a>
                            </div>
                          )}
                        </div>
                        {req.pricing_type === "hourly" && (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-xs">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Estimated Hours
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {formatHours(req.estimated_hours)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Hourly Rate
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {canViewAmount ? formatCurrency(req.hourly_rate) : "Restricted"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Amount
                          </p>
                          <p
                            className={`mt-1 text-base font-bold ${
                              canViewAmount ? "text-cyan-700" : "text-slate-500"
                            }`}
                          >
                            {canViewAmount ? formatCurrency(req.amount) : "Restricted"}
                          </p>
                        </div>
                          </div>
                        )}
                      </>

                  </div>
                </div>
              </div>
            )
          })}
        </div>
    )
  })()

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Initial Requirements</p>
              <p className="mt-2 text-lg font-bold text-slate-800">
                {canViewAmount ? formatCurrency(summary.initialAmount) : "Restricted"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Add-On Requirements</p>
              <p className="mt-2 text-lg font-bold text-slate-800">
                {canViewAmount ? formatCurrency(summary.addonAmount) : "Restricted"}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Requirements Value</p>
              <p className="mt-2 text-lg font-bold text-slate-800">
                {canViewAmount ? formatCurrency(summary.totalAmount) : "Restricted"}
              </p>
            </div>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 shadow-sm"
            >
              Add Requirement
            </button>
          )}
        </div>

        {!canViewAmount && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Financial summary is visible only to admins and managers.
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">{listContent}</div>
      </div>

      <RequirementModal
        isOpen={modalOpen}
        mode={modalMode}
        requirement={selectedRequirement}
        projectId={projectId}
        canViewAmount={canViewAmount}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setModalOpen(false)
          setSelectedRequirement(null)
          await fetchRequirements({ silent: true })
          router.refresh()
        }}
      />

      <RequirementDeleteModal
        isOpen={deleteModalOpen}
        requirement={selectedRequirement}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isDeleting={deleting}
      />
    </div>
  )
}
