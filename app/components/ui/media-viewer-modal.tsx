'use client'

import { useEffect, useMemo } from 'react'

type MediaViewerModalProps = {
  isOpen: boolean
  mediaUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  onClose: () => void
}

function getExtension(fileName?: string | null, mediaUrl?: string | null): string {
  const source = (fileName || mediaUrl || '').toLowerCase()
  const clean = source.split('?')[0]
  const parts = clean.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

function resolveMediaKind(mimeType?: string | null, fileName?: string | null, mediaUrl?: string | null) {
  const lowerMime = (mimeType || '').toLowerCase()
  const ext = getExtension(fileName, mediaUrl)

  if (lowerMime.startsWith('image/')) return 'image'
  if (lowerMime.startsWith('video/')) return 'video'
  if (lowerMime.startsWith('audio/')) return 'audio'
  if (lowerMime === 'application/pdf') return 'pdf'

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'oga'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

export function MediaViewerModal({
  isOpen,
  mediaUrl,
  fileName,
  mimeType,
  onClose,
}: MediaViewerModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const mediaKind = useMemo(
    () => resolveMediaKind(mimeType, fileName, mediaUrl),
    [mimeType, fileName, mediaUrl]
  )

  if (!isOpen || !mediaUrl) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={fileName ? `Preview ${fileName}` : 'Media preview'}
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <p className="truncate text-sm font-semibold text-slate-900">{fileName || 'Attachment preview'}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-white p-2 sm:p-2 pb-0">
          {mediaKind === 'image' && (
            <div className="flex h-full items-center justify-center">
              <img
                src={mediaUrl}
                alt={fileName || 'Attachment'}
                className="max-h-full w-auto max-w-full rounded-lg"
              />
            </div>
          )}

          {mediaKind === 'video' && (
            <div className="flex h-full items-center justify-center">
              <video controls className="max-h-full w-auto max-w-full rounded-lg bg-black">
                <source src={mediaUrl} type={mimeType || undefined} />
                Your browser does not support this video format.
              </video>
            </div>
          )}

          {mediaKind === 'audio' && (
            <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
              <audio controls className="w-full" preload="metadata">
                <source src={mediaUrl} type={mimeType || undefined} />
                Your browser does not support this audio format.
              </audio>
            </div>
          )}

          {mediaKind === 'pdf' && (
            <div className="h-full">
              <iframe
                src={mediaUrl}
                title={fileName || 'PDF preview'}
                className="h-full w-full rounded-lg border border-slate-200 bg-white"
              />
            </div>
          )}

          {mediaKind === 'file' && (
            <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-sm text-slate-700">Preview is not available for this file type.</p>
              <a
                href={mediaUrl}
                download={fileName ?? undefined}
                className="mt-4 inline-flex items-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
