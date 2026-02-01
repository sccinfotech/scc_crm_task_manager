-- Add RLS policies for deleting leads

-- RLS Policy: Users can delete leads they created
-- This allows users to delete their own leads
CREATE POLICY "Users can delete own leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policy: Admin users can delete all leads
-- This allows admin users to delete any lead regardless of creator
CREATE POLICY "Admins can delete all leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

