import { requireAuth } from '@/lib/auth/utils'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SelfProfileClient, type SelfProfileUser } from './self-profile-client'

export default async function SelfProfilePage() {
  const currentUser = await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, full_name, designation, joining_date, personal_email, personal_mobile_no, home_mobile_no, address, date_of_birth, photo_url, role, is_active, created_at, updated_at'
    )
    .eq('id', currentUser.id)
    .single()

  if (error || !data) return notFound()

  const row = data as any
  const profile: SelfProfileUser = {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    designation: row.designation,
    joining_date: row.joining_date,
    personal_email: row.personal_email,
    personal_mobile_no: row.personal_mobile_no,
    home_mobile_no: row.home_mobile_no,
    address: row.address,
    date_of_birth: row.date_of_birth,
    photo_url: row.photo_url,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }

  return <SelfProfileClient user={profile} />
}

