-- Allow sellers to insert their own products
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins and sellers can insert products" 
ON public.products 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    seller_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.sellers 
      WHERE id = seller_id 
      AND user_id = auth.uid()
    )
  )
);

-- Allow sellers to update their own products
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins and sellers can update own products" 
ON public.products 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    seller_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.sellers 
      WHERE id = seller_id 
      AND user_id = auth.uid()
    )
  )
);

-- Allow sellers to delete their own products  
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins and sellers can delete own products" 
ON public.products 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    seller_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.sellers 
      WHERE id = seller_id 
      AND user_id = auth.uid()
    )
  )
);

-- Allow sellers to insert their own accounts
DROP POLICY IF EXISTS "Admins can insert accounts" ON public.accounts;
CREATE POLICY "Admins and sellers can insert accounts" 
ON public.accounts 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    seller_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.sellers 
      WHERE id = seller_id 
      AND user_id = auth.uid()
    )
  )
);

-- Allow sellers to update their own accounts
DROP POLICY IF EXISTS "Admins can update accounts" ON public.accounts;
CREATE POLICY "Admins and sellers can update own accounts" 
ON public.accounts 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    seller_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.sellers 
      WHERE id = seller_id 
      AND user_id = auth.uid()
    )
  )
);

-- Allow sellers to delete their own accounts
DROP POLICY IF EXISTS "Admins can delete accounts" ON public.accounts;
CREATE POLICY "Admins and sellers can delete own accounts" 
ON public.accounts 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    seller_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.sellers 
      WHERE id = seller_id 
      AND user_id = auth.uid()
    )
  )
);