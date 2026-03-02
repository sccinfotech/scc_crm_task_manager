'use client'

/**
 * Shows user profile image when photo_url is present, otherwise initials with optional colored background.
 * Use for team members, assignees, and any list where user name is shown.
 */
export function StaffAvatar({
  photoUrl,
  fullName,
  email,
  size = 'md',
  className = '',
  bgClassName = 'bg-gradient-to-br from-cyan-500 to-blue-600',
  textClassName = 'text-white',
}: {
  photoUrl?: string | null
  fullName?: string | null
  email?: string | null
  size?: 'xs' | 'sm' | 'md'
  className?: string
  bgClassName?: string
  textClassName?: string
}) {
  const initials = fullName?.trim()
    ? fullName.trim().split(/\s+/).length >= 2
      ? (fullName.trim().split(/\s+/)[0][0] + fullName.trim().split(/\s+/).pop()![0]).toUpperCase()
      : fullName.trim().slice(0, 2).toUpperCase()
    : email?.trim()?.slice(0, 2).toUpperCase() ?? '?'

  const sizeClasses =
    size === 'xs' ? 'h-5 w-5 text-[10px]' : size === 'sm' ? 'h-6 w-6 text-xs' : 'h-7 w-7 sm:h-8 sm:w-8 text-xs'

  if (photoUrl?.trim()) {
    return (
      <img
        src={photoUrl}
        alt={fullName || email || 'User'}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm ${sizeClasses} ${className}`}
      />
    )
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClasses} ${bgClassName} ${textClassName} ring-2 ring-white shadow-sm ${className}`}
      aria-hidden
    >
      {initials}
    </span>
  )
}
