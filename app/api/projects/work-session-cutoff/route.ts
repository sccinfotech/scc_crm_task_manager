import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { autoEndWorkSessionsAtCutoff } from '@/lib/projects/work-cutoff'

export async function GET(request: Request) {
  const isCron = request.headers.get('x-vercel-cron')
  if (!isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const result = await autoEndWorkSessionsAtCutoff(supabase)

  return NextResponse.json({
    endedSessions: result.endedSessions.length,
    cutoffIso: result.cutoffIso,
    cutoffLabel: result.cutoffLabel,
    timezone: result.timezone,
  })
}
