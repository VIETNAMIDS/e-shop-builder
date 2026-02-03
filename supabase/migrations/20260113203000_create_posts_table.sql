-- Create posts table for admin announcements / blog posts
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Public can select only published posts
CREATE POLICY "Public can select published posts"
ON public.posts
FOR SELECT
USING (is_published = true);

-- Admins (has_role admin) can manage posts
CREATE POLICY "Admins can manage posts"
ON public.posts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert with created_by = auth.uid()
CREATE POLICY "Admins can insert posts"
ON public.posts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Trigger to update updated_at
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


