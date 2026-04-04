export const TEAM_TALK_MAX_ATTACHMENTS = 5
export const TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024
export const TEAM_TALK_VIDEO_MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024

export const TEAM_TALK_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'application/pdf',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/quicktime',
] as const

export const TEAM_TALK_ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'pdf',
  'txt',
  'rtf',
  'docx',
  'xlsx',
  'mov',
] as const

export const TEAM_TALK_EXTENSION_MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  rtf: 'application/rtf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mov: 'video/quicktime',
}

export function getTeamTalkAttachmentMaxSizeBytesForMime(mimeType: string): number {
  return getFileCategoryFromMime(mimeType) === 'video'
    ? TEAM_TALK_VIDEO_MAX_ATTACHMENT_SIZE_BYTES
    : TEAM_TALK_MAX_ATTACHMENT_SIZE_BYTES
}

export function getFileCategory(extension: string): string | null {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
  const documentExtensions = ['pdf', 'docx', 'xlsx', 'txt', 'rtf']
  const videoExtensions = ['mov']

  if (imageExtensions.includes(extension.toLowerCase())) {
    return 'image'
  }
  if (documentExtensions.includes(extension.toLowerCase())) {
    return 'document'
  }
  if (videoExtensions.includes(extension.toLowerCase())) {
    return 'video'
  }
  return null
}

export function getFileCategoryFromMime(mimeType: string): string | null {
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType.startsWith('video/')) {
    return 'video'
  }
  if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/plain' ||
    mimeType === 'application/rtf' ||
    mimeType === 'text/rtf'
  ) {
    return 'document'
  }
  return null
}

export const TEAM_TALK_CLOUDINARY_FOLDER = 'project-team-talk'
