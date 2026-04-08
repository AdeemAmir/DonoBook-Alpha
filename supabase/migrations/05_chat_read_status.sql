-- Add read column to user_messages table
ALTER TABLE public.user_messages 
ADD COLUMN read BOOLEAN DEFAULT false NOT NULL;

-- Policy: Users can update read status on messages they receive
CREATE POLICY "Users can update read status on received messages"
ON public.user_messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);