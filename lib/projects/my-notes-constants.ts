export const PROJECT_NOTE_MAX_ATTACHMENTS = 5
export const PROJECT_NOTE_MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024

export const FILE_TYPE_CATEGORIES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
} as const

export const PROJECT_NOTE_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export const PROJECT_NOTE_ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'pdf',
  'docx',
  'xlsx',
] as const

export const PROJECT_NOTE_EXTENSION_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

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

export function getFileCategoryFromMime(mimeType: string): string | null {
  if (mimeType.startsWith('image/')) {
    return FILE_TYPE_CATEGORIES.IMAGE
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return FILE_TYPE_CATEGORIES.DOCUMENT
  }
  return null
}

export const PROJECT_NOTE_CLOUDINARY_FOLDER = 'project-my-notes'
