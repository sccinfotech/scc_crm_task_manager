import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const isCron = request.headers.get('x-vercel-cron')
  if (!isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const today = `${yyyy}-${mm}-${dd}`

  const { data: tasks, error: tasksError } = await supabase
    .from('project_tasks')
    .select('id, title, project_id')
    .eq('due_date', today)
    .in('status', ['todo', 'in_progress', 'review'])

  if (tasksError) {
    console.error('Due date cron error:', tasksError)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }

  const taskList = (tasks ?? []) as Array<{ id: string; title: string; project_id: string }>
  if (taskList.length === 0) {
    return NextResponse.json({ inserted: 0 })
  }

  const taskIds = taskList.map((task) => task.id)

  type AssigneeRow = { task_id: string; user_id: string }
  const { data: assigneesData } = await supabase
    .from('project_task_assignees')
    .select('task_id, user_id')
    .in('task_id', taskIds)
  const assignees = (assigneesData ?? []) as AssigneeRow[]

  const { data: existing } = await supabase
    .from('notifications')
    .select('task_id, user_id, created_at')
    .eq('type', 'due_date')
    .gte('created_at', `${today}T00:00:00.000Z`)

  type NotifRow = { task_id: string | null; user_id: string }
  const existingList = (existing ?? []) as NotifRow[]
  const existingSet = new Set(
    existingList.map((row) => `${row.task_id}:${row.user_id}`)
  )

  const byTask = new Map<string, { id: string; title: string; project_id: string }>()
  taskList.forEach((task) => {
    byTask.set(task.id, task)
  })

  const notifications = assignees
    .filter((row) => !existingSet.has(`${row.task_id}:${row.user_id}`))
    .map((row) => {
      const task = byTask.get(row.task_id)
      return {
        user_id: row.user_id,
        project_id: task?.project_id ?? null,
        task_id: row.task_id,
        type: 'due_date',
        title: 'Task due today',
        body: task?.title ?? 'Task due today',
        meta: { due_date: today },
        created_by: null,
      }
    })

  if (notifications.length === 0) {
    return NextResponse.json({ inserted: 0 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase.from('notifications') as any).insert(notifications)

  if (insertError) {
    console.error('Due date insert error:', insertError)
    return NextResponse.json({ error: 'Failed to insert notifications' }, { status: 500 })
  }

  return NextResponse.json({ inserted: notifications.length })
}
