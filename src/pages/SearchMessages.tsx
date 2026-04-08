import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Message = Database["public"]["Tables"]["user_messages"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface MessageWithProfiles extends Message {
  senderProfile?: Profile;
  receiverProfile?: Profile;
}

const SearchMessages = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageWithProfiles[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(session.user.id);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-primary/30 rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentUserId) return;

    setIsSearching(true);

    try {
      // Search messages where user is sender or receiver
      const { data: messages, error } = await supabase
        .from("user_messages")
        .select("*")
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .ilike("text", `%${searchQuery}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profiles for all messages
      const userIds = new Set<string>();
      messages?.forEach((msg) => {
        userIds.add(msg.sender_id);
        userIds.add(msg.receiver_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", Array.from(userIds));

      // Combine messages with profiles
      const messagesWithProfiles: MessageWithProfiles[] =
        messages?.map((msg) => ({
          ...msg,
          senderProfile: profiles?.find((p) => p.id === msg.sender_id),
          receiverProfile: profiles?.find((p) => p.id === msg.receiver_id),
        })) || [];

      setSearchResults(messagesWithProfiles);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const navigateToConversation = (message: MessageWithProfiles) => {
    const otherUserId =
      message.sender_id === currentUserId
        ? message.receiver_id
        : message.sender_id;
    navigate(`/messages?userId=${otherUserId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-card max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="font-heading">Search Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for messages..."
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </form>

            <div className="space-y-4">
              {searchResults.length > 0 ? (
                searchResults.map((message) => {
                  const otherUser =
                    message.sender_id === currentUserId
                      ? message.receiverProfile
                      : message.senderProfile;
                  const isSent = message.sender_id === currentUserId;

                  return (
                    <Card
                      key={message.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigateToConversation(message)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {isSent ? "To" : "From"}:{" "}
                              {otherUser?.name || "Unknown User"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.created_at || "").toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">
                          {highlightText(message.text, searchQuery)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })
              ) : searchQuery && !isSearching ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages found matching "{searchQuery}"
                </p>
              ) : !searchQuery ? (
                <p className="text-center text-muted-foreground py-8">
                  Enter a search term to find messages
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SearchMessages;
