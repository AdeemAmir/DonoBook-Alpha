-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles - users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS policy for user_roles - admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy for user_roles - admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add verified column to profiles
ALTER TABLE public.profiles ADD COLUMN verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN shop_name TEXT;
ALTER TABLE public.profiles ADD COLUMN shop_address TEXT;
ALTER TABLE public.profiles ADD COLUMN contact_number TEXT;
ALTER TABLE public.profiles ADD COLUMN business_id TEXT;

-- Create bookstore_verifications table
CREATE TABLE public.bookstore_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shop_name TEXT NOT NULL,
  shop_address TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  business_id TEXT NOT NULL,
  proof_image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id)
);

-- Enable RLS on bookstore_verifications
ALTER TABLE public.bookstore_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification requests
CREATE POLICY "Users can view own verification"
ON public.bookstore_verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own verification requests
CREATE POLICY "Users can insert own verification"
ON public.bookstore_verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all verification requests
CREATE POLICY "Admins can view all verifications"
ON public.bookstore_verifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update verification requests
CREATE POLICY "Admins can update verifications"
ON public.bookstore_verifications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for verification proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-proofs', 'verification-proofs', false);

-- Storage policies for verification proofs
CREATE POLICY "Users can upload their verification proof"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own verification proof"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all verification proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-proofs' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Update books RLS to check verification for bookstores
DROP POLICY IF EXISTS "Users can insert own books" ON public.books;

CREATE POLICY "Users can insert own books"
ON public.books
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id 
  AND (
    (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'user'
    OR (
      (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'bookstore'
      AND (SELECT verified FROM public.profiles WHERE id = auth.uid()) = true
    )
  )
);