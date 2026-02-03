-- Create accounts table for selling accounts
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  account_username TEXT NOT NULL,
  account_password TEXT NOT NULL,
  account_email TEXT,
  account_phone TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  image_url TEXT,
  is_sold BOOLEAN NOT NULL DEFAULT false,
  sold_to UUID REFERENCES auth.users(id),
  sold_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Anyone can view basic account info (not sensitive data)
CREATE POLICY "Anyone can view accounts basic info"
ON public.accounts
FOR SELECT
USING (true);

-- Only admins can insert accounts
CREATE POLICY "Admins can insert accounts"
ON public.accounts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update accounts
CREATE POLICY "Admins can update accounts"
ON public.accounts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete accounts
CREATE POLICY "Admins can delete accounts"
ON public.accounts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();