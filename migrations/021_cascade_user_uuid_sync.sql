-- Migration 021: Cascade User UUID Sync
--
-- Problem:
--   When a user logs in for the first time via Google, we sync their placeholder
--   UUID in `public.users` with the real UUID from `auth.users`.
--   If other tables (tasks, projects, etc.) already reference the placeholder UUID,
--   the update to `public.users.id` fails due to foreign key violations.
--
-- Solution:
--   1. Change all user-related foreign keys to point to `public.users(id)` instead of `auth.users(id)`.
--      The `public.users` table is our source of truth for profiles (pre-login and post-login).
--   2. Add `ON UPDATE CASCADE` to all these foreign keys.
--      This ensures that when `public.users.id` is updated during the first login,
--      all references in other tables are automatically and atomically updated as well.

BEGIN;

-- 1. Projects
ALTER TABLE IF EXISTS public.projects
  DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 2. Project Follow-Ups
ALTER TABLE IF EXISTS public.project_followups
  DROP CONSTRAINT IF EXISTS project_followups_created_by_fkey;
ALTER TABLE public.project_followups
  ADD CONSTRAINT project_followups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 3. Technology Tools
ALTER TABLE IF EXISTS public.technology_tools
  DROP CONSTRAINT IF EXISTS technology_tools_created_by_fkey;
ALTER TABLE public.technology_tools
  ADD CONSTRAINT technology_tools_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 4. Project Team Members
-- user_id
ALTER TABLE IF EXISTS public.project_team_members
  DROP CONSTRAINT IF EXISTS project_team_members_user_id_fkey;
ALTER TABLE public.project_team_members
  ADD CONSTRAINT project_team_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- created_by
ALTER TABLE IF EXISTS public.project_team_members
  DROP CONSTRAINT IF EXISTS project_team_members_created_by_fkey;
ALTER TABLE public.project_team_members
  ADD CONSTRAINT project_team_members_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 5. Project Technology Tools
ALTER TABLE IF EXISTS public.project_technology_tools
  DROP CONSTRAINT IF EXISTS project_technology_tools_created_by_fkey;
ALTER TABLE public.project_technology_tools
  ADD CONSTRAINT project_technology_tools_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 6. Project Tasks
-- created_by
ALTER TABLE IF EXISTS public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_created_by_fkey;
ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- updated_by
ALTER TABLE IF EXISTS public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_updated_by_fkey;
ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 7. Project Task Assignees
-- user_id
ALTER TABLE IF EXISTS public.project_task_assignees
  DROP CONSTRAINT IF EXISTS project_task_assignees_user_id_fkey;
ALTER TABLE public.project_task_assignees
  ADD CONSTRAINT project_task_assignees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- assigned_by
ALTER TABLE IF EXISTS public.project_task_assignees
  DROP CONSTRAINT IF EXISTS project_task_assignees_assigned_by_fkey;
ALTER TABLE public.project_task_assignees
  ADD CONSTRAINT project_task_assignees_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 8. Project Task Comments
ALTER TABLE IF EXISTS public.project_task_comments
  DROP CONSTRAINT IF EXISTS project_task_comments_created_by_fkey;
ALTER TABLE public.project_task_comments
  ADD CONSTRAINT project_task_comments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 9. Project Task Attachments
ALTER TABLE IF EXISTS public.project_task_attachments
  DROP CONSTRAINT IF EXISTS project_task_attachments_created_by_fkey;
ALTER TABLE public.project_task_attachments
  ADD CONSTRAINT project_task_attachments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 10. Project Task Activity Log
ALTER TABLE IF EXISTS public.project_task_activity_log
  DROP CONSTRAINT IF EXISTS project_task_activity_log_created_by_fkey;
ALTER TABLE public.project_task_activity_log
  ADD CONSTRAINT project_task_activity_log_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 11. Notifications
-- user_id
ALTER TABLE IF EXISTS public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- created_by
ALTER TABLE IF EXISTS public.notifications
  DROP CONSTRAINT IF EXISTS notifications_created_by_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 12. Activity Log
ALTER TABLE IF EXISTS public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 13. Project Team Member Time Events
ALTER TABLE IF EXISTS public.project_team_member_time_events
  DROP CONSTRAINT IF EXISTS project_team_member_time_events_user_id_fkey;
ALTER TABLE public.project_team_member_time_events
  ADD CONSTRAINT project_team_member_time_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 14. Project User Notes
ALTER TABLE IF EXISTS public.project_user_notes
  DROP CONSTRAINT IF EXISTS project_user_notes_user_id_fkey;
ALTER TABLE public.project_user_notes
  ADD CONSTRAINT project_user_notes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 15. Project Note Attachments
ALTER TABLE IF EXISTS public.project_note_attachments
  DROP CONSTRAINT IF EXISTS project_note_attachments_created_by_fkey;
ALTER TABLE public.project_note_attachments
  ADD CONSTRAINT project_note_attachments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 16. Project Team Talk Messages
ALTER TABLE IF EXISTS public.project_team_talk_messages
  DROP CONSTRAINT IF EXISTS project_team_talk_messages_created_by_fkey;
ALTER TABLE public.project_team_talk_messages
  ADD CONSTRAINT project_team_talk_messages_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 17. Project Team Talk Attachments
ALTER TABLE IF EXISTS public.project_team_talk_attachments
  DROP CONSTRAINT IF EXISTS project_team_talk_attachments_created_by_fkey;
ALTER TABLE public.project_team_talk_attachments
  ADD CONSTRAINT project_team_talk_attachments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 18. Project Requirements
ALTER TABLE IF EXISTS public.project_requirements
  DROP CONSTRAINT IF EXISTS project_requirements_created_by_fkey;
ALTER TABLE public.project_requirements
  ADD CONSTRAINT project_requirements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- 19. Project Requirement Milestones
ALTER TABLE IF EXISTS public.project_requirement_milestones
  DROP CONSTRAINT IF EXISTS project_requirement_milestones_created_by_fkey;
ALTER TABLE public.project_requirement_milestones
  ADD CONSTRAINT project_requirement_milestones_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;
