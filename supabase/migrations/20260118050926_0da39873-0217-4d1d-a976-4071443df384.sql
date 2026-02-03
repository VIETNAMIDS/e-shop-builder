-- Create posts table for admin blog/news functionality
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Policies for posts
CREATE POLICY "Anyone can view published posts"
ON public.posts
FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can view all posts"
ON public.posts
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert posts"
ON public.posts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update posts"
ON public.posts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete posts"
ON public.posts
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove sensitive credentials from accounts table (move to account_credentials only)
-- First, let's add a security definer function to safely check credentials
CREATE OR REPLACE FUNCTION public.get_account_credentials_for_buyer(p_account_id UUID)
RETURNS TABLE (
  account_email TEXT,
  account_password TEXT,
  account_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user has purchased this account
  IF EXISTS (
    SELECT 1 FROM accounts 
    WHERE id = p_account_id 
    AND sold_to = auth.uid() 
    AND is_sold = true
  ) THEN
    RETURN QUERY 
    SELECT ac.account_email, ac.account_password, ac.account_phone 
    FROM account_credentials ac 
    WHERE ac.account_id = p_account_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to view credentials';
  END IF;
END;
$$;