export type AccessLevel = 'read' | 'write' | 'none'
export type ModulePermissions = Record<string, AccessLevel>

export const MODULE_PERMISSION_IDS = {
  leads: 'leads',
  clients: 'customers',
  quotations: 'quotations',
  projects: 'projects',
  logs: 'logs',
  settings: 'settings',
  users: 'users',
  accounting: 'accounting',
} as const

type PermissionContext = {
  role?: string | null
  modulePermissions?: ModulePermissions | null
}

export function getModuleAccessLevel(
  context: PermissionContext,
  moduleId: string
): AccessLevel {
  const role = context.role || null

  if (!role) return 'none'
  if (role === 'admin') return 'write'

  if (role === 'manager') {
    if (moduleId === 'users' || moduleId === 'settings') return 'none'
    return 'write'
  }

  const permissions = context.modulePermissions || {}
  const level = permissions[moduleId]

  if (level === 'read' || level === 'write') return level
  return 'none'
}

export function canReadModule(context: PermissionContext, moduleId: string): boolean {
  const level = getModuleAccessLevel(context, moduleId)
  return level === 'read' || level === 'write'
}

export function canWriteModule(context: PermissionContext, moduleId: string): boolean {
  return getModuleAccessLevel(context, moduleId) === 'write'
}
