-- Create user type enum
CREATE TYPE user_type AS ENUM ('user', 'bookstore');

-- Create book category enum
CREATE TYPE book_category AS ENUM ('textbook', 'reading_book');

-- Create book type enum
CREATE TYPE book_type AS ENUM ('donate', 'exchange', 'sell');

-- Create book condition enum
CREATE TYPE book_condition AS ENUM ('new', 'used');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  user_type user_type NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  grade TEXT,
  category book_category NOT NULL,
  type book_type NOT NULL,
  condition book_condition NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  description TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Books policies
CREATE POLICY "Books are viewable by everyone"
  ON public.books FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own books"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own books"
  ON public.books FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own books"
  ON public.books FOR DELETE
  USING (auth.uid() = owner_id);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for books updated_at
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for book images
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-images', 'book-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for book images
CREATE POLICY "Anyone can view book images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-images');

CREATE POLICY "Authenticated users can upload book images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'book-images' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own book images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'book-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own book images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'book-images' AND auth.role() = 'authenticated');

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;