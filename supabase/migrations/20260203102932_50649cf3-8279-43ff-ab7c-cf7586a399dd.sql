-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT DEFAULT 'code',
  download_url TEXT,
  demo_url TEXT,
  features TEXT[],
  tech_stack TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for products (public read)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" 
ON public.products FOR SELECT 
USING (is_active = true);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" 
ON public.orders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" 
ON public.orders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create cart_items table
CREATE TABLE public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS for cart
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cart" 
ON public.cart_items FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert sample products
INSERT INTO public.products (title, description, price, category, features, tech_stack, image_url) VALUES
('E-Commerce Template', 'Template web bán hàng hoàn chỉnh với giỏ hàng, thanh toán, quản lý đơn hàng', 299000, 'template', ARRAY['Responsive Design', 'Cart System', 'Payment Integration', 'Admin Dashboard'], ARRAY['React', 'TypeScript', 'Tailwind CSS', 'Supabase'], 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800'),
('Landing Page Kit', 'Bộ template landing page đẹp mắt, tối ưu conversion', 199000, 'template', ARRAY['10+ Sections', 'Animations', 'SEO Optimized', 'Mobile First'], ARRAY['React', 'Framer Motion', 'Tailwind CSS'], 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'),
('Dashboard Admin', 'Template admin dashboard với charts, tables, forms', 399000, 'template', ARRAY['Charts & Analytics', 'Data Tables', 'User Management', 'Dark Mode'], ARRAY['React', 'TypeScript', 'Recharts', 'Shadcn UI'], 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800'),
('Blog Platform', 'Nền tảng blog hoàn chỉnh với CMS, SEO, comments', 249000, 'template', ARRAY['Markdown Editor', 'SEO Tools', 'Comments System', 'Categories'], ARRAY['React', 'MDX', 'Tailwind CSS', 'Supabase'], 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800'),
('SaaS Starter Kit', 'Boilerplate SaaS với auth, billing, multi-tenant', 599000, 'boilerplate', ARRAY['Authentication', 'Stripe Billing', 'Multi-tenant', 'API Ready'], ARRAY['React', 'TypeScript', 'Stripe', 'Supabase'], 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800'),
('Mobile App UI Kit', 'Bộ component UI cho ứng dụng mobile', 349000, 'ui-kit', ARRAY['50+ Components', 'Dark/Light Mode', 'Customizable', 'Documentation'], ARRAY['React Native', 'TypeScript', 'Expo'], 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800');