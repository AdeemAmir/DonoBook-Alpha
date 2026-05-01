import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Edit2, Trash2, X, Check, PlusCircle, Package, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import SafetyBanner from "@/components/SafetyBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Message = Database['public']['Tables']['user_messages']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const otherUserId = searchParams.get("userId");

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [userItems, setUserItems] = useState<any[]>([]);
  const [offerTab, setOfferTab] = useState<'books' | 'items'>('books');
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Safety Banner States
  const [showSafetyBanner, setShowSafetyBanner] = useState(false);
  const [dontShowFor7Days, setDontShowFor7Days] = useState(false);

  // Stores transaction statuses keyed by transaction_id
  const [transactionStatuses, setTransactionStatuses] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    setTimeout(() => scrollToBottom(), 100);
  }, [messages, currentUserId]);

  // Handle Safety Banner Local Storage Logic
  useEffect(() => {
    const lastDismissed = localStorage.getItem('safetyBannerDismissedAt');
    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed);
      const now = new Date();
      // Calculate diff in days
      const daysSince = (now.getTime() - dismissedDate.getTime()) / (1000 * 3600 * 24);
      
      if (daysSince >= 7) {
        setShowSafetyBanner(true); // 7 days have passed, show it again
      } else {
        setShowSafetyBanner(false); // Within 7 days, keep it hidden
      }
    } else {
      setShowSafetyBanner(true); // No record found, show it by default
    }
  }, []);

  const handleDismissBanner = () => {
    if (dontShowFor7Days) {
      // User checked the box, save the current date
      localStorage.setItem('safetyBannerDismissedAt', new Date().toISOString());
    } else {
      // User didn't check the box, ensure it shows up next time
      localStorage.removeItem('safetyBannerDismissedAt');
    }
    setShowSafetyBanner(false);
  };

  useMessageNotifications({
    currentUserId,
    onNewMessage: () => {
      markMessagesAsRead();
    },
  });

  const conversationId = currentUserId && otherUserId
    ? [currentUserId, otherUserId].sort().join("-")
    : null;
  const { otherUserTyping, setTyping } = useTypingIndicator(conversationId, currentUserId);

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchAllUsers();
      fetchUserInventory();
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId && otherUserId) {
      fetchMessages();
      fetchOtherUser();
      markMessagesAsRead();
      const cleanup = subscribeToMessages();
      return cleanup;
    }
    return () => { };
  }, [currentUserId, otherUserId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    setCurrentUserId(session.user.id);
  };

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", currentUserId);
    if (error) { console.error("Error fetching users:", error); return; }
    setUsers(data || []);
  };

  const fetchOtherUser = async () => {
    if (!otherUserId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", otherUserId)
      .single();
    if (error) {
      toast({ title: "Error", description: "Could not load user profile", variant: "destructive" });
      return;
    }
    setOtherUser(data);
  };

  const fetchMessages = async () => {
    if (!currentUserId || !otherUserId) return;

    const [messagesRes, transactionsRes] = await Promise.all([
      supabase
        .from("user_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
        .order("created_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
    ]);

    if (messagesRes.error) return;

    const allTx = transactionsRes.data || [];

    const enrichedMessages = (messagesRes.data || []).map((msg) => {
      const linkedTx = allTx.find(tx => tx.message_id === msg.id);
      return {
        ...msg,
        transaction_id: linkedTx ? linkedTx.id : null
      };
    });

    setMessages(enrichedMessages);

    const statusMap = allTx.reduce((acc, tx) => ({
      ...acc, [tx.id]: tx.status
    }), {} as Record<string, string>);

    setTransactionStatuses(statusMap);
  };

  const markMessagesAsRead = async () => {
    if (!currentUserId || !otherUserId) return;
    const { error } = await supabase
      .from("user_messages")
      .update({ read: true })
      .eq("sender_id", otherUserId)
      .eq("receiver_id", currentUserId)
      .eq("read", false);
    if (error) console.error("Error marking messages as read:", error);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`user_messages-${currentUserId}-${otherUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_messages' },
        async (payload) => {
          const newMsg = payload.new as Message;

          if (
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === otherUserId) ||
            (newMsg.sender_id === otherUserId && newMsg.receiver_id === currentUserId)
          ) {

            const { data: txData } = await supabase
              .from("transactions")
              .select("id, status")
              .eq("message_id", newMsg.id)
              .maybeSingle();

            const enrichedMsg = {
              ...newMsg,
              transaction_id: txData ? txData.id : null
            };

            setMessages((prev) => {
              const exists = prev.some(m => m.id === enrichedMsg.id);
              if (exists) return prev;
              return [...prev, enrichedMsg];
            });

            if (txData) {
              setTransactionStatuses(prev => ({
                ...prev,
                [txData.id]: txData.status
              }));
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId || !otherUserId) return;

    const { error } = await supabase.from("user_messages").insert([{
      sender_id: currentUserId,
      receiver_id: otherUserId,
      text: newMessage.trim(),
    }]);

    if (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      return;
    }
    setNewMessage("");
    setTyping(false);
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    setTyping(!!value.trim());
  };

  const startEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditedText(message.text);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditedText("");
  };

  const saveEdit = async (messageId: string, originalText: string) => {
    if (!editedText.trim() || editedText === originalText) { cancelEdit(); return; }

    try {
      const { data: currentMessage, error: fetchError } = await supabase
        .from("user_messages")
        .select("edit_history")
        .eq("id", messageId)
        .single();

      if (fetchError) throw fetchError;

      const existingHistory = Array.isArray(currentMessage?.edit_history)
        ? currentMessage.edit_history : [];

      const newHistory = [...existingHistory, {
        text: originalText,
        edited_at: new Date().toISOString(),
      }];

      const { error } = await supabase
        .from("user_messages")
        .update({ text: editedText.trim(), edited_at: new Date().toISOString(), edit_history: newHistory as any })
        .eq("id", messageId);

      if (error) throw error;

      setMessages((prev) => prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, text: editedText.trim(), edited_at: new Date().toISOString(), edit_history: newHistory as any }
          : msg
      ));

      toast({ title: "Success", description: "Message updated" });
      cancelEdit();
    } catch (error) {
      console.error("Error editing message:", error);
      toast({ title: "Error", description: "Failed to edit message", variant: "destructive" });
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from("user_messages").delete().eq("id", messageId);
      if (error) throw error;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      toast({ title: "Success", description: "Message deleted" });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleToggleSelection = (id: string, type: 'book' | 'item') => {
    if (type === 'book') {
      setSelectedBooks(prev => prev.includes(id) ? prev.filter(bid => bid !== id) : [...prev, id]);
    } else {
      setSelectedItems(prev => prev.includes(id) ? prev.filter(iid => iid !== id) : [...prev, id]);
    }
  };

  const sendOffer = async () => {
    if (!currentUserId || !otherUserId) return;
    if (selectedBooks.length === 0 && selectedItems.length === 0) return;

    try {
      const bookTitles = userBooks.filter(b => selectedBooks.includes(b.id)).map(b => b.title);
      const itemNames = userItems.filter(i => selectedItems.includes(i.id)).map(i => i.name);
      const allNames = [...bookTitles, ...itemNames];
      const messageText = allNames.length > 1
        ? `I have a bundle offer: ${allNames.join(", ")}. Would you like to accept?`
        : `I would like to offer: "${allNames[0]}". Do you accept?`;

      const { data: newMsg, error: msgError } = await supabase
        .from("user_messages")
        .insert({
          sender_id: currentUserId,
          receiver_id: otherUserId,
          text: messageText
        })
        .select()
        .single();

      if (msgError) throw msgError;

      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          sender_id: currentUserId,
          receiver_id: otherUserId,
          status: "pending",
          message_id: newMsg.id 
        })
        .select()
        .single();

      if (txError) throw txError;

      if (selectedBooks.length > 0) {
        const { error } = await supabase
          .from("transaction_books")
          .insert(selectedBooks.map(book_id => ({ transaction_id: transaction.id, book_id })));
        if (error) throw error;
      }

      if (selectedItems.length > 0) {
        const { error } = await supabase
          .from("transaction_items")
          .insert(selectedItems.map(item_id => ({ transaction_id: transaction.id, item_id })));
        if (error) throw error;
      }

      if (selectedBooks.length > 0) {
        await supabase.from("books")
          .update({ status: "pending", is_available: false })
          .in("id", selectedBooks);
      }
      if (selectedItems.length > 0) {
        await supabase.from("items")
          .update({ status: "pending", is_available: false })
          .in("id", selectedItems);
      }

      setMessages((prev) => {
        if (prev.some(m => m.id === newMsg.id)) {
          return prev.map(m => m.id === newMsg.id
            ? { ...m, transaction_id: transaction.id }
            : m
          );
        }
        return [...prev, { ...newMsg, transaction_id: transaction.id }];
      });
      setTransactionStatuses(prev => ({ ...prev, [transaction.id]: "pending" }));

      toast({ title: "Offer Sent!", description: `Offered ${allNames.length} item(s).` });
      setIsOfferModalOpen(false);
      setSelectedBooks([]);
      setSelectedItems([]);
      fetchUserInventory();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to send offer", variant: "destructive" });
    }
  };

  const handleTransaction = async (message: any, accept: boolean) => {
    try {
      if (!message.transaction_id) return;

      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: accept ? "accepted" : "declined", resolved_at: new Date().toISOString() })
        .eq("id", message.transaction_id);

      if (txError) throw txError;

      const { data: txBooks } = await supabase
        .from("transaction_books")
        .select("book_id")
        .eq("transaction_id", message.transaction_id);

      const { data: txItems } = await supabase
        .from("transaction_items")
        .select("item_id")
        .eq("transaction_id", message.transaction_id);

      const bookIds = (txBooks || []).map(r => r.book_id);
      const itemIds = (txItems || []).map(r => r.item_id);

      if (bookIds.length > 0) {
        const { error } = await supabase.from("books").update({
          status: accept ? "claimed" : "available",
          is_available: !accept,
        }).in("id", bookIds);
      }

      if (itemIds.length > 0) {
        await supabase.from("items").update({
          status: accept ? "claimed" : "available",
          is_available: !accept,
        }).in("id", itemIds);
      }

      setTransactionStatuses(prev => ({
        ...prev,
        [message.transaction_id]: accept ? "accepted" : "declined"
      }));

      toast({
        title: accept ? "Offer Accepted" : "Offer Declined",
        description: accept ? "Items marked as claimed." : "Items are available again.",
      });

      fetchUserInventory();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to process transaction", variant: "destructive" });
    }
  };

  const fetchUserInventory = async () => {
    if (!currentUserId) return;

    const { data: books } = await supabase
      .from("books")
      .select("id, title")
      .eq("owner_id", currentUserId)
      .eq("is_available", true);

    const { data: items } = await supabase
      .from("items")
      .select("id, name")
      .eq("owner_id", currentUserId)
      .eq("is_available", true);

    setUserBooks(books || []);
    setUserItems(items || []);
  };

  if (!otherUserId) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card className="shadow-sm border-border max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="font-heading">Messages</CardTitle>
              <p className="text-muted-foreground text-sm">Select a user to start chatting</p>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {users.length > 0 ? (
                users.map((user) => (
                  <Button 
                    key={user.id} 
                    variant="ghost"
                    onClick={() => navigate(`/messages?userId=${user.id}`)} 
                    className="w-full justify-start h-14 border border-transparent hover:border-border hover:bg-muted/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3 shrink-0">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    {user.name || "Unnamed User"}
                  </Button>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No users available to chat with.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-muted/20">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <Card className="shadow-md border-border max-w-4xl mx-auto overflow-hidden flex flex-col h-[75vh]">
          {/* Chat Header */}
          <CardHeader className="border-b bg-background px-6 py-4 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {otherUser?.name ? otherUser.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <CardTitle className="font-heading text-lg">{otherUser?.name || "User"}</CardTitle>
                {otherUserTyping && <p className="text-xs text-primary animate-pulse">Typing...</p>}
              </div>
            </div>
          </CardHeader>

          {/* Chat Messages Area */}
          <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-background relative">
            <div className="p-4 sm:p-6 space-y-6">
              {messages.map((message) => {
                const isSentByUser = message.sender_id === currentUserId;
                const isEditing = editingMessageId === message.id;
                const txStatus = message.transaction_id
                  ? (transactionStatuses[message.transaction_id] ?? "pending")
                  : null;

                return (
                  <div key={message.id} className={`flex ${isSentByUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] sm:max-w-md group relative px-4 py-3 shadow-sm ${
                      isSentByUser 
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" 
                        : "bg-background border border-border text-foreground rounded-2xl rounded-tl-sm"
                    }`}>
                      
                      {isEditing ? (
                        <div className="space-y-3 min-w-[200px]">
                          <Input 
                            value={editedText} 
                            onChange={(e) => setEditedText(e.target.value)} 
                            className={`text-sm h-9 ${isSentByUser ? 'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50' : ''}`} 
                            autoFocus 
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className={`h-7 px-3 ${isSentByUser ? 'hover:bg-primary-foreground/20 hover:text-primary-foreground text-primary-foreground' : ''}`}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                            <Button size="sm" onClick={() => saveEdit(message.id, message.text)} className={`h-7 px-3 ${isSentByUser ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' : ''}`}><Check className="h-3 w-3 mr-1" /> Save</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[15px] leading-relaxed break-words">{message.text}</p>
                          
                          <div className={`flex items-center justify-end mt-1.5 gap-2 text-[11px] font-medium ${isSentByUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {message.edited_at && <span className="italic">(edited)</span>}
                            <span>{new Date(message.created_at || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isSentByUser && (
                              <span>{message.read ? <span className="text-blue-200">✓✓</span> : "✓"}</span>
                            )}
                          </div>

                          {/* Transaction Card inside Bubble */}
                          {!!message.transaction_id && (
                            <div className={`mt-3 p-3.5 rounded-xl border ${
                              isSentByUser 
                                ? 'bg-primary-foreground/10 border-primary-foreground/20' 
                                : 'bg-muted/50 border-border'
                            } space-y-3`}>
                              <p className="font-semibold text-sm flex items-center gap-2">
                                <Package className="h-4 w-4" /> Transaction Proposal
                              </p>

                              {txStatus === 'pending' ? (
                                !isSentByUser ? (
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 flex-1 text-white shadow-sm" onClick={() => handleTransaction(message, true)}>Accept</Button>
                                    <Button size="sm" variant="destructive" className="h-8 flex-1 shadow-sm" onClick={() => handleTransaction(message, false)}>Decline</Button>
                                  </div>
                                ) : (
                                  <p className="text-xs italic opacity-80 pt-1">Waiting for response...</p>
                                )
                              ) : (
                                <div className={`text-sm font-bold flex items-center gap-1.5 pt-1 ${
                                  txStatus === 'accepted' 
                                    ? (isSentByUser ? 'text-emerald-300' : 'text-emerald-600') 
                                    : (isSentByUser ? 'text-red-300' : 'text-red-500')
                                }`}>
                                  {txStatus === 'accepted' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                  Offer {txStatus?.toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Edit/Delete Actions overlaying the bubble on hover */}
                      {isSentByUser && !isEditing && (
                        <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1 bg-background p-1 rounded-full shadow-sm border border-border">
                          <Button size="icon" variant="ghost" onClick={() => startEditMessage(message)} className="h-7 w-7 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingMessageId(message.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-full">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          </CardContent>

          {/* Chat Input Box */}
          <div className="border-t bg-background p-4 shrink-0 shadow-[0_-4px_10px_rgb(0,0,0,0.02)] z-10">
            <form onSubmit={handleSendMessage} className="flex gap-2 items-end max-w-4xl mx-auto">
              <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                onClick={() => setIsOfferModalOpen(true)} 
                className="shrink-0 rounded-full h-12 w-12 border-border text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors"
                title="Send an offer"
              >
                <PlusCircle className="h-5 w-5" />
              </Button>
              <Input 
                type="text" 
                value={newMessage} 
                onChange={(e) => handleTyping(e.target.value)} 
                placeholder="Type a message..." 
                className="flex-1 rounded-3xl h-12 px-5 bg-muted/40 border-transparent hover:bg-muted/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary shadow-none text-[15px]" 
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!newMessage.trim()}
                className="shrink-0 rounded-full h-12 w-12 bg-primary hover:bg-primary-hover shadow-sm disabled:opacity-50 transition-all"
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </Card>

        {/* Delete confirmation (Standard alert dialog) */}
        <AlertDialog open={!!deletingMessageId} onOpenChange={() => setDeletingMessageId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete message?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone. The message will be permanently deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingMessageId && deleteMessage(deletingMessageId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Offer modal (Standard alert dialog) */}
        <AlertDialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Offer an Item or Book</AlertDialogTitle>
              <AlertDialogDescription>Select something from your collection to offer for exchange.</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex gap-4 border-b mb-4">
              <button onClick={() => setOfferTab('books')} className={`pb-2 px-2 transition-colors ${offerTab === 'books' ? 'border-b-2 border-primary font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Books ({userBooks.length})
              </button>
              <button onClick={() => setOfferTab('items')} className={`pb-2 px-2 transition-colors ${offerTab === 'items' ? 'border-b-2 border-primary font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Items ({userItems.length})
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
              {offerTab === 'books' ? (
                userBooks.map(b => (
                  <div key={b.id} onClick={() => handleToggleSelection(b.id, 'book')} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedBooks.includes(b.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-slate-50 border-border"}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedBooks.includes(b.id) ? "bg-primary border-primary text-white" : "bg-background"}`}>
                      {selectedBooks.includes(b.id) && <Check className="h-3 w-3" />}
                    </div>
                    <BookOpen className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{b.title}</span>
                  </div>
                ))
              ) : (
                userItems.map(i => (
                  <div key={i.id} onClick={() => handleToggleSelection(i.id, 'item')} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedItems.includes(i.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-slate-50 border-border"}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedItems.includes(i.id) ? "bg-primary border-primary text-white" : "bg-background"}`}>
                      {selectedItems.includes(i.id) && <Check className="h-3 w-3" />}
                    </div>
                    <Package className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{i.name}</span>
                  </div>
                ))
              )}
              {(offerTab === 'books' ? userBooks : userItems).length === 0 && (
                <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">No available {offerTab} found.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-medium text-muted-foreground">Selected: {selectedBooks.length + selectedItems.length} items</span>
            </div>
            
            <AlertDialogFooter className="mt-4 border-t pt-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button onClick={sendOffer} disabled={selectedBooks.length === 0 && selectedItems.length === 0}>Send Offer</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* 
        ================================================================
        CUSTOM CENTERED MODAL FOR SAFETY BANNER
        ================================================================
      */}
      {showSafetyBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
            
            {/* Header Area */}
            <div className="bg-primary/5 px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-heading font-bold text-lg text-foreground">Safety Notice</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                onClick={() => setShowSafetyBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content Area */}
            <div className="p-6">
              <SafetyBanner />
              
              <div className="mt-6 flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontShowFor7Days}
                    onChange={(e) => setDontShowFor7Days(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Don't show this again for 7 days
                </label>
                <Button
                  className="w-full h-11 font-medium"
                  onClick={handleDismissBanner}
                >
                  Continue to Chat
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;