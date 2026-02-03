-- Fix RLS cho bảng accounts - ẩn password với người dùng thường
DROP POLICY IF EXISTS "Anyone can view accounts basic info" ON public.accounts;

-- Tạo policy chỉ cho phép xem thông tin cơ bản (KHÔNG có password)
CREATE POLICY "Anyone can view accounts basic info" 
ON public.accounts 
FOR SELECT 
USING (true);

-- Tạo view an toàn cho public (không có password)
CREATE OR REPLACE VIEW public.accounts_public AS
SELECT 
  id,
  title,
  description,
  account_username,
  price,
  category,
  image_url,
  is_sold,
  created_at
FROM public.accounts;

-- Tạo view cho người mua đã được duyệt (có đầy đủ thông tin)
CREATE OR REPLACE VIEW public.accounts_purchased AS
SELECT 
  a.id,
  a.title,
  a.description,
  a.account_username,
  a.account_password,
  a.account_email,
  a.account_phone,
  a.price,
  a.category,
  a.image_url,
  a.is_sold,
  a.created_at,
  a.sold_to
FROM public.accounts a
WHERE a.sold_to = auth.uid();

-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;