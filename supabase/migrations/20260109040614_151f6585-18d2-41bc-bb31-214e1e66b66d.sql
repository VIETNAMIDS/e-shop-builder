-- Create sellers table for admin/seller profiles
CREATE TABLE public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_profile_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sellers
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- Sellers can view all seller profiles (for displaying on products)
CREATE POLICY "Anyone can view seller profiles"
ON public.sellers
FOR SELECT
USING (true);

-- Sellers can update their own profile
CREATE POLICY "Sellers can update own profile"
ON public.sellers
FOR UPDATE
USING (user_id = auth.uid());

-- Only admins can insert seller profiles (when adding new admin)
CREATE POLICY "Admins can insert seller profiles"
ON public.sellers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());

-- Add seller_id to products table
ALTER TABLE public.products ADD COLUMN seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL;

-- Add seller_id to accounts table  
ALTER TABLE public.accounts ADD COLUMN seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL;

-- Create trigger to auto-create seller profile when user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.sellers (user_id, display_name, is_profile_complete)
    VALUES (NEW.user_id, 'Seller', false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on user_roles table
CREATE TRIGGER on_admin_role_added
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_admin();

-- Trigger to update updated_at on sellers
CREATE TRIGGER update_sellers_updated_at
BEFORE UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();