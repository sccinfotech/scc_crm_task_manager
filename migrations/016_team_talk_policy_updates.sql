-- Migration 016: Restrict Team Talk edits/deletes to message owner
-- Depends on: 014_project_team_talk, 015_project_team_talk_attachments

-- Messages: update/delete should be owner-only
DROP POLICY IF EXISTS "Users can update project team talk messages" ON public.project_team_talk_messages;
DROP POLICY IF EXISTS "Users can delete project team talk messages" ON public.project_team_talk_messages;

CREATE POLICY "Users can update project team talk messages"
  ON public.project_team_talk_messages
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete project team talk messages"
  ON public.project_team_talk_messages
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_team_talk_messages.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Attachments: update/delete should be owner-only
DROP POLICY IF EXISTS "Users can update project team talk attachments" ON public.project_team_talk_attachments;
DROP POLICY IF EXISTS "Users can delete project team talk attachments" ON public.project_team_talk_attachments;

CREATE POLICY "Users can update project team talk attachments"
  ON public.project_team_talk_attachments
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY "Users can delete project team talk attachments"
  ON public.project_team_talk_attachments
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.project_team_talk_messages m
      WHERE m.id = project_team_talk_attachments.message_id
        AND m.project_id = project_team_talk_attachments.project_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('admin', 'manager')
          OR (
            u.role = 'staff'
            AND EXISTS (
              SELECT 1
              FROM public.project_team_members ptm
              WHERE ptm.project_id = project_team_talk_attachments.project_id
                AND ptm.user_id = auth.uid()
            )
          )
        )
    )
  );
