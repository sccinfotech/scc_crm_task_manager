export const INTERNAL_NOTE_MAX_ATTACHMENTS = 5
export const INTERNAL_NOTE_MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024

// File type categories
export const FILE_TYPE_CATEGORIES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
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
}

// Get file category from extension
export function getFileCategory(extension: string): string | null {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
  const documentExtensions = ['pdf', 'docx', 'xlsx']
  
  if (imageExtensions.includes(extension.toLowerCase())) {
    return FILE_TYPE_CATEGORIES.IMAGE
  }
  if (documentExtensions.includes(extension.toLowerCase())) {
    return FILE_TYPE_CATEGORIES.DOCUMENT
  }
  return null
}

// Get file category from MIME type
export function getFileCategoryFromMime(mimeType: string): string | null {
  if (mimeType.startsWith('image/')) {
    return FILE_TYPE_CATEGORIES.IMAGE
  }
  if (mimeType === 'application/pdf' || 
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return FILE_TYPE_CATEGORIES.DOCUMENT
  }
  return null
}

export const INTERNAL_NOTE_CLOUDINARY_FOLDER = 'client-internal-notes'
