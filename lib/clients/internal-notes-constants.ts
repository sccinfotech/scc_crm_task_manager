export const INTERNAL_NOTE_MAX_ATTACHMENTS = 5
export const INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024
/** Larger cap for QuickTime / video attachments (e.g. short screen recordings). */
export const INTERNAL_NOTE_VIDEO_MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024

// File type categories
export const FILE_TYPE_CATEGORIES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
} as const

// Allowed MIME types
export const INTERNAL_NOTE_ALLOWED_MIME_TYPES = [
  // Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain', // .txt
  'application/rtf', // .rtf
  'text/rtf', // some browsers
  // Video (QuickTime / .mov)
  'video/quicktime',
] as const

// Allowed extensions
export const INTERNAL_NOTE_ALLOWED_EXTENSIONS = [
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  // Documents
  'pdf',
  'docx',
  'xlsx',
  'txt',
  'rtf',
  'mov',
] as const

// Extension to MIME type mapping
export const INTERNAL_NOTE_EXTENSION_MIME_MAP: Record<string, string> = {
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  // Documents
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  rtf: 'application/rtf',
  mov: 'video/quicktime',
}

export function getInternalNoteAttachmentMaxSizeBytesForMime(mimeType: string): number {
  return getFileCategoryFromMime(mimeType) === FILE_TYPE_CATEGORIES.VIDEO
    ? INTERNAL_NOTE_VIDEO_MAX_ATTACHMENT_SIZE_BYTES
    : INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES
}

// Get file category from extension
export function getFileCategory(extension: string): string | null {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
  const documentExtensions = ['pdf', 'docx', 'xlsx', 'txt', 'rtf']
  const videoExtensions = ['mov']

  if (imageExtensions.includes(extension.toLowerCase())) {
    return FILE_TYPE_CATEGORIES.IMAGE
  }
  if (documentExtensions.includes(extension.toLowerCase())) {
    return FILE_TYPE_CATEGORIES.DOCUMENT
  }
  if (videoExtensions.includes(extension.toLowerCase())) {
    return FILE_TYPE_CATEGORIES.VIDEO
  }
  return null
}

// Get file category from MIME type
export function getFileCategoryFromMime(mimeType: string): string | null {
  if (mimeType.startsWith('image/')) {
    return FILE_TYPE_CATEGORIES.IMAGE
  }
  if (mimeType.startsWith('video/')) {
    return FILE_TYPE_CATEGORIES.VIDEO
  }
  if (mimeType === 'application/pdf' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'text/plain' ||
      mimeType === 'application/rtf' ||
      mimeType === 'text/rtf') {
    return FILE_TYPE_CATEGORIES.DOCUMENT
  }
  return null
}

export const INTERNAL_NOTE_CLOUDINARY_FOLDER = 'client-internal-notes'
