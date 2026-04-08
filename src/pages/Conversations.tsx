import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const Conversations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchConversations();
      subscribeToMessages();
    }
  }, [currentUserId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(session.user.id);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('conversations_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchConversations = async () => {
    if (!currentUserId) return;

    try {
      // Fetch all messages involving the current user
      const { data: messages, error: messagesError } = await supabase
        .from("user_messages")
        .select("*")
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      // Get unique user IDs
      const userIds = new Set<string>();
      messages?.forEach((msg) => {
        const otherId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        userIds.add(otherId);
      });

      // Fetch profiles for all users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", Array.from(userIds));

      if (profilesError) throw profilesError;

      // Build conversations
      const convos: Conversation[] = [];
      
      for (const profile of profiles || []) {
        const userMessages = messages?.filter(
          (msg) => msg.sender_id === profile.id || msg.receiver_id === profile.id
        ) || [];

        const lastMsg = userMessages[0];
        const unreadCount = userMessages.filter(
          (msg) => msg.receiver_id === currentUserId && !msg.read
        ).length;

        if (lastMsg) {
          convos.push({
            userId: profile.id,
            userName: profile.name,
            lastMessage: lastMsg.text,
            lastMessageTime: lastMsg.created_at || "",
            unreadCount,
          });
        }
      }

      // Sort by last message time
      convos.sort((a, b) => 
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(convos);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { permissionGranted, requestPermission } = useMessageNotifications({
    currentUserId,
    onNewMessage: fetchConversations,
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-card max-w-4xl mx-auto">
          <CardContent className="p-0">
            <div className="border-b p-6 flex items-center justify-between">
              <h1 className="text-2xl font-heading font-bold">Messages</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={requestPermission}
                className="gap-2"
              >
                {permissionGranted ? (
                  <>
                    <Bell className="h-4 w-4" />
                    Notifications On
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4" />
                    Enable Notifications
                  </>
                )}
              </Button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-muted-foreground">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                No conversations yet. Start chatting with other users!
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.userId}
                    onClick={() => navigate(`/messages?userId=${conversation.userId}`)}
                    className="p-4 hover:bg-accent cursor-pointer transition-colors flex items-center gap-4"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(conversation.userName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold truncate">
                          {conversation.userName}
                        </h3>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatTime(conversation.lastMessageTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.lastMessage}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="ml-2 bg-primary">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Conversations;
