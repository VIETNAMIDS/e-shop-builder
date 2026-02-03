-- 1. Add policy to allow anyone to view unsold accounts (for marketplace)
CREATE POLICY "Anyone can view unsold accounts for marketplace"
ON public.accounts
FOR SELECT
USING (is_sold = false);

-- 2. Add policy for admins to insert notifications for any user
CREATE POLICY "Admins can insert notifications for any user"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add policy for system to insert notifications (for triggers)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);