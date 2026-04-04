export const PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024
export const PROJECT_REQUIREMENT_VIDEO_MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024

export const PROJECT_REQUIREMENT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/zip',
  'application/x-zip-compressed',
  'video/quicktime',
] as const

export const PROJECT_REQUIREMENT_ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'rtf',
  'zip',
  'mov',
] as const

export function getProjectRequirementMaxAttachmentSizeBytes(mimeType: string, extension: string): number {
  const ext = extension.toLowerCase()
  if (ext === 'mov' || mimeType.startsWith('video/')) {
    return PROJECT_REQUIREMENT_VIDEO_MAX_ATTACHMENT_SIZE_BYTES
  }
  return PROJECT_REQUIREMENT_MAX_ATTACHMENT_SIZE_BYTES
}

export const PROJECT_REQUIREMENT_EXTENSION_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  rtf: 'application/rtf',
  zip: 'application/zip',
  mov: 'video/quicktime',
}

export const PROJECT_REQUIREMENT_CLOUDINARY_FOLDER = 'project-requirements'
