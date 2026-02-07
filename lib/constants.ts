export const MODULES = [
    { id: 'leads', label: 'Leads' },
    { id: 'customers', label: 'Clients' },
    { id: 'payments', label: 'Payments' },
    { id: 'follow_ups', label: 'Follow-ups' },
    { id: 'reports', label: 'Reports' },
    { id: 'logs', label: 'Logs' },
    { id: 'settings', label: 'System Settings' },
    { id: 'users', label: 'User Management' },
] as const

export type ModuleId = typeof MODULES[number]['id']
