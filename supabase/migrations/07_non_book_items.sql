-- Create enum for item categories
CREATE TYPE public.item_category AS ENUM ('bag', 'water_bottle', 'pencil_box', 'lunchbox', 'stationery', 'other');

-- Create enum for item transaction type (no sell option)
CREATE TYPE public.item_type AS ENUM ('donate', 'exchange');

-- Create items table for non-book items
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category item_category NOT NULL,
  type item_type NOT NULL,
  condition book_condition NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for items table
CREATE POLICY "Items are viewable by everyone"
ON public.items
FOR SELECT
USING (true);

CREATE POLICY "Users can insert own items"
ON public.items
FOR INSERT
WITH CHECK (
  auth.uid() = owner_id AND
  (
    (SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = 'user'::user_type
    OR
    (
      (SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = 'bookstore'::user_type
      AND (SELECT profiles.verified FROM profiles WHERE profiles.id = auth.uid()) = true
    )
  )
);

CREATE POLICY "Users can update own items"
ON public.items
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own items"
ON public.items
FOR DELETE
USING (auth.uid() = owner_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public) VALUES ('item-images', 'item-images', true);

-- Storage policies for item images
CREATE POLICY "Item images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'item-images');

CREATE POLICY "Users can upload item images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'item-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their item images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'item-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their item images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'item-images' AND auth.uid()::text = (storage.foldername(name))[1]);