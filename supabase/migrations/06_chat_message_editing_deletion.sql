-- Add edit tracking columns to user_messages
ALTER TABLE public.user_messages
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb;

-- Update RLS policy to allow users to update their own messages
DROP POLICY IF EXISTS "Users can update their own sent messages" ON public.user_messages;
CREATE POLICY "Users can update their own sent messages"
ON public.user_messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Add RLS policy to allow users to delete their own messages
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.user_messages;
CREATE POLICY "Users can delete their own sent messages"
ON public.user_messages
FOR DELETE
USING (auth.uid() = sender_id);