import { requireAuth, hasPermission } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { getTechnologyTools } from '@/lib/settings/technology-tools-actions'
import { TechnologyToolsClient } from './technology-tools-client'

export default async function SettingsPage() {
  const user = await requireAuth()
  const canRead = await hasPermission(user, MODULE_PERMISSION_IDS.settings, 'read')

  if (!canRead) {
    redirect('/dashboard?error=unauthorized')
  }

  const canWrite = await hasPermission(user, MODULE_PERMISSION_IDS.settings, 'write')
  const toolsResult = await getTechnologyTools({ includeInactive: true })

  if (toolsResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p>Failed to load technology tools: {toolsResult.error}</p>
      </div>
    )
  }

  return <TechnologyToolsClient tools={toolsResult.data} canWrite={canWrite} />
}
