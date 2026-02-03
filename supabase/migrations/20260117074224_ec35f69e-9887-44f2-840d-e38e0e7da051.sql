-- Create seller_coins table to track seller earnings
CREATE TABLE public.seller_coins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id)
);

-- Enable RLS on seller_coins
ALTER TABLE public.seller_coins ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own coins
CREATE POLICY "Sellers can view their own coins"
ON public.seller_coins
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sellers s 
  WHERE s.id = seller_coins.seller_id AND s.user_id = auth.uid()
));

-- Admins can manage all seller coins
CREATE POLICY "Admins can manage all seller coins"
ON public.seller_coins
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  bank_account_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_qr_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own withdrawal requests
CREATE POLICY "Sellers can view their own withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sellers s 
  WHERE s.id = withdrawal_requests.seller_id AND s.user_id = auth.uid()
));

-- Sellers can create their own withdrawal requests
CREATE POLICY "Sellers can create their own withdrawal requests"
ON public.withdrawal_requests
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sellers s 
  WHERE s.id = withdrawal_requests.seller_id AND s.user_id = auth.uid()
));

-- Admins can view all withdrawal requests
CREATE POLICY "Admins can view all withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update withdrawal requests
CREATE POLICY "Admins can update withdrawal requests"
ON public.withdrawal_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_seller_coins_updated_at
  BEFORE UPDATE ON public.seller_coins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();