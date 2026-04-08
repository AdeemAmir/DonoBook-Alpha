import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface TypingStatus {
  userId: string;
  isTyping: boolean;
  timestamp: number;
}

export const useTypingIndicator = (
  conversationId: string | null,
  currentUserId: string | null
) => {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const typingChannel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: currentUserId } },
    });

    typingChannel
      .on("presence", { event: "sync" }, () => {
        const state = typingChannel.presenceState();
        
        // Check if any other user is typing
        const otherUsersTyping = Object.keys(state).some((key) => {
          if (key === currentUserId) return false;
          const presences = state[key] as unknown as TypingStatus[];
          return presences?.some((p) => p?.isTyping) || false;
        });
        
        setOtherUserTyping(otherUsersTyping);
      })
      .subscribe();

    setChannel(typingChannel);

    return () => {
      typingChannel.unsubscribe();
    };
  }, [conversationId, currentUserId]);

  const setTyping = async (isTyping: boolean) => {
    if (!channel || !currentUserId) return;

    await channel.track({
      userId: currentUserId,
      isTyping,
      timestamp: Date.now(),
    });
  };

  return { otherUserTyping, setTyping };
};
