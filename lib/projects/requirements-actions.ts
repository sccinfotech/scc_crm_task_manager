'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { encryptAmount, decryptAmount } from '@/lib/amount-encryption'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, hasPermission } from '@/lib/auth/utils'
import { MODULE_PERMISSION_IDS } from '@/lib/permissions'
import { PROJECT_REQUIREMENT_CLOUDINARY_FOLDER } from '@/lib/projects/requirements-constants'

type CloudinaryUploadSignature = {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  folder: string
}

export type RequirementType = 'initial' | 'addon'
export type PricingType = 'hourly' | 'fixed' | 'milestone'

export type ProjectRequirement = {
  id: string
  project_id: string
  requirement_type: RequirementType
  pricing_type: PricingType
  description: string | null
  attachment_url: string | null
  estimated_hours: number | null
  hourly_rate: number | null
  amount: number | null
  milestones?: ProjectRequirementMilestone[]
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type RequirementSummary = {
  initialAmount: number
  addonAmount: number
  totalAmount: number
}

export type ProjectRequirementsResult = {
  data: ProjectRequirement[] | null
  summary: RequirementSummary | null
  error: string | null
}

export type ProjectRequirementActionResult = {
  data: ProjectRequirement | null
  error: string | null
}

export type ProjectRequirementFormData = {
  requirement_type?: RequirementType
  pricing_type?: PricingType
  description?: string | null
  attachment_url?: string | null
  estimated_hours?: number | null
  hourly_rate?: number | null
  amount?: number | null
  milestones?: ProjectRequirementMilestoneInput[]
}

export type ProjectRequirementMilestoneInput = {
  title: string
  description?: string | null
  due_date?: string | null
  amount: number | null
}

export type ProjectRequirementMilestone = ProjectRequirementMilestoneInput & {
  id: string
  requirement_id: string
  project_id: string
  created_by: string
  created_at: string
  updated_at: string
}

function isAdminManager(role?: string | null) {
  return role === 'admin' || role === 'manager'
}

function normalizeNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function getEnvVar(name: string, isPublic = false): string {
  const value = process.env[name]
  if (!value) {
    const visibility = isPublic ? 'public' : 'server-only'
    throw new Error(
      `Missing required ${visibility} environment variable: ${name}. ` +
        'Add it to .env.local and restart the dev server.'
    )
  }
  return value
}

function getCloudinaryConfig() {
  const cloudName = getEnvVar('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', true)
  const apiKey = getEnvVar('NEXT_PUBLIC_CLOUDINARY_API_KEY', true)
  const apiSecret = getEnvVar('CLOUDINARY_API_SECRET', false)

  return { cloudName, apiKey, apiSecret }
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex')
}

async function isUserAssignedToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_team_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return false
  const row = data as { user_id?: string } | null
  return Boolean(row?.user_id)
}

async function applyProjectAmountDelta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  delta: number
) {
  if (!Number.isFinite(delta) || delta === 0) return { error: null }

  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .select('project_amount')
    .eq('id', projectId)
    .single()

  if (projectError || !projectRow) {
    console.error('Error fetching project amount:', projectError)
    return { error: projectError?.message || 'Failed to update project amount' }
  }

  const currentAmount = decryptAmount((projectRow as { project_amount: string | null }).project_amount) ?? 0
  const nextAmount = roundCurrency(currentAmount + delta)
  const safeAmount = nextAmount < 0 ? 0 : nextAmount
  const encryptedAmount = encryptAmount(safeAmount)

  const { error: updateError } = await supabase
    .from('projects')
    .update({ project_amount: encryptedAmount } as never)
    .eq('id', projectId)

  if (updateError) {
    console.error('Error updating project amount:', updateError)
    return { error: updateError.message || 'Failed to update project amount' }
  }

  return { error: null }
}

async function replaceRequirementMilestones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requirementId: string,
  projectId: string,
  milestones: ProjectRequirementMilestoneInput[],
  userId: string
) {
  await supabase
    .from('project_requirement_milestones')
    .delete()
    .eq('requirement_id', requirementId)

  if (milestones.length === 0) return { error: null }

  const rows = milestones.map((milestone) => ({
    requirement_id: requirementId,
    project_id: projectId,
    title: milestone.title.trim(),
    description: milestone.description?.trim() || null,
    due_date: milestone.due_date || null,
    amount: encryptAmount(milestone.amount ?? 0) ?? '0',
    created_by: userId,
  }))

  const { error } = await supabase
    .from('project_requirement_milestones')
    .insert(rows as never)

  if (error) {
    console.error('Error saving requirement milestones:', error)
    return { error: error.message || 'Failed to save milestones' }
  }

  return { error: null }
}

function buildRequirement(
  row: any,
  createdByName?: string | null,
  milestones?: ProjectRequirementMilestone[]
): ProjectRequirement {
  return {
    id: row.id,
    project_id: row.project_id,
    requirement_type: row.requirement_type as RequirementType,
    pricing_type: (row.pricing_type ?? 'hourly') as PricingType,
    description: row.description ?? null,
    attachment_url: row.attachment_url ?? null,
    estimated_hours: normalizeNumber(row.estimated_hours),
    hourly_rate: decryptAmount(row.hourly_rate) ?? null,
    amount: decryptAmount(row.amount) ?? null,
    milestones,
    created_by: row.created_by,
    created_by_name: createdByName ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function computeSummary(requirements: ProjectRequirement[]): RequirementSummary {
  let initialAmount = 0
  let addonAmount = 0
  requirements.forEach((req) => {
    const amount = req.amount ?? 0
    if (req.requirement_type === 'initial') {
      initialAmount += amount
    } else {
      addonAmount += amount
    }
  })

  return {
    initialAmount: roundCurrency(initialAmount),
    addonAmount: roundCurrency(addonAmount),
    totalAmount: roundCurrency(initialAmount + addonAmount),
  }
}

export async function getProjectRequirementUploadSignature(
  projectId: string
): Promise<{ data: CloudinaryUploadSignature | null; error: string | null }> {
  void projectId
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to upload attachments.' }
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!isAdmin && !canWrite) {
    return { data: null, error: 'You do not have permission to upload attachments.' }
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const folder = PROJECT_REQUIREMENT_CLOUDINARY_FOLDER
  const signature = signCloudinaryParams({ timestamp, folder }, apiSecret)

  return {
    data: {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
    },
    error: null,
  }
}

export async function getProjectRequirements(projectId: string): Promise<ProjectRequirementsResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, summary: null, error: 'You must be logged in to view requirements' }
  }

  const canRead = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'read')
  const isAdmin = isAdminManager(currentUser.role)
  const supabase = await createClient()
  if (!isAdmin && !canRead) {
    const isAssigned = await isUserAssignedToProject(supabase, projectId, currentUser.id)
    if (!isAssigned) {
      return { data: null, summary: null, error: 'You do not have permission to view requirements' }
    }
  }

  const { data: requirements, error } = await supabase
    .from('project_requirements')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching project requirements:', error)
    return { data: null, summary: null, error: error.message || 'Failed to fetch requirements' }
  }

  const requirementRows = (requirements || []) as Array<{
    id: string
    project_id: string
    requirement_type: string
    pricing_type?: string | null
    title: string | null
    description: string | null
    attachment_url: string | null
    estimated_hours: number | string | null
    hourly_rate: string | null
    amount: string | null
    created_by: string
    created_at: string
    updated_at: string
    is_deleted: boolean
  }>

  if (requirementRows.length === 0) {
    return { data: [], summary: computeSummary([]), error: null }
  }

  const requirementIds = requirementRows.map((row) => row.id)
  const { data: milestoneRows } = await supabase
    .from('project_requirement_milestones')
    .select('*')
    .in('requirement_id', requirementIds)
    .order('created_at', { ascending: true })

  type MilestoneRow = {
    id: string
    requirement_id: string
    project_id: string
    title: string
    description: string | null
    due_date: string | null
    amount: string
    created_by: string
    created_at: string
    updated_at: string
  }

  const milestonesByRequirement = new Map<string, ProjectRequirementMilestone[]>()
  ;(milestoneRows as MilestoneRow[] | null)?.forEach((row) => {
    const list = milestonesByRequirement.get(row.requirement_id) || []
    list.push({
      id: row.id,
      requirement_id: row.requirement_id,
      project_id: row.project_id,
      title: row.title,
      description: row.description ?? null,
      due_date: row.due_date ?? null,
      amount: decryptAmount(row.amount) ?? 0,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
    milestonesByRequirement.set(row.requirement_id, list)
  })

  const userIds = [...new Set(requirementRows.map((req) => req.created_by))]
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds)

  const userMap = new Map<string, string>()
  ;(users as Array<{ id: string; full_name: string | null }> | null)?.forEach((user) => {
    userMap.set(user.id, user.full_name || 'Unknown User')
  })

  const result = requirementRows.map((row) =>
    buildRequirement(row, userMap.get(row.created_by) || null, milestonesByRequirement.get(row.id) || [])
  )
  return { data: result, summary: computeSummary(result), error: null }
}

export async function createProjectRequirement(
  projectId: string,
  formData: ProjectRequirementFormData
): Promise<ProjectRequirementActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to add requirements' }
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!isAdmin && !canWrite) {
    return { data: null, error: 'You do not have permission to add requirements' }
  }

  const supabase = await createClient()
  const requirementType = formData.requirement_type ?? 'initial'
  if (!['initial', 'addon'].includes(requirementType)) {
    return { data: null, error: 'Invalid requirement type' }
  }

  const pricingType = formData.pricing_type ?? 'hourly'
  if (!['hourly', 'fixed', 'milestone'].includes(pricingType)) {
    return { data: null, error: 'Invalid pricing type' }
  }

  const description = formData.description?.trim() || null

  let milestones: ProjectRequirementMilestoneInput[] = []
  let milestonesTotal: number | null = null

  if (pricingType === 'milestone') {
    const rawMilestones = Array.isArray(formData.milestones) ? formData.milestones : []
    if (rawMilestones.length === 0) {
      return { data: null, error: 'Please add at least one milestone.' }
    }

    let total = 0
    for (const milestone of rawMilestones) {
      const title = milestone.title?.trim() ?? ''
      if (!title) {
        return { data: null, error: 'Milestone title is required.' }
      }
      const amount = normalizeNumber(milestone.amount)
      if (amount === null || amount < 0) {
        return { data: null, error: 'Milestone amount must be zero or greater.' }
      }
      total += amount
      milestones.push({
        title,
        description: milestone.description?.trim() || null,
        due_date: milestone.due_date || null,
        amount,
      })
    }

    milestonesTotal = roundCurrency(total)
  }

  const estimatedHours = pricingType === 'hourly' ? normalizeNumber(formData.estimated_hours) : null
  if (estimatedHours !== null && estimatedHours < 0) {
    return { data: null, error: 'Estimated hours must be zero or greater' }
  }

  const hourlyRate = pricingType === 'hourly' ? normalizeNumber(formData.hourly_rate) : null
  if (hourlyRate !== null && hourlyRate < 0) {
    return { data: null, error: 'Hourly rate must be zero or greater' }
  }

  const amountInput = pricingType === 'milestone' ? null : normalizeNumber(formData.amount)
  if (amountInput !== null && amountInput < 0) {
    return { data: null, error: 'Amount must be zero or greater' }
  }

  const calculatedAmount =
    pricingType === 'milestone'
      ? milestonesTotal
      : pricingType === 'hourly' && amountInput === null && estimatedHours !== null && hourlyRate !== null
        ? roundCurrency(estimatedHours * hourlyRate)
        : amountInput

  const attachmentUrl = formData.attachment_url?.trim() || null

  const { data, error } = await supabase
    .from('project_requirements')
    .insert({
      project_id: projectId,
      requirement_type: requirementType,
      pricing_type: pricingType,
      description,
      attachment_url: attachmentUrl,
      estimated_hours: estimatedHours,
      hourly_rate: hourlyRate !== null ? encryptAmount(hourlyRate) : null,
      amount: calculatedAmount !== null ? encryptAmount(calculatedAmount) : null,
      created_by: currentUser.id,
    } as never)
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating project requirement:', error)
    return { data: null, error: error?.message || 'Failed to create requirement' }
  }

  if (pricingType === 'milestone') {
    const milestoneResult = await replaceRequirementMilestones(
      supabase,
      (data as { id: string }).id,
      projectId,
      milestones,
      currentUser.id
    )
    if (milestoneResult.error) {
      await supabase.from('project_requirements').delete().eq('id', (data as { id: string }).id)
      return { data: null, error: milestoneResult.error }
    }
  }

  if (calculatedAmount !== null) {
    const amountUpdate = await applyProjectAmountDelta(supabase, projectId, calculatedAmount)
    if (amountUpdate.error) {
      return { data: null, error: amountUpdate.error }
    }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard/projects')

  const createdByName = currentUser.fullName ?? currentUser.email ?? 'You'
  return { data: buildRequirement(data, createdByName), error: null }
}

export async function updateProjectRequirement(
  requirementId: string,
  formData: ProjectRequirementFormData
): Promise<ProjectRequirementActionResult> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { data: null, error: 'You must be logged in to update requirements' }
  }

  const supabase = await createClient()
  const { data: existing, error: fetchError } = await supabase
    .from('project_requirements')
    .select('*')
    .eq('id', requirementId)
    .single()

  if (fetchError || !existing) {
    return { data: null, error: 'Requirement not found' }
  }

  if ((existing as { is_deleted?: boolean }).is_deleted) {
    return { data: null, error: 'Requirement not found' }
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!isAdmin && !canWrite) {
    return { data: null, error: 'You do not have permission to update requirements' }
  }

  const requirementType = formData.requirement_type ?? (existing as { requirement_type: RequirementType }).requirement_type
  if (!['initial', 'addon'].includes(requirementType)) {
    return { data: null, error: 'Invalid requirement type' }
  }

  const existingPricingType = (existing as { pricing_type?: PricingType }).pricing_type ?? 'hourly'
  const pricingType = formData.pricing_type ?? existingPricingType ?? 'hourly'
  if (!['hourly', 'fixed', 'milestone'].includes(pricingType)) {
    return { data: null, error: 'Invalid pricing type' }
  }

  const description =
    formData.description !== undefined
      ? formData.description?.trim() || null
      : (existing as { description: string | null }).description ?? null

  const hasMilestoneInput = Array.isArray(formData.milestones)
  let milestones: ProjectRequirementMilestoneInput[] | null = null
  let milestonesTotal: number | null = null

  if (pricingType === 'milestone') {
    if (hasMilestoneInput) {
      const rawMilestones = formData.milestones ?? []
      if (rawMilestones.length === 0) {
        return { data: null, error: 'Please add at least one milestone.' }
      }

      let total = 0
      const normalized: ProjectRequirementMilestoneInput[] = []
      for (const milestone of rawMilestones) {
        const title = milestone.title?.trim() ?? ''
        if (!title) {
          return { data: null, error: 'Milestone title is required.' }
        }
        const amount = normalizeNumber(milestone.amount)
        if (amount === null || amount < 0) {
          return { data: null, error: 'Milestone amount must be zero or greater.' }
        }
        total += amount
        normalized.push({
          title,
          description: milestone.description?.trim() || null,
          due_date: milestone.due_date || null,
          amount,
        })
      }

      milestones = normalized
      milestonesTotal = roundCurrency(total)
    } else if (existingPricingType !== 'milestone') {
      return { data: null, error: 'Please add at least one milestone.' }
    } else {
      milestonesTotal = decryptAmount(existing.amount)
    }
  }

  const estimatedHours =
    pricingType === 'hourly'
      ? formData.estimated_hours !== undefined
        ? normalizeNumber(formData.estimated_hours)
        : normalizeNumber((existing as { estimated_hours: number | string | null }).estimated_hours)
      : null
  if (estimatedHours !== null && estimatedHours < 0) {
    return { data: null, error: 'Estimated hours must be zero or greater' }
  }

  const hourlyRate =
    pricingType === 'hourly'
      ? formData.hourly_rate !== undefined
        ? normalizeNumber(formData.hourly_rate)
        : decryptAmount(existing.hourly_rate)
      : null
  if (hourlyRate !== null && hourlyRate < 0) {
    return { data: null, error: 'Hourly rate must be zero or greater' }
  }

  const amountInput =
    pricingType === 'milestone'
      ? null
      : formData.amount !== undefined
        ? normalizeNumber(formData.amount)
        : decryptAmount(existing.amount)
  if (amountInput !== null && amountInput < 0) {
    return { data: null, error: 'Amount must be zero or greater' }
  }

  const calculatedAmount =
    pricingType === 'milestone'
      ? milestonesTotal
      : pricingType === 'hourly' && amountInput === null && estimatedHours !== null && hourlyRate !== null
        ? roundCurrency(estimatedHours * hourlyRate)
        : amountInput

  const attachmentUrl =
    formData.attachment_url !== undefined
      ? formData.attachment_url?.trim() || null
      : (existing as { attachment_url: string | null }).attachment_url ?? null

  const { data, error } = await supabase
    .from('project_requirements')
    .update({
      requirement_type: requirementType,
      pricing_type: pricingType,
      description,
      attachment_url: attachmentUrl,
      estimated_hours: estimatedHours,
      hourly_rate: hourlyRate !== null ? encryptAmount(hourlyRate) : null,
      amount: calculatedAmount !== null ? encryptAmount(calculatedAmount) : null,
    } as never)
    .eq('id', requirementId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating project requirement:', error)
    return { data: null, error: error?.message || 'Failed to update requirement' }
  }

  if (pricingType === 'milestone' && milestones) {
    const milestoneResult = await replaceRequirementMilestones(
      supabase,
      requirementId,
      (existing as { project_id: string }).project_id,
      milestones,
      currentUser.id
    )
    if (milestoneResult.error) {
      return { data: null, error: milestoneResult.error }
    }
  }

  if (pricingType !== 'milestone' && existingPricingType === 'milestone') {
    const milestoneResult = await replaceRequirementMilestones(
      supabase,
      requirementId,
      (existing as { project_id: string }).project_id,
      [],
      currentUser.id
    )
    if (milestoneResult.error) {
      return { data: null, error: milestoneResult.error }
    }
  }

  const previousAmount = decryptAmount(existing.amount)
  const nextAmount = calculatedAmount
  const delta =
    previousAmount === null && nextAmount === null
      ? 0
      : roundCurrency((nextAmount ?? 0) - (previousAmount ?? 0))

  if (delta !== 0) {
    const amountUpdate = await applyProjectAmountDelta(
      supabase,
      (existing as { project_id: string }).project_id,
      delta
    )
    if (amountUpdate.error) {
      return { data: null, error: amountUpdate.error }
    }
  }

  revalidatePath(`/dashboard/projects/${(existing as { project_id: string }).project_id}`)
  revalidatePath('/dashboard/projects')

  const createdByName = currentUser.fullName ?? currentUser.email ?? null
  return { data: buildRequirement(data, createdByName), error: null }
}

export async function deleteProjectRequirement(requirementId: string): Promise<{ error: string | null }> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return { error: 'You must be logged in to delete requirements' }
  }

  const supabase = await createClient()
  const { data: existing, error: fetchError } = await supabase
    .from('project_requirements')
    .select('id, project_id, amount, is_deleted')
    .eq('id', requirementId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Requirement not found' }
  }

  if ((existing as { is_deleted?: boolean }).is_deleted) {
    return { error: null }
  }

  const canWrite = await hasPermission(currentUser, MODULE_PERMISSION_IDS.projects, 'write')
  const isAdmin = isAdminManager(currentUser.role)
  if (!isAdmin && !canWrite) {
    return { error: 'You do not have permission to delete requirements' }
  }

  const { error: updateError } = await supabase
    .from('project_requirements')
    .update({ is_deleted: true } as never)
    .eq('id', requirementId)

  if (updateError) {
    console.error('Error deleting project requirement:', updateError)
    return { error: updateError.message || 'Failed to delete requirement' }
  }

  const amount = decryptAmount((existing as { amount: string | null }).amount)
  if (amount !== null) {
    const amountUpdate = await applyProjectAmountDelta(
      supabase,
      (existing as { project_id: string }).project_id,
      -amount
    )
    if (amountUpdate.error) {
      return { error: amountUpdate.error }
    }
  }

  revalidatePath(`/dashboard/projects/${(existing as { project_id: string }).project_id}`)
  revalidatePath('/dashboard/projects')
  return { error: null }
}
