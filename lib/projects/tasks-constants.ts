export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'completed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_TYPES = ['feature', 'bug', 'improvement', 'research', 'other'] as const
export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  completed: 'Completed',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  feature: 'Feature',
  bug: 'Bug',
  improvement: 'Improvement',
  research: 'Research',
  other: 'Other',
}

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-200',
  review: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

/** Section header bar background (status-colored full row) */
export const TASK_STATUS_HEADER_BG: Record<TaskStatus, string> = {
  todo: 'bg-slate-100',
  in_progress: 'bg-amber-100',
  review: 'bg-indigo-100',
  done: 'bg-emerald-100',
  completed: 'bg-cyan-100',
}

/** Dot color for status (e.g. in dropdowns) – matches status semantics */
export const TASK_STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-amber-500',
  review: 'bg-indigo-500',
  done: 'bg-emerald-500',
  completed: 'bg-cyan-500',
}

export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgent: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  medium: 'bg-sky-100 text-sky-700 border-sky-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
}

/** Flag icon color for priority (e.g. in dropdowns) – light yellow (High), light sky (Medium), light gray (Low) */
export const TASK_PRIORITY_FLAG_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-rose-500',
  high: 'text-yellow-500',
  medium: 'text-sky-500',
  low: 'text-slate-400',
}

export const TASK_MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024

export const TASK_ALLOWED_MIME_TYPES = [
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

export const TASK_ALLOWED_EXTENSIONS = [
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

export const TASK_EXTENSION_MIME_MAP: Record<string, string> = {
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

export const TASK_CLOUDINARY_FOLDER = 'project-tasks'
