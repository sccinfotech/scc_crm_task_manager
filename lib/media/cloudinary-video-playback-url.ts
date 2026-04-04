/**
 * Rewrites Cloudinary **video** delivery URLs to request an on-the-fly transcode to
 * H.264 MP4, which plays in Chrome, Firefox, and Safari. Original uploads (e.g. macOS
 * Screen Recording `.mov` with HEVC) stay unchanged in storage; only the URL used for
 * &lt;video src&gt; changes.
 *
 * @see https://cloudinary.com/documentation/video_manipulation_and_delivery
 */

const PLAYBACK_TRANSFORMS = 'f_mp4,vc_h264,q_auto,c_limit,w_1920'

/** res.cloudinary.com, res-eu.cloudinary.com, etc. */
function isCloudinaryVideoDeliveryHost(hostname: string): boolean {
  return /^res(?:-[\w]+)?\.cloudinary\.com$/i.test(hostname)
}

/**
 * Returns a new URL with transcoding instructions inserted after `/video/upload/`,
 * or `null` if the URL is not a supported Cloudinary video delivery URL (e.g. signed
 * URLs, wrong host, or already transformed).
 */
export function cloudinaryVideoPlaybackUrl(originalUrl: string): string | null {
  if (!originalUrl || typeof originalUrl !== 'string') return null

  let u: URL
  try {
    u = new URL(originalUrl)
  } catch {
    return null
  }

  if (!isCloudinaryVideoDeliveryHost(u.hostname)) return null

  const segments = u.pathname.split('/').filter(Boolean)
  const uploadIdx = segments.indexOf('upload')
  if (uploadIdx < 2 || segments[uploadIdx - 1] !== 'video') return null

  const afterUpload = segments.slice(uploadIdx + 1)
  if (afterUpload.length === 0) return null

  const tail = afterUpload.join('/')
  // Signed delivery URLs must not be modified without a new signature.
  if (tail.startsWith('s--')) return null
  // Avoid stacking the same transcode twice.
  if (afterUpload[0]?.includes('f_mp4') && afterUpload[0]?.includes('vc_h264')) return null

  const next = [...segments.slice(0, uploadIdx + 1), PLAYBACK_TRANSFORMS, ...afterUpload]
  u.pathname = `/${next.join('/')}`
  return u.toString()
}
