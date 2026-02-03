-- Drop the problematic views
DROP VIEW IF EXISTS public.accounts_public;
DROP VIEW IF EXISTS public.accounts_purchased;

-- Cập nhật RLS policy cho accounts - chỉ admin mới thấy password
DROP POLICY IF EXISTS "Anyone can view accounts basic info" ON public.accounts;

-- Policy cho người dùng thường - KHÔNG thấy password (dùng column-level security)
-- Tạo policy đơn giản cho SELECT
CREATE POLICY "Public can view basic account info" 
ON public.accounts 
FOR SELECT 
USING (true);

-- Tạo bảng account_credentials riêng để lưu thông tin nhạy cảm
CREATE TABLE IF NOT EXISTS public.account_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_password text NOT NULL,
  account_email text,
  account_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

-- Enable RLS
ALTER TABLE public.account_credentials ENABLE ROW LEVEL SECURITY;

-- Chỉ admin mới xem được credentials
CREATE POLICY "Only admins can view credentials"
ON public.account_credentials
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Chỉ admin mới insert/update/delete
CREATE POLICY "Only admins can insert credentials"
ON public.account_credentials
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update credentials"
ON public.account_credentials
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete credentials"
ON public.account_credentials
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Người mua đã được duyệt có thể xem credentials của tài khoản họ đã mua
CREATE POLICY "Buyers can view their purchased account credentials"
ON public.account_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_credentials.account_id
    AND a.sold_to = auth.uid()
    AND a.is_sold = true
  )
);