-- Add is_free column to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

-- Allow users to claim free accounts (update sold_to, is_sold, sold_at for free accounts)
CREATE POLICY "Users can claim free accounts" 
ON public.accounts 
FOR UPDATE 
USING (is_free = true AND is_sold = false AND auth.uid() IS NOT NULL)
WITH CHECK (is_free = true AND sold_to = auth.uid() AND is_sold = true);