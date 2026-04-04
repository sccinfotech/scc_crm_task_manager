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
  done: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

/** Section header bar background (status-colored full row) */
export const TASK_STATUS_HEADER_BG: Record<TaskStatus, string> = {
  todo: 'bg-slate-100',
  in_progress: 'bg-amber-100',
  review: 'bg-indigo-100',
  done: 'bg-cyan-100',
  completed: 'bg-emerald-100',
}

/** Dot color for status (e.g. in dropdowns) – matches status semantics */
export const TASK_STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-amber-500',
  review: 'bg-indigo-500',
  done: 'bg-cyan-500',
  completed: 'bg-emerald-500',
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
export const TASK_VIDEO_MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024

export const TASK_ALLOWED_MIME_TYPES = [
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

export const TASK_ALLOWED_EXTENSIONS = [
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

export function getTaskAttachmentMaxSizeBytesForMime(mimeType: string): number {
  return mimeType.startsWith('video/')
    ? TASK_VIDEO_MAX_ATTACHMENT_SIZE_BYTES
    : TASK_MAX_ATTACHMENT_SIZE_BYTES
}

export const TASK_EXTENSION_MIME_MAP: Record<string, string> = {
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

export const TASK_CLOUDINARY_FOLDER = 'project-tasks'

export const TASK_COMMENT_REACTION_CATEGORIES = [
  { id: 'smileys', label: 'Smiles & People', icon: '🙂' },
  { id: 'gestures', label: 'Gestures', icon: '👍' },
  { id: 'celebration', label: 'Celebration', icon: '🎉' },
  { id: 'love', label: 'Love & Energy', icon: '❤️' },
  { id: 'work', label: 'Work & Status', icon: '✅' },
] as const
export type TaskCommentReactionCategory = (typeof TASK_COMMENT_REACTION_CATEGORIES)[number]['id']

export const TASK_COMMENT_REACTION_OPTIONS = [
  { emoji: '😀', name: 'Grinning Face', shortcode: ':grinning:', keywords: ['happy', 'smile', 'joy'], category: 'smileys' },
  { emoji: '😄', name: 'Smiling Face', shortcode: ':smile:', keywords: ['happy', 'smile', 'joy'], category: 'smileys' },
  { emoji: '😁', name: 'Beaming Face', shortcode: ':grin:', keywords: ['happy', 'cheerful'], category: 'smileys' },
  { emoji: '😅', name: 'Smiling Face With Sweat', shortcode: ':sweat_smile:', keywords: ['relief', 'nervous', 'funny'], category: 'smileys' },
  { emoji: '😂', name: 'Face With Tears of Joy', shortcode: ':joy:', keywords: ['funny', 'laugh', 'lol'], category: 'smileys' },
  { emoji: '🤣', name: 'Rolling on the Floor Laughing', shortcode: ':rofl:', keywords: ['funny', 'laugh', 'lol'], category: 'smileys' },
  { emoji: '😊', name: 'Smiling Face With Smiling Eyes', shortcode: ':blush:', keywords: ['happy', 'warm', 'kind'], category: 'smileys' },
  { emoji: '🙂', name: 'Slightly Smiling Face', shortcode: ':slightly_smiling_face:', keywords: ['smile', 'calm'], category: 'smileys' },
  { emoji: '😉', name: 'Winking Face', shortcode: ':wink:', keywords: ['playful'], category: 'smileys' },
  { emoji: '😍', name: 'Smiling Face With Heart-Eyes', shortcode: ':heart_eyes:', keywords: ['love', 'like'], category: 'smileys' },
  { emoji: '😎', name: 'Smiling Face With Sunglasses', shortcode: ':sunglasses:', keywords: ['cool', 'nice'], category: 'smileys' },
  { emoji: '🤔', name: 'Thinking Face', shortcode: ':thinking:', keywords: ['think', 'hmm'], category: 'smileys' },
  { emoji: '😮', name: 'Face With Open Mouth', shortcode: ':open_mouth:', keywords: ['wow', 'surprised'], category: 'smileys' },
  { emoji: '😢', name: 'Crying Face', shortcode: ':cry:', keywords: ['sad'], category: 'smileys' },
  { emoji: '😭', name: 'Loudly Crying Face', shortcode: ':sob:', keywords: ['sad', 'cry'], category: 'smileys' },
  { emoji: '😡', name: 'Pouting Face', shortcode: ':rage:', keywords: ['angry', 'mad'], category: 'smileys' },
  { emoji: '😴', name: 'Sleeping Face', shortcode: ':sleeping:', keywords: ['sleep', 'tired'], category: 'smileys' },
  { emoji: '👍', name: 'Thumbs Up', shortcode: ':+1:', keywords: ['approve', 'yes', 'good', 'like'], category: 'gestures' },
  { emoji: '👎', name: 'Thumbs Down', shortcode: ':-1:', keywords: ['disapprove', 'no', 'bad'], category: 'gestures' },
  { emoji: '👏', name: 'Clapping Hands', shortcode: ':clap:', keywords: ['applause', 'good job'], category: 'gestures' },
  { emoji: '🙌', name: 'Raising Hands', shortcode: ':raised_hands:', keywords: ['celebrate', 'hooray'], category: 'gestures' },
  { emoji: '🙏', name: 'Folded Hands', shortcode: ':pray:', keywords: ['thanks', 'please'], category: 'gestures' },
  { emoji: '💪', name: 'Flexed Biceps', shortcode: ':muscle:', keywords: ['strong', 'power'], category: 'gestures' },
  { emoji: '👀', name: 'Eyes', shortcode: ':eyes:', keywords: ['look', 'watch'], category: 'gestures' },
  { emoji: '🤝', name: 'Handshake', shortcode: ':handshake:', keywords: ['deal', 'agreement'], category: 'gestures' },
  { emoji: '✌️', name: 'Victory Hand', shortcode: ':v:', keywords: ['peace', 'win'], category: 'gestures' },
  { emoji: '👌', name: 'OK Hand', shortcode: ':ok_hand:', keywords: ['okay', 'perfect'], category: 'gestures' },
  { emoji: '🎉', name: 'Party Popper', shortcode: ':tada:', keywords: ['party', 'celebrate', 'congrats'], category: 'celebration' },
  { emoji: '🔥', name: 'Fire', shortcode: ':fire:', keywords: ['hot', 'great', 'lit'], category: 'celebration' },
  { emoji: '🚀', name: 'Rocket', shortcode: ':rocket:', keywords: ['launch', 'ship', 'fast'], category: 'celebration' },
  { emoji: '💯', name: 'Hundred Points', shortcode: ':100:', keywords: ['perfect', 'great'], category: 'celebration' },
  { emoji: '🏆', name: 'Trophy', shortcode: ':trophy:', keywords: ['win', 'success'], category: 'celebration' },
  { emoji: '⭐', name: 'Star', shortcode: ':star:', keywords: ['favorite', 'important'], category: 'celebration' },
  { emoji: '🥳', name: 'Partying Face', shortcode: ':partying_face:', keywords: ['party', 'celebrate'], category: 'celebration' },
  { emoji: '❤️', name: 'Red Heart', shortcode: ':heart:', keywords: ['love', 'like'], category: 'love' },
  { emoji: '💜', name: 'Purple Heart', shortcode: ':purple_heart:', keywords: ['love', 'care'], category: 'love' },
  { emoji: '💙', name: 'Blue Heart', shortcode: ':blue_heart:', keywords: ['love', 'care'], category: 'love' },
  { emoji: '💚', name: 'Green Heart', shortcode: ':green_heart:', keywords: ['love', 'care'], category: 'love' },
  { emoji: '💛', name: 'Yellow Heart', shortcode: ':yellow_heart:', keywords: ['love', 'care'], category: 'love' },
  { emoji: '💖', name: 'Sparkling Heart', shortcode: ':sparkling_heart:', keywords: ['love', 'sparkle'], category: 'love' },
  { emoji: '🥰', name: 'Smiling Face With Hearts', shortcode: ':smiling_face_with_3_hearts:', keywords: ['love', 'care', 'adore'], category: 'love' },
  { emoji: '✅', name: 'Check Mark Button', shortcode: ':white_check_mark:', keywords: ['done', 'approved', 'complete'], category: 'work' },
  { emoji: '☑️', name: 'Check Box With Check', shortcode: ':ballot_box_with_check:', keywords: ['task', 'check'], category: 'work' },
  { emoji: '⚡', name: 'High Voltage', shortcode: ':zap:', keywords: ['fast', 'energy'], category: 'work' },
  { emoji: '📌', name: 'Pushpin', shortcode: ':pushpin:', keywords: ['pin', 'important'], category: 'work' },
  { emoji: '📝', name: 'Memo', shortcode: ':memo:', keywords: ['note', 'write'], category: 'work' },
  { emoji: '🎯', name: 'Direct Hit', shortcode: ':dart:', keywords: ['target', 'goal'], category: 'work' },
  { emoji: '💡', name: 'Light Bulb', shortcode: ':bulb:', keywords: ['idea', 'insight'], category: 'work' },
  { emoji: '⏳', name: 'Hourglass', shortcode: ':hourglass_flowing_sand:', keywords: ['waiting', 'time'], category: 'work' },
] as const satisfies ReadonlyArray<{
  emoji: string
  name: string
  shortcode: string
  keywords: readonly string[]
  category: TaskCommentReactionCategory
}>

export const TASK_COMMENT_REACTION_EMOJIS = Array.from(
  new Set(TASK_COMMENT_REACTION_OPTIONS.map((option) => option.emoji))
) as readonly string[]
export type TaskCommentReactionEmoji = (typeof TASK_COMMENT_REACTION_EMOJIS)[number]

/** Pagination limits for task detail initial load (comments, activity, attachments) */
export const TASK_DETAIL_COMMENTS_LIMIT = 20
export const TASK_DETAIL_ACTIVITY_LIMIT = 20
export const TASK_DETAIL_ATTACHMENTS_LIMIT = 20
