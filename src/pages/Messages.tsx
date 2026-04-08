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
import SafetyBanner from "@/components/SafetyBanner"
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

  // Stores transaction statuses keyed by transaction_id
  // e.g. { "uuid-123": "pending", "uuid-456": "accepted" }
  // We need this separately because transaction status lives in the
  // transactions table, not in user_messages anymore
  const [transactionStatuses, setTransactionStatuses] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    setTimeout(() => scrollToBottom(), 100);
  }, [messages, currentUserId]);

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

  // BUG FIX 1: You had two separate useEffects both calling fetchAllUsers()
  // when currentUserId changed — one also called fetchUserInventory().
  // Merged into one to avoid double-fetching.
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

    const { data, error } = await supabase
      .from("user_messages")
      .select("*")
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true });

    if (error) { console.error("Error fetching messages:", error); return; }
    setMessages(data || []);

    // After loading messages, find all transaction_ids so we can
    // fetch their current statuses from the transactions table.
    // We can't store status in user_messages anymore since we removed
    // the transaction_status column.
    const txIds = (data || [])
      .filter(m => m.transaction_id)
      .map(m => m.transaction_id as string);

    if (txIds.length > 0) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("id, status")
        .in("id", txIds);

      // Build a lookup map: { [transaction_id]: status }
      const statusMap = (txData || []).reduce((acc, tx) => ({
        ...acc,
        [tx.id]: tx.status
      }), {} as Record<string, string>);

      setTransactionStatuses(statusMap);
    }
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
    // Realtime subscription — fires whenever a new message is inserted.
    // We filter client-side to only add messages that belong to THIS conversation.
    const channel = supabase
      .channel(`user_messages-${currentUserId}-${otherUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === otherUserId) ||
            (newMsg.sender_id === otherUserId && newMsg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => [...prev, newMsg]);

            // BUG FIX 2: When a new offer message arrives via realtime,
            // its transaction_id exists but transactionStatuses won't have
            // it yet. We need to fetch and add it to the status map.
            if (newMsg.transaction_id) {
              supabase
                .from("transactions")
                .select("id, status")
                .eq("id", newMsg.transaction_id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setTransactionStatuses(prev => ({
                      ...prev,
                      [data.id]: data.status
                    }));
                  }
                });
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
      // Step 1: Create a transaction record first.
      // This is the "source of truth" for the offer's status.
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({ sender_id: currentUserId, receiver_id: otherUserId, status: "pending" })
        .select()
        .single();

      if (txError) throw txError;

      // Step 2: Insert selected books into junction table
      if (selectedBooks.length > 0) {
        const { error } = await supabase
          .from("transaction_books")
          .insert(selectedBooks.map(book_id => ({ transaction_id: transaction.id, book_id })));
        if (error) throw error;
      }

      // Step 3: Insert selected items into junction table
      if (selectedItems.length > 0) {
        const { error } = await supabase
          .from("transaction_items")
          .insert(selectedItems.map(item_id => ({ transaction_id: transaction.id, item_id })));
        if (error) throw error;
      }

      // Step 4: Mark all selected books/items as pending so they
      // don't show up as available for other users while offer is open
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

      // Step 5: Build a human-readable message text for the chat
      const bookTitles = userBooks.filter(b => selectedBooks.includes(b.id)).map(b => b.title);
      const itemNames = userItems.filter(i => selectedItems.includes(i.id)).map(i => i.name);
      const allNames = [...bookTitles, ...itemNames];
      const messageText = allNames.length > 1
        ? `I have a bundle offer: ${allNames.join(", ")}. Would you like to accept?`
        : `I would like to offer: "${allNames[0]}". Do you accept?`;

      // Step 6: Send the chat message linked to the transaction via transaction_id
      const { error: msgError } = await supabase
        .from("user_messages")
        .insert({ sender_id: currentUserId, receiver_id: otherUserId, text: messageText, transaction_id: transaction.id });

      if (msgError) throw msgError;

      // Step 7: Immediately update local transactionStatuses so the
      // sender sees "Waiting for response..." without needing a re-fetch
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

      // Step 1: Update the transaction status in the transactions table
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: accept ? "accepted" : "declined", resolved_at: new Date().toISOString() })
        .eq("id", message.transaction_id);

      if (txError) throw txError;

      // Step 2: Fetch the books/items linked to this transaction
      // from the junction tables (replacing the old book_ids/item_ids arrays)
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

      // Step 3: Update books — if accepted, mark as claimed with receiver.
      // If declined, make available again for others.
      if (bookIds.length > 0) {
        const { error } = await supabase.from("books").update({
          status: accept ? "claimed" : "available",
          is_available: !accept,
          receiver_id: accept ? message.receiver_id : null,
        }).in("id", bookIds);
      }

      // Step 4: Same logic for items
      if (itemIds.length > 0) {
        await supabase.from("items").update({
          status: accept ? "claimed" : "available",
          is_available: !accept,
          receiver_id: accept ? message.receiver_id : null,
        }).in("id", itemIds);
      }

      // BUG FIX 3: The old code called fetchMessages() here which re-fetches
      // everything from the server. Instead, update transactionStatuses locally
      // so the UI updates instantly without a round trip.
      setTransactionStatuses(prev => ({
        ...prev,
        [message.transaction_id]: accept ? "accepted" : "declined"
      }));

      toast({
        title: accept ? "Offer Accepted" : "Offer Declined",
        description: accept ? "Items marked as claimed." : "Items are available again.",
      });

      fetchUserInventory(); // Refresh inventory list
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

  // --- IF NO USER SELECTED, SHOW USER LIST ---
  if (!otherUserId) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card className="shadow-card max-w-2xl mx-auto">
            <CardHeader><CardTitle>Start a chat</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-2">
              {users.length > 0 ? (
                users.map((user) => (
                  <Button key={user.id} onClick={() => navigate(`/messages?userId=${user.id}`)} className="w-full text-left">
                    {user.name || "Unnamed User"}
                  </Button>
                ))
              ) : (
                <p className="text-center text-muted-foreground">No users available to chat with.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- SHOW CHAT IF USER SELECTED ---
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-card max-w-4xl mx-auto">
          <CardHeader className="border-b">
            <CardTitle className="font-heading">Chat with {otherUser?.name || "User"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-96 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isSentByUser = message.sender_id === currentUserId;
                const isEditing = editingMessageId === message.id;

                // Look up this message's transaction status from our local map.
                // Falls back to "pending" if not found (safe default).
                const txStatus = message.transaction_id
                  ? (transactionStatuses[message.transaction_id] ?? "pending")
                  : null;

                return (
                  <div key={message.id} className={`flex ${isSentByUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs group relative ${isSentByUser ? "bg-primary text-primary-foreground" : "bg-muted"} px-4 py-2 rounded-lg`}>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input value={editedText} onChange={(e) => setEditedText(e.target.value)} className="text-sm" autoFocus />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2"><X className="h-3 w-3" /></Button>
                            <Button size="sm" onClick={() => saveEdit(message.id, message.text)} className="h-6 px-2"><Check className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p>{message.text}</p>
                          {message.edited_at && <p className="text-xs opacity-60 italic mt-1">(edited)</p>}
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs opacity-70">
                              {new Date(message.created_at || "").toLocaleTimeString()}
                            </p>
                            {isSentByUser && (
                              <p className="text-xs opacity-70 ml-2">{message.read ? "✓✓" : "✓"}</p>
                            )}
                          </div>

                          {/* Only render transaction UI if this message has a linked transaction */}
                          {!!message.transaction_id && (
                            <div className="mt-3 p-3 border rounded-md bg-background/20 text-foreground space-y-3">
                              <p className="font-semibold text-sm">Transaction Proposal</p>

                              {txStatus === 'pending' ? (
                                // Only the RECEIVER sees Accept/Decline buttons
                                !isSentByUser ? (
                                  <div className="flex gap-2">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-white" onClick={() => handleTransaction(message, true)}>Accept</Button>
                                    <Button size="sm" variant="destructive" className="h-8" onClick={() => handleTransaction(message, false)}>Decline</Button>
                                  </div>
                                ) : (
                                  // Sender sees a waiting message
                                  <p className="text-xs italic opacity-70">Waiting for response...</p>
                                )
                              ) : (
                                // Once resolved, show final status to both users
                                <p className={`text-sm font-bold ${txStatus === 'accepted' ? 'text-green-500' : 'text-red-500'}`}>
                                  Offer {txStatus?.toUpperCase()}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Edit/Delete — only visible on hover for sender's own messages */}
                      {isSentByUser && !isEditing && (
                        <div className="absolute -left-20 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEditMessage(message)} className="h-8 w-8 p-0 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-200 hover:text-blue-700">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeletingMessageId(message.id)} className="h-8 w-8 p-0 text-destructive bg-red-50 hover:bg-red-200 hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />

              {otherUserTyping && (
                <div className="flex justify-start mt-2">
                  <div className="bg-muted px-4 py-2 rounded-lg">
                    <p className="text-sm text-muted-foreground italic">{otherUser?.name || "User"} is typing...</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2 items-center">
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsOfferModalOpen(true)} className="text-primary hover:bg-primary/10">
                <PlusCircle className="h-6 w-6" />
              </Button>
              <Input type="text" value={newMessage} onChange={(e) => handleTyping(e.target.value)} placeholder="Type your message..." className="flex-1" />
              <Button type="submit"><Send className="h-4 w-4" /></Button>
            </form>
          </CardContent>
        </Card>
        <div><SafetyBanner /></div>

        {/* Delete confirmation */}
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

        {/* Offer modal */}
        <AlertDialog open={isOfferModalOpen} onOpenChange={setIsOfferModalOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Offer an Item or Book</AlertDialogTitle>
              <AlertDialogDescription>Select something from your collection to offer for exchange.</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex gap-4 border-b mb-4">
              <button onClick={() => setOfferTab('books')} className={`pb-2 px-2 ${offerTab === 'books' ? 'border-b-2 border-primary font-bold' : 'opacity-50'}`}>
                Books ({userBooks.length})
              </button>
              <button onClick={() => setOfferTab('items')} className={`pb-2 px-2 ${offerTab === 'items' ? 'border-b-2 border-primary font-bold' : 'opacity-50'}`}>
                Items ({userItems.length})
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {offerTab === 'books' ? (
                userBooks.map(b => (
                  <div key={b.id} onClick={() => handleToggleSelection(b.id, 'book')} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedBooks.includes(b.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-slate-50"}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedBooks.includes(b.id) ? "bg-primary border-primary text-white" : "bg-white"}`}>
                      {selectedBooks.includes(b.id) && <Check className="h-3 w-3" />}
                    </div>
                    <BookOpen className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium flex-1">{b.title}</span>
                  </div>
                ))
              ) : (
                userItems.map(i => (
                  <div key={i.id} onClick={() => handleToggleSelection(i.id, 'item')} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedItems.includes(i.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-slate-50"}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedItems.includes(i.id) ? "bg-primary border-primary text-white" : "bg-white"}`}>
                      {selectedItems.includes(i.id) && <Check className="h-3 w-3" />}
                    </div>
                    <Package className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium flex-1">{i.name}</span>
                  </div>
                ))
              )}
              {(offerTab === 'books' ? userBooks : userItems).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No available {offerTab} found.</p>
              )}
            </div>

            <span className="text-xs">Selected: {selectedBooks.length + selectedItems.length}</span>
            <AlertDialogFooter>
              <Button size="sm" onClick={sendOffer} disabled={selectedBooks.length === 0 && selectedItems.length === 0}>Send Offer</Button>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Messages;