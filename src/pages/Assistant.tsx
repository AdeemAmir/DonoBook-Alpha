import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// Updated to use relative paths to ensure resolution in this environment
import Navbar from "../components/Navbar"; 
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Send, Bot, Loader2, Trash2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { supabase } from "../integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

const Assistant = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to use the assistant",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      const { data: chatHistory } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (chatHistory && chatHistory.length > 0) {
        setMessages(
          chatHistory.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: msg.created_at,
          }))
        );
      } else {
        const welcomeMessage: Message = {
          role: "assistant",
          content:
            "Hi! I'm the BookShare Assistant. I can help you with:\n• How to use the app\n• Finding or requesting books\n• Donating or exchanging textbooks\n\nWhat would you like to know?",
        };

        setMessages([welcomeMessage]);

        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: welcomeMessage.content,
        });
      }

      setLoadingHistory(false);
    };

    initializeChat();
  }, [navigate, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveMessage = async (message: Message) => {
    if (!userId) return;

    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: message.role,
      content: message.content,
    });
  };

  const handleClearHistory = async () => {
    if (!userId) return;

    await supabase.from("chat_messages").delete().eq("user_id", userId);

    const welcomeMessage: Message = {
      role: "assistant",
      content:
        "Hi! I'm the BookShare Assistant. I can help you with:\n• How to use the app\n• Finding or requesting books\n• Donating or exchanging textbooks\n\nWhat would you like to know?",
      timestamp: new Date().toISOString(),
    };

    setMessages([welcomeMessage]);

    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: "assistant",
      content: welcomeMessage.content,
    });

    toast({
      title: "Success",
      description: "Chat history cleared",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !userId) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    await saveMessage(userMessage);

    try {
      // Optimization: Only send the last 10 messages to keep token usage low
      const chatContext = [...messages, userMessage].slice(-10);

      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: chatContext },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content:
          data.message ||
          "I apologize, but I couldn't process your request. Please try again.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await saveMessage(assistantMessage);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to render basic markdown-like styles (bold and bullets)
  const renderMessageContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Handle bold text **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedLine = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <div key={i} className={line.trim().startsWith('*') || line.trim().startsWith('•') ? "ml-4" : ""}>
          {renderedLine}
        </div>
      );
    });
  };

  if (loadingHistory) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card className="shadow-card max-w-4xl mx-auto">
            <CardContent className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading chat history...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-card max-w-4xl mx-auto border-none shadow-lg">
          <CardHeader className="border-b bg-card rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-heading text-foreground">
                    BookShare Assistant
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    AI Guide for Transactions & Safety
                  </CardDescription>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="h-[500px] overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-foreground border border-slate-100 rounded-tl-none"
                    }`}
                  >
                    <div className="text-sm leading-relaxed">
                      {renderMessageContent(message.content)}
                    </div>
                    {message.timestamp && (
                      <p
                        className={`text-[10px] mt-2 opacity-60 ${
                          message.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t p-4 flex gap-3 bg-white rounded-b-xl">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about exchange, donation, or safety..."
                className="flex-1 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-primary"
                disabled={loading}
              />
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 rounded-full px-6"
                disabled={loading || !input.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Assistant;