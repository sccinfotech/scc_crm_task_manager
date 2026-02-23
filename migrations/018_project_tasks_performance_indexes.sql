-- Migration 018: Project Tasks Performance Indexes
-- Adds composite indexes to optimize common query patterns for project tasks
-- Depends on: 008_project_tasks

-- Composite index for the main query pattern: filter by project_id and order by created_at
-- This significantly speeds up the getProjectTasks query which filters by project and orders by created_at DESC
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_created_at 
  ON public.project_tasks(project_id, created_at DESC);

-- Composite index for filtering by project_id and status (common filter pattern)
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status 
  ON public.project_tasks(project_id, status);

-- Composite index for assignee filter queries: user_id + task_id lookup
-- This helps when filtering tasks by assignee (mine_only or assignee_ids filters)
CREATE INDEX IF NOT EXISTS idx_project_task_assignees_user_task 
  ON public.project_task_assignees(user_id, task_id);
