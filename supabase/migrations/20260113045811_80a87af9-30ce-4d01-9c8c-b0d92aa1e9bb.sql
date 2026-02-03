-- Add bank_qr_url column to sellers table
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS bank_qr_url text;

-- Create user_coins table to track user coin balances
CREATE TABLE public.user_coins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_coins
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

-- Users can view their own coins
CREATE POLICY "Users can view their own coins"
ON public.user_coins
FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own coins (for internal use)
CREATE POLICY "Users can update their own coins"
ON public.user_coins
FOR UPDATE
USING (user_id = auth.uid());

-- Users can insert their own coins record
CREATE POLICY "Users can insert their own coins"
ON public.user_coins
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins can manage all coins
CREATE POLICY "Admins can manage all coins"
ON public.user_coins
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create coin_purchases table for purchase requests
CREATE TABLE public.coin_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 10 AND amount <= 3000),
  receipt_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on coin_purchases
ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own purchases"
ON public.coin_purchases
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own purchases
CREATE POLICY "Users can create their own purchases"
ON public.coin_purchases
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.coin_purchases
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update purchases
CREATE POLICY "Admins can update purchases"
ON public.coin_purchases
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for bank QR codes
INSERT INTO storage.buckets (id, name, public) VALUES ('bank-qr', 'bank-qr', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bank-qr bucket
CREATE POLICY "Anyone can view bank QR"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bank-qr');

CREATE POLICY "Sellers can upload their own QR"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'bank-qr' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sellers can update their own QR"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'bank-qr' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sellers can delete their own QR"
ON storage.objects
FOR DELETE
USING (bucket_id = 'bank-qr' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for receipts bucket
CREATE POLICY "Users can view their own receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can upload their own receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at on user_coins
CREATE TRIGGER update_user_coins_updated_at
BEFORE UPDATE ON public.user_coins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on coin_purchases
CREATE TRIGGER update_coin_purchases_updated_at
BEFORE UPDATE ON public.coin_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();