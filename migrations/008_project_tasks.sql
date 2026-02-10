-- Migration 008: Project Tasks and Notifications
-- Depends on: 001_auth_user_management, 005_project_management.

-- 1. Project tasks
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description_html TEXT,
  task_type TEXT,
  priority TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  in_progress_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  actual_minutes INTEGER,
  CONSTRAINT project_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'completed')),
  CONSTRAINT project_tasks_type_check CHECK (task_type IS NULL OR task_type IN ('feature', 'bug', 'improvement', 'research', 'other')),
  CONSTRAINT project_tasks_priority_check CHECK (priority IS NULL OR priority IN ('urgent', 'high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON public.project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_created_by ON public.project_tasks(created_by);

DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins can insert project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins can update project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins can delete project tasks" ON public.project_tasks;

CREATE POLICY "Users can read project tasks"
  ON public.project_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_team_members ptm
      WHERE ptm.project_id = project_tasks.project_id
        AND ptm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.projects p ON p.id = project_tasks.project_id
      JOIN public.clients c ON c.id = p.client_id
      WHERE u.id = auth.uid()
        AND u.role = 'client'
        AND c.email = u.email
        AND project_tasks.status = 'completed'
    )
  );

CREATE POLICY "Admins can insert project tasks"
  ON public.project_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update project tasks"
  ON public.project_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete project tasks"
  ON public.project_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

-- 2. Task assignees
CREATE TABLE IF NOT EXISTS public.project_task_assignees (
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_task_assignees_task_id ON public.project_task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_assignees_user_id ON public.project_task_assignees(user_id);

ALTER TABLE public.project_task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read task assignees" ON public.project_task_assignees;
DROP POLICY IF EXISTS "Admins can manage task assignees" ON public.project_task_assignees;

CREATE POLICY "Users can read task assignees"
  ON public.project_task_assignees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_assignees.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Admins can manage task assignees"
  ON public.project_task_assignees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

-- 3. Task comments
CREATE TABLE IF NOT EXISTS public.project_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  mentioned_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id ON public.project_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comments_created_at ON public.project_task_comments(created_at);

DROP TRIGGER IF EXISTS update_project_task_comments_updated_at ON public.project_task_comments;
CREATE TRIGGER update_project_task_comments_updated_at
  BEFORE UPDATE ON public.project_task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read task comments" ON public.project_task_comments;
DROP POLICY IF EXISTS "Users can insert task comments" ON public.project_task_comments;
DROP POLICY IF EXISTS "Users can update task comments" ON public.project_task_comments;
DROP POLICY IF EXISTS "Users can delete task comments" ON public.project_task_comments;

CREATE POLICY "Users can read task comments"
  ON public.project_task_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_comments.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Users can insert task comments"
  ON public.project_task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager', 'staff')
    )
  );

CREATE POLICY "Users can update task comments"
  ON public.project_task_comments
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can delete task comments"
  ON public.project_task_comments
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

-- 4. Task attachments
CREATE TABLE IF NOT EXISTS public.project_task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'raw',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_task_attachments_task_id ON public.project_task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_attachments_project_id ON public.project_task_attachments(project_id);

ALTER TABLE public.project_task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read task attachments" ON public.project_task_attachments;
DROP POLICY IF EXISTS "Admins can manage task attachments" ON public.project_task_attachments;

CREATE POLICY "Users can read task attachments"
  ON public.project_task_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_attachments.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Admins can manage task attachments"
  ON public.project_task_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'manager')
    )
  );

-- 5. Task activity log
CREATE TABLE IF NOT EXISTS public.project_task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_meta JSONB,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_task_activity_task_id ON public.project_task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_activity_created_at ON public.project_task_activity_log(created_at);

ALTER TABLE public.project_task_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read task activity" ON public.project_task_activity_log;
DROP POLICY IF EXISTS "Users can insert task activity" ON public.project_task_activity_log;

CREATE POLICY "Users can read task activity"
  ON public.project_task_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_activity_log.task_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                u.role IN ('admin', 'manager')
                OR COALESCE(u.module_permissions->>'projects', 'none') IN ('read', 'write')
              )
          )
          OR EXISTS (
            SELECT 1
            FROM public.project_team_members ptm
            WHERE ptm.project_id = t.project_id
              AND ptm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.projects p ON p.id = t.project_id
            JOIN public.clients c ON c.id = p.client_id
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND c.email = u.email
              AND t.status = 'completed'
          )
        )
    )
  );

CREATE POLICY "Users can insert task activity"
  ON public.project_task_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.project_tasks t
      WHERE t.id = project_task_activity_log.task_id
    )
  );

-- 6. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
