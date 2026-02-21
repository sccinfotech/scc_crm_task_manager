'use client'

import { useEffect, useRef, useState } from 'react'
import { UserPhotoCropModal } from '@/app/components/users/user-photo-crop-modal'
import {
  UserRole,
  CreateUserFormData,
  UpdateUserFormData,
  getUserPhotoUploadSignature,
} from '@/lib/users/actions'
import {
  EMAIL_INPUT_PATTERN,
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailFormat,
  normalizeRequiredEmail,
} from '@/lib/validation/email'
import { ListboxDropdown } from '@/app/components/ui/listbox-dropdown'

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_PHOTO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

type UserFormProps = {
  initialData?: {
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
  }
  mode: 'create' | 'edit'
  onSubmit: (data: CreateUserFormData | UpdateUserFormData) => Promise<{ error?: string; success?: boolean }>
  onCancel: () => void
  readOnly?: boolean
}

export function UserForm({ initialData, mode, onSubmit, onCancel, readOnly = false }: UserFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState(initialData?.photo_url || '')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const pendingPhotoFileRef = useRef<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    email: initialData?.email || '',
    full_name: initialData?.full_name || '',
    designation: initialData?.designation || '',
    joining_date: initialData?.joining_date || '',
    role: initialData?.role || ('staff' as UserRole),
    is_active: initialData?.is_active ?? false,
    personal_email: initialData?.personal_email || '',
    personal_mobile_no: initialData?.personal_mobile_no || '',
    home_mobile_no: initialData?.home_mobile_no || '',
    address: initialData?.address || '',
    date_of_birth: initialData?.date_of_birth || '',
  })

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
      }
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl)
      }
    }
  }, [photoPreviewUrl, cropSourceUrl])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (readOnly) return
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const uploadUserPhoto = async (file: File): Promise<string> => {
    const signatureResult = await getUserPhotoUploadSignature()
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

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      { method: 'POST', body: uploadForm }
    )

    if (!response.ok) {
      throw new Error('Photo upload failed.')
    }

    const data = await response.json()
    if (!data.secure_url || typeof data.secure_url !== 'string') {
      throw new Error('Upload completed but photo URL is missing.')
    }

    return data.secure_url
  }

  const handlePhotoInputClick = () => {
    if (readOnly) return
    fileInputRef.current?.click()
  }

  const handlePhotoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
    }

    const sourceUrl = URL.createObjectURL(file)
    setCropSourceUrl(sourceUrl)
    setIsCropModalOpen(true)
    event.target.value = ''
  }

  const handlePhotoCropApply = (file: File) => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    pendingPhotoFileRef.current = file
    setPhotoPreviewUrl(previewUrl)
    setPhotoError(null)
  }

  const handleRemovePhoto = () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl)
    }
    setPhotoPreviewUrl('')
    pendingPhotoFileRef.current = null
    setPhotoUrl('')
    setPhotoError(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCloseCropModal = () => {
    setIsCropModalOpen(false)
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
      setCropSourceUrl(null)
    }
  }

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      return 'Full name is required'
    }

    if (!formData.designation.trim()) {
      return 'Designation is required'
    }

    if (!formData.joining_date) {
      return 'Joining date is required'
    }

    if (!formData.role) {
      return 'Role is required'
    }

    if (!formData.personal_mobile_no.trim()) {
      return 'Personal mobile number is required'
    }

    const normalizedEmail = normalizeRequiredEmail(formData.email)
    if (mode === 'create' && (!normalizedEmail || !isValidEmailFormat(normalizedEmail))) {
      return `Company email: ${EMAIL_VALIDATION_MESSAGE}`
    }

    const normalizedPersonalEmail = normalizeRequiredEmail(formData.personal_email)
    if (normalizedPersonalEmail && !isValidEmailFormat(normalizedPersonalEmail)) {
      return `Personal email: ${EMAIL_VALIDATION_MESSAGE}`
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return

    setLoading(true)
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    const normalizedCompanyEmail = normalizeRequiredEmail(formData.email)
    const normalizedPersonalEmail = normalizeRequiredEmail(formData.personal_email)
    let finalPhotoUrl = photoUrl.trim() || undefined

    if (pendingPhotoFileRef.current) {
      try {
        finalPhotoUrl = await uploadUserPhoto(pendingPhotoFileRef.current)
        setPhotoUrl(finalPhotoUrl)
        pendingPhotoFileRef.current = null
        if (photoPreviewUrl) {
          URL.revokeObjectURL(photoPreviewUrl)
          setPhotoPreviewUrl('')
        }
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload photo.')
        setLoading(false)
        return
      }
    }

    const payload = {
      ...formData,
      email: normalizedCompanyEmail,
      full_name: formData.full_name.trim(),
      designation: formData.designation.trim(),
      personal_email: normalizedPersonalEmail || undefined,
      personal_mobile_no: formData.personal_mobile_no.trim(),
      home_mobile_no: formData.home_mobile_no.trim() || undefined,
      address: formData.address.trim() || undefined,
      date_of_birth: formData.date_of_birth || undefined,
      photo_url: finalPhotoUrl,
    }

    const finalPayload: CreateUserFormData | UpdateUserFormData = mode === 'edit'
      ? {
          full_name: payload.full_name,
          designation: payload.designation,
          joining_date: payload.joining_date,
          role: payload.role,
          is_active: payload.is_active,
          personal_email: payload.personal_email,
          personal_mobile_no: payload.personal_mobile_no,
          home_mobile_no: payload.home_mobile_no,
          address: payload.address,
          date_of_birth: payload.date_of_birth,
          photo_url: payload.photo_url,
        }
      : payload

    try {
      const result = await onSubmit(finalPayload)
      if (result.error) {
        setError(result.error)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const inputClasses =
    'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 sm:text-sm hover:border-slate-300'
  const labelClasses = 'block text-sm font-semibold text-slate-700 mb-1.5'
  const displayPhotoUrl = photoPreviewUrl || photoUrl

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

      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Basic Details</h3>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClasses}>
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              required
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Alex Morgan"
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Designation <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="designation"
              required
              value={formData.designation}
              onChange={handleChange}
              placeholder="Business Analyst"
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Joining Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              name="joining_date"
              required
              value={formData.joining_date}
              onChange={handleChange}
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Company Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              pattern={EMAIL_INPUT_PATTERN}
              title={EMAIL_VALIDATION_MESSAGE}
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="alex@company.com"
              className={`${inputClasses} ${mode === 'edit' ? 'disabled:bg-slate-100 disabled:shadow-none disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed' : ''}`}
              disabled={mode === 'edit' || readOnly}
            />
            {mode === 'edit' && <p className="mt-1 text-xs text-slate-500">Company email cannot be changed.</p>}
          </div>

          <div>
            <label htmlFor="role" className={labelClasses}>
              Role <span className="text-rose-500">*</span>
            </label>
            <input type="hidden" name="role" value={formData.role} readOnly />
            <ListboxDropdown
              id="role"
              value={formData.role}
              options={[
                { value: 'staff', label: 'Staff' },
                { value: 'client', label: 'Client' },
                { value: 'manager', label: 'Manager' },
                { value: 'admin', label: 'Admin' },
              ]}
              onChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
              ariaLabel="User role"
              disabled={readOnly}
              className="min-h-[2.75rem]"
            />
          </div>

          <div>
            <label className={labelClasses}>Status</label>
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, is_active: true }))}
                disabled={readOnly}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.is_active ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, is_active: false }))}
                disabled={readOnly}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!formData.is_active ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                Inactive
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelClasses}>Photo</label>
            <p className="mb-3 text-xs text-slate-500">Optional · PNG/JPG/WebP · Max 2 MB · Crop before save</p>
            <div
              role={readOnly ? undefined : 'button'}
              tabIndex={readOnly ? -1 : 0}
              onClick={handlePhotoInputClick}
              onKeyDown={(event) => {
                if (readOnly) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handlePhotoInputClick()
                }
              }}
              className={`group rounded-2xl border-2 border-dashed p-4 transition-all duration-200 ${
                readOnly
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50/70'
                  : 'cursor-pointer border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/30'
              }`}
            >
              <div className="flex flex-col items-center justify-center">
                {displayPhotoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayPhotoUrl}
                      alt="User photo preview"
                      className="h-24 w-24 rounded-full border border-slate-200 object-cover shadow-sm"
                    />
                    <p className="mt-3 text-sm font-medium text-slate-700">Click to change photo</p>
                    {photoPreviewUrl ? (
                      <p className="mt-1 text-xs text-slate-500">Photo will upload when you save</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-colors duration-200 group-hover:bg-cyan-100 group-hover:text-cyan-700">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-700">Click to upload photo</p>
                  </>
                )}
              </div>
            </div>

            {displayPhotoUrl && !readOnly ? (
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePhotoInputClick}
                  className="text-sm font-medium text-cyan-600 transition-colors duration-200 hover:text-cyan-700"
                >
                  Change photo
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-sm font-medium text-rose-600 transition-colors duration-200 hover:text-rose-700"
                >
                  Remove photo
                </button>
              </div>
            ) : null}

            {photoError ? (
              <p className="mt-2 text-sm text-rose-600" role="alert">
                {photoError}
              </p>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handlePhotoFileChange}
              className="hidden"
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Personal Details</h3>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClasses}>Personal Email</label>
            <input
              type="email"
              name="personal_email"
              pattern={EMAIL_INPUT_PATTERN}
              title={EMAIL_VALIDATION_MESSAGE}
              value={formData.personal_email}
              onChange={handleChange}
              placeholder="alex.personal@gmail.com"
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClasses}>
              Personal Mobile No. <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="personal_mobile_no"
              required
              value={formData.personal_mobile_no}
              onChange={handleChange}
              placeholder="+1 555-123-4567"
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClasses}>Home Mobile No.</label>
            <input
              type="text"
              name="home_mobile_no"
              value={formData.home_mobile_no}
              onChange={handleChange}
              placeholder="+1 555-765-4321"
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className={labelClasses}>Date of Birth</label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleChange}
              className={inputClasses}
              disabled={readOnly}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClasses}>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter full address"
              className={`${inputClasses} min-h-[96px] resize-y`}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

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

      <UserPhotoCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropSourceUrl}
        maxFileSizeBytes={MAX_PHOTO_SIZE_BYTES}
        onClose={handleCloseCropModal}
        onApply={handlePhotoCropApply}
      />
    </form>
  )
}
