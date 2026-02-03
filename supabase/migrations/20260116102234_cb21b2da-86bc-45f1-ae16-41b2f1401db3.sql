-- 1) Secure sellers table (contains bank/phone PII)
DROP POLICY IF EXISTS "Anyone can view seller profiles" ON public.sellers;

CREATE POLICY "Admins can view all sellers"
ON public.sellers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers can view own seller profile"
ON public.sellers
FOR SELECT
USING (user_id = auth.uid());

-- 2) Provide a safe public view for seller display info
DROP VIEW IF EXISTS public.sellers_public;
CREATE VIEW public.sellers_public
WITH (security_invoker=on) AS
  SELECT id, display_name, avatar_url
  FROM public.sellers;

-- 3) Secure accounts table (contains credentials)
DROP POLICY IF EXISTS "Public can view basic account info" ON public.accounts;

CREATE POLICY "Admins can view all accounts"
ON public.accounts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Sellers can view their own listings (including username/password) - consider moving secrets out later
CREATE POLICY "Sellers can view own accounts"
ON public.accounts
FOR SELECT
USING (
  seller_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = accounts.seller_id
      AND s.user_id = auth.uid()
  )
);

-- Buyers can view only purchased accounts
CREATE POLICY "Buyers can view purchased accounts"
ON public.accounts
FOR SELECT
USING (sold_to = auth.uid() AND is_sold = true);

-- 4) Provide a safe public view for marketplace listing (no password/email/phone)
DROP VIEW IF EXISTS public.accounts_public;
CREATE VIEW public.accounts_public
WITH (security_invoker=on) AS
  SELECT
    id,
    title,
    description,
    account_username,
    price,
    category,
    image_url,
    is_sold,
    is_free,
    created_at,
    seller_id
  FROM public.accounts;

-- 5) Lock down otp_codes explicitly (defense-in-depth)
-- RLS is enabled; add explicit deny policies for all commands.
DROP POLICY IF EXISTS "Deny all access to otp_codes" ON public.otp_codes;
CREATE POLICY "Deny all access to otp_codes"
ON public.otp_codes
FOR ALL
USING (false)
WITH CHECK (false);
