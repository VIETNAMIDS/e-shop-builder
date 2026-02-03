-- Add product_id column to orders table for product purchases
ALTER TABLE public.orders ADD COLUMN product_id uuid REFERENCES public.products(id);

-- Make account_id nullable since orders can be for products too
ALTER TABLE public.orders ALTER COLUMN account_id DROP NOT NULL;