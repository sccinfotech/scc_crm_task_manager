'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { createActivityLogEntry } from '@/lib/activity-log/logger'

export async function logout() {
  const currentUser = await getCurrentUser()
  if (currentUser) {
    await createActivityLogEntry({
      userId: currentUser.id,
      userName: currentUser.fullName ?? currentUser.email,
      actionType: 'Logout',
      moduleName: 'Auth',
      description: 'User logged out',
      status: 'Success',
    })
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
