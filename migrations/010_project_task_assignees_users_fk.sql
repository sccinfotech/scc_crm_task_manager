-- Migration 010: Link project_task_assignees.user_id to public.users for PostgREST relationship
-- PostgREST only sees relationships via foreign keys. Assignees currently reference auth.users;
-- adding a FK to public.users(id) allows queries like project_task_assignees(user_id, users(full_name, email)).
-- public.users.id = auth.users.id, so this is consistent.

ALTER TABLE public.project_task_assignees
  DROP CONSTRAINT IF EXISTS project_task_assignees_user_id_fkey;

ALTER TABLE public.project_task_assignees
  ADD CONSTRAINT project_task_assignees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Optional: same for assigned_by so any future embed of assigner uses public.users
ALTER TABLE public.project_task_assignees
  DROP CONSTRAINT IF EXISTS project_task_assignees_assigned_by_fkey;

ALTER TABLE public.project_task_assignees
  ADD CONSTRAINT project_task_assignees_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE RESTRICT;
