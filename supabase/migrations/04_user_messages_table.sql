-- Create user_messages table for peer-to-peer chat
CREATE TABLE public.user_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages where they are sender or receiver
CREATE POLICY "Users can view their own messages"
ON public.user_messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: Users can insert messages where they are the sender
CREATE POLICY "Users can insert messages as sender"
ON public.user_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_messages;