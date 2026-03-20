'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPhotoCropModal } from '@/app/components/users/user-photo-crop-modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
  getSelfUserPhotoUploadSignature,
  updateSelfUserPhoto,
  type UserRole,
} from '@/lib/users/actions'
import { useToast } from '@/app/components/ui/toast-context'

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export type SelfProfileUser = {
  id: string
  email: string
  full_name: string | null
  designation: string | null
  joining_date: string | null
  personal_email: string | null
  personal_mobile_no: string | null
  home_mobile_no: string | null
  address: string | null
  date_of_birth: string | null
  photo_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getInitials(fullName: string | null, email: string) {
  const name = fullName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  )
}

function PhotoViewerModal({
  isOpen,
  photoUrl,
  name,
  onClose,
}: {
  isOpen: boolean
  photoUrl: string | null
  name: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Profile photo viewer"
      onClick={onClose}
    >
      <div className="relative max-h-[88vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 rounded-lg bg-black/30 p-2 text-white transition-colors hover:bg-black/50"
          aria-label="Close photo viewer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-6xl font-bold text-white shadow-2xl">
            {name.substring(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}

function getDisplayValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : '--'
}

function normalizePhoneForTel(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const normalized = raw.replace(/[^\d+]/g, '')
  return normalized.length > 0 ? normalized : null
}

function getRoleLabel(role: string | null | undefined): string {
  if (!role) return '--'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
    </div>
  )
}

function ContactInfoField({
  label,
  value,
  callHref,
}: {
  label: string
  value: string
  callHref?: string
}) {
  const hasValue = value !== '--'
  const isCallable = hasValue && Boolean(callHref)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {isCallable ? (
        <a
          href={callHref}
          className="mt-1 inline-block text-sm font-medium text-slate-900 break-words transition-colors hover:text-emerald-700 hover:underline"
          aria-label={`Call ${label}`}
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</p>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export function SelfProfileClient({ user }: { user: SelfProfileUser }) {
  const router = useRouter()
  const toast = useToast()

  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photo_url)
  const initials = useMemo(() => getInitials(user.full_name, user.email), [user.full_name, user.email])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [isSavingPhoto, setIsSavingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    }
  }, [cropSourceUrl])

  const handleOpenFilePicker = () => {
    setPhotoError(null)
    fileInputRef.current?.click()
  }

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError('Photo must be 2 MB or less.')
      event.target.value = ''
      return
    }

    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
      setPhotoError('Photo must be PNG, JPG, JPEG, or WebP.')
      event.target.value = ''
      return
    }

    setPhotoError(null)
    const sourceUrl = URL.createObjectURL(file)
    setCropSourceUrl(sourceUrl)
    setIsCropModalOpen(true)
    event.target.value = ''
  }

  const handleCloseCropModal = () => {
    setIsCropModalOpen(false)
    setCropSourceUrl(null)
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const signatureResult = await getSelfUserPhotoUploadSignature()
    if (signatureResult.error || !signatureResult.data) {
      throw new Error(signatureResult.error || 'Failed to prepare photo upload.')
    }

    const signature = signatureResult.data
    const uploadForm = new FormData()
    uploadForm.append('file', file)
    uploadForm.append('api_key', signature.apiKey)
    uploadForm.append('timestamp', String(signature.timestamp))
    uploadForm.append('signature', signature.signature)
    uploadForm.append('folder', signature.folder)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
      method: 'POST',
      body: uploadForm,
    })

    if (!response.ok) {
      throw new Error('Photo upload failed.')
    }

    const data = (await response.json()) as { secure_url?: unknown }
    if (!data.secure_url || typeof data.secure_url !== 'string') {
      throw new Error('Upload completed but photo URL is missing.')
    }

    return data.secure_url
  }

  const handleCroppedFile = async (file: File) => {
    setIsSavingPhoto(true)
    setPhotoError(null)

    try {
      const uploadedUrl = await uploadToCloudinary(file)
      const updateResult = await updateSelfUserPhoto(uploadedUrl)
      if (updateResult.error) {
        throw new Error(updateResult.error)
      }

      setPhotoUrl(uploadedUrl)
      toast.success('Profile updated', 'Your profile photo was updated.')
      router.refresh()
    } catch (err: unknown) {
      toast.error('Update Failed', err instanceof Error ? err.message : 'Failed to update your photo.')
    } finally {
      setIsSavingPhoto(false)
    }
  }

  const userLabel = user.full_name || user.email || 'User'
  const personalMobileTel = normalizePhoneForTel(user.personal_mobile_no)
  const homeMobileTel = normalizePhoneForTel(user.home_mobile_no)

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="w-full lg:w-[340px] lg:flex-shrink-0 lg:overflow-y-auto">
        <div className="pb-3 lg:pb-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Profile & Account</h3>
              <div className="flex items-center gap-1.5">
                <Tooltip content="View photo">
                  <button
                    type="button"
                    onClick={() => setIsPhotoViewerOpen(true)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-cyan-700"
                    aria-label="Open profile image"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.55-4.55M19 5h-3m3 0v3M9 14l-4.55 4.55M5 19h3m-3 0v-3" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="mt-3 flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <div className="relative">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt="Profile photo"
                    className="h-24 w-24 rounded-full border border-slate-200 object-cover shadow-sm"
                    onClick={() => setIsPhotoViewerOpen(true)}
                    role="button"
                    tabIndex={0}
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-4xl font-bold text-white shadow-sm">
                    {initials}
                  </div>
                )}

                {/* Update icon button (bottom-right) */}
                <div className="absolute -bottom-1 -right-1">
                  <button
                    type="button"
                    onClick={() => handleOpenFilePicker()}
                    disabled={isSavingPhoto}
                    aria-label="Update profile image"
                    title="Update profile image"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h2l2-2h10l2 2h2v14H4V7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17a5 5 0 100-10 5 5 0 000 10z" />
                    </svg>
                  </button>
                </div>

                {isSavingPhoto ? (
                  <div className="absolute inset-0 rounded-full bg-black/20 flex items-center justify-center" aria-hidden>
                    <span className="text-white text-sm font-semibold">Saving...</span>
                  </div>
                ) : null}
              </div>

              <div className="w-full">
                <p className="truncate text-base font-semibold text-slate-900">{userLabel}</p>
                <p className="truncate text-sm text-slate-500">{user.designation ? user.designation : '--'}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span
                    className={`text-sm font-semibold ${user.is_active ? 'text-emerald-700' : 'text-rose-700'}`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <MetaRow label="Role" value={getRoleLabel(user.role)} />
            </div>

            <div className="mt-4 flex flex-col gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileSelected}
                disabled={isSavingPhoto}
              />
              {photoError ? <p className="mt-1 text-sm text-rose-600" role="alert">{photoError}</p> : null}
              <p className="text-xs text-slate-500">Upload a new photo (max 2 MB) and we will crop it to a square.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:min-w-0 lg:flex-1 lg:overflow-y-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">User Information</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoField label="Company Email" value={getDisplayValue(user.email)} />
            <InfoField label="Personal Email" value={getDisplayValue(user.personal_email)} />
            <ContactInfoField
              label="Personal Mobile"
              value={getDisplayValue(user.personal_mobile_no)}
              callHref={personalMobileTel ? `tel:${personalMobileTel}` : undefined}
            />
            <ContactInfoField
              label="Home Mobile"
              value={getDisplayValue(user.home_mobile_no)}
              callHref={homeMobileTel ? `tel:${homeMobileTel}` : undefined}
            />
            <InfoField label="Joining Date" value={formatDate(user.joining_date)} />
            <InfoField label="Date of Birth" value={formatDate(user.date_of_birth)} />
            <InfoField label="Created At" value={formatDate(user.created_at)} />
            <InfoField label="Address" value={getDisplayValue(user.address)} />
          </div>
        </div>
      </div>

      <PhotoViewerModal
        isOpen={isPhotoViewerOpen}
        photoUrl={photoUrl}
        name={userLabel}
        onClose={() => setIsPhotoViewerOpen(false)}
      />

      <UserPhotoCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropSourceUrl}
        maxFileSizeBytes={MAX_PHOTO_SIZE_BYTES}
        onClose={handleCloseCropModal}
        onApply={(file) => {
          void handleCroppedFile(file)
        }}
      />
    </div>
  )
}

