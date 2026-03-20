'use client'

import { useEffect, useRef, useState } from 'react'
import AvatarEditor, { type Position } from 'react-avatar-editor'

const CROP_VIEW_SIZE = 320
const OUTPUT_SIZE = 512
const MIN_SCALE = 1
const MAX_SCALE = 3

type UserPhotoCropModalProps = {
  isOpen: boolean
  imageSrc: string | null
  maxFileSizeBytes: number
  onClose: () => void
  onApply: (file: File) => void
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

async function canvasToJpegWithinSize(
  canvas: HTMLCanvasElement,
  maxFileSizeBytes: number
): Promise<Blob | null> {
  const qualities = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56]
  let fallback: Blob | null = null

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality)
    if (!blob) continue
    fallback = blob
    if (blob.size <= maxFileSizeBytes) {
      return blob
    }
  }

  return fallback
}

export function UserPhotoCropModal({
  isOpen,
  imageSrc,
  maxFileSizeBytes,
  onClose,
  onApply,
}: UserPhotoCropModalProps) {
  const editorRef = useRef<AvatarEditor | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState<Position>({ x: 0.5, y: 0.5 })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setScale(1)
      setPosition({ x: 0.5, y: 0.5 })
      setError(null)
      setIsSaving(false)
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, imageSrc])

  const handleApply = async () => {
    if (!editorRef.current) {
      setError('Image not ready yet. Please wait and try again.')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const sourceCanvas = editorRef.current.getImage()
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to prepare crop canvas.')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.drawImage(sourceCanvas, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      const blob = await canvasToJpegWithinSize(canvas, maxFileSizeBytes)
      if (!blob) {
        throw new Error('Failed to generate cropped image.')
      }

      if (blob.size > maxFileSizeBytes) {
        setError('Cropped image is still larger than 2 MB. Please zoom in more and try again.')
        setIsSaving(false)
        return
      }

      const file = new File([blob], `user-photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onApply(file)
      onClose()
    } catch (cropError) {
      console.error('User photo crop error:', cropError)
      setError(cropError instanceof Error ? cropError.message : 'Failed to crop image.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !imageSrc) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Crop Photo</h3>
            <p className="mt-1 text-sm text-slate-500">Drag to reposition. Use zoom to fit the face.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close crop modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[minmax(0,1fr),240px] items-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 min-h-0">
            {/* Cap preview size so zoom controls remain visible on laptops */}
            <div className="mx-auto aspect-square w-full max-w-[420px] max-h-full overflow-hidden rounded-xl border border-slate-300 bg-slate-200">
              <AvatarEditor
                ref={editorRef}
                image={imageSrc}
                width={CROP_VIEW_SIZE}
                height={CROP_VIEW_SIZE}
                border={0}
                scale={scale}
                position={position}
                onPositionChange={setPosition}
                onLoadFailure={() => {
                  setError('Failed to load image. Please choose a different photo.')
                }}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
              />
            </div>
          </div>

          <div className="space-y-3 flex-shrink-0">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Zoom</label>
              <input
                type="range"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.01}
                value={scale}
                onChange={(event) => {
                  setScale(Number(event.target.value))
                }}
                className="w-full accent-cyan-600"
                disabled={isSaving}
              />
              <div className="mt-1 text-xs text-slate-500">{scale.toFixed(2)}x</div>
            </div>

            <p className="text-xs text-slate-500">
              Final image will be square and limited to 2 MB.
            </p>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-cyan-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-50"
              >
                {isSaving ? 'Applying...' : 'Apply Crop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
