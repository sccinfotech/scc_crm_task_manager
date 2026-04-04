'use client'

import { useEffect, useMemo, useState } from 'react'
import { cloudinaryVideoPlaybackUrl } from '@/lib/media/cloudinary-video-playback-url'

function MediaViewerVideoPanel({
  originalUrl,
  videoSrc,
  videoType,
  usedCloudinaryTranscode,
}: {
  originalUrl: string
  videoSrc: string
  videoType: string | undefined
  usedCloudinaryTranscode: boolean
}) {
  const [ready, setReady] = useState(!usedCloudinaryTranscode)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setReady(!usedCloudinaryTranscode)
    setLoadError(false)
  }, [videoSrc, usedCloudinaryTranscode])

  useEffect(() => {
    if (!usedCloudinaryTranscode || loadError || ready) return
    const timeoutMs = 120_000
    const id = window.setTimeout(() => {
      setLoadError(true)
      setReady(true)
    }, timeoutMs)
    return () => window.clearTimeout(id)
  }, [usedCloudinaryTranscode, loadError, ready, videoSrc])

  const showPreparing = usedCloudinaryTranscode && !ready && !loadError

  const markPlayable = () => setReady(true)

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-slate-950 px-2 py-3 sm:px-3 sm:py-4">
      <div className="relative flex min-h-0 w-full max-w-full flex-1 flex-col items-center justify-center">
        {showPreparing && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-950 px-4"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="h-10 w-10 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin"
              aria-hidden
            />
            <p className="text-center text-sm text-slate-300">Preparing video for playback…</p>
          </div>
        )}

        {loadError ? (
          <div className="flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
            <p className="text-sm text-slate-300">
              {usedCloudinaryTranscode
                ? 'The optimized video could not be loaded. You can try opening the original file instead.'
                : 'Your browser may not support this video format. Try opening the original file in a new tab.'}
            </p>
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-cyan-400 underline hover:text-cyan-300"
            >
              Open original in new tab
            </a>
          </div>
        ) : (
          <video
            key={videoSrc}
            controls={ready}
            playsInline
            preload={usedCloudinaryTranscode ? 'auto' : 'metadata'}
            className={`max-h-full w-full max-w-full rounded-lg bg-black object-contain shadow-lg transition-opacity duration-200 ${
              showPreparing ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
            onCanPlay={markPlayable}
            onLoadedData={markPlayable}
            onError={() => {
              setLoadError(true)
              setReady(true)
            }}
          >
            {videoType ? (
              <source src={videoSrc} type={videoType} />
            ) : (
              <source src={videoSrc} />
            )}
            Your browser does not support this video format.
          </video>
        )}
      </div>
    </div>
  )
}

type MediaViewerModalProps = {
  isOpen: boolean
  mediaUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  onClose: () => void
}

/** Last path segment, strip query/hash, return lowercase extension or ''. */
function extensionFromPath(path: string): string {
  if (!path) return ''
  const clean = path.split('?')[0].split('#')[0].toLowerCase()
  const base = clean.split('/').pop() || ''
  const parts = base.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

function getExtension(fileName?: string | null, mediaUrl?: string | null): string {
  const fromName = extensionFromPath(fileName || '')
  const fromUrl = extensionFromPath(mediaUrl || '')
  return fromName || fromUrl
}

function resolveMediaKind(mimeType?: string | null, fileName?: string | null, mediaUrl?: string | null) {
  const lowerMime = (mimeType || '').toLowerCase()
  const ext = getExtension(fileName, mediaUrl)

  if (lowerMime.startsWith('image/')) return 'image'
  if (lowerMime.startsWith('video/')) return 'video'
  if (lowerMime.startsWith('audio/')) return 'audio'
  if (lowerMime === 'application/pdf') return 'pdf'
  if (lowerMime === 'text/plain') return 'text'
  if (lowerMime === 'application/rtf' || lowerMime === 'text/rtf') return 'text'

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v', 'ogg', 'ogv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'oga'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'txt' || ext === 'rtf') return 'text'
  return 'file'
}

/** Best <source type> for HTML5 video when MIME is missing (helps Safari + .mov). */
function resolveVideoSourceType(
  mimeType?: string | null,
  fileName?: string | null,
  mediaUrl?: string | null
): string | undefined {
  const raw = (mimeType || '').trim()
  const m = raw.toLowerCase()
  if (m.startsWith('video/')) return raw
  const ext = getExtension(fileName, mediaUrl)
  if (ext === 'mov' || ext === 'qt') return 'video/quicktime'
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'ogg' || ext === 'ogv') return 'video/ogg'
  return undefined
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

  const videoSourceType = useMemo(
    () => resolveVideoSourceType(mimeType, fileName, mediaUrl),
    [mimeType, fileName, mediaUrl]
  )

  /** Cloudinary on-the-fly H.264/MP4 so Chrome can play HEVC .mov screen recordings. */
  const { videoSrc, videoType, usedCloudinaryTranscode } = useMemo(() => {
    if (!mediaUrl || mediaKind !== 'video') {
      return { videoSrc: '', videoType: undefined as string | undefined, usedCloudinaryTranscode: false }
    }
    const transcoded = cloudinaryVideoPlaybackUrl(mediaUrl)
    if (transcoded) {
      return { videoSrc: transcoded, videoType: 'video/mp4', usedCloudinaryTranscode: true }
    }
    return {
      videoSrc: mediaUrl,
      videoType: videoSourceType,
      usedCloudinaryTranscode: false,
    }
  }, [mediaUrl, mediaKind, videoSourceType])

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
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <p className="truncate text-sm font-semibold text-slate-900">{fileName || 'Attachment preview'}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mediaKind === 'image' && (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-2 sm:p-2 pb-0">
              <img
                src={mediaUrl}
                alt={fileName || 'Attachment'}
                className="max-h-full w-auto max-w-full rounded-lg object-contain"
              />
            </div>
          )}

          {mediaKind === 'video' && (
            <MediaViewerVideoPanel
              originalUrl={mediaUrl}
              videoSrc={videoSrc}
              videoType={videoType}
              usedCloudinaryTranscode={usedCloudinaryTranscode}
            />
          )}

          {mediaKind === 'audio' && (
            <div className="flex flex-1 items-center justify-center overflow-auto bg-white p-4">
              <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4">
                <audio controls className="w-full" preload="metadata">
                  <source src={mediaUrl} type={mimeType || undefined} />
                  Your browser does not support this audio format.
                </audio>
              </div>
            </div>
          )}

          {mediaKind === 'pdf' && (
            <div className="flex min-h-0 flex-1 flex-col bg-white p-2 sm:p-2 pb-0">
              <iframe
                src={mediaUrl}
                title={fileName || 'PDF preview'}
                className="min-h-0 w-full flex-1 rounded-lg border border-slate-200 bg-white"
              />
            </div>
          )}

          {mediaKind === 'text' && (
            <div className="flex min-h-0 flex-1 flex-col bg-white p-2 sm:p-2 pb-0">
              <iframe
                src={mediaUrl}
                title={fileName || 'Text preview'}
                className="min-h-0 w-full flex-1 rounded-lg border border-slate-200 bg-white"
              />
            </div>
          )}

          {mediaKind === 'file' && (
            <div className="flex flex-1 items-center justify-center overflow-auto bg-white p-4">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
