import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Send, Edit2, Trash2, X, Check, PlusCircle,
  Package, BookOpen, Gift, ArrowLeftRight, Clock, XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import SafetyBanner from "@/components/SafetyBanner";
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

// How long (in ms) before a pending offer auto-expires
const OFFER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Which modal step we're on
type ModalStep = 'none' | 'choose-type' | 'donate' | 'exchange';

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

  // Modal/flow state
  const [modalStep, setModalStep] = useState<ModalStep>('none');

  // Inventory — split by listing_type so donate and exchange modals
  // only ever show items the owner has explicitly listed for that purpose.
  // MY inventory for donate (listing_type = 'donate')
  const [myDonateBooks, setMyDonateBooks] = useState<any[]>([]);
  const [myDonateItems, setMyDonateItems] = useState<any[]>([]);
  // MY inventory for exchange (listing_type = 'exchange')
  const [myExchangeBooks, setMyExchangeBooks] = useState<any[]>([]);
  const [myExchangeItems, setMyExchangeItems] = useState<any[]>([]);
  // OTHER user's inventory — only exchange-listed items shown in "I Want" panel
  const [otherExchangeBooks, setOtherExchangeBooks] = useState<any[]>([]);
  const [otherExchangeItems, setOtherExchangeItems] = useState<any[]>([]);

  // Keep these as aliases so sendOffer's title-lookup logic still works
  // (used nowhere else — explicit per-type lookups are done inside sendOffer)


  // Donate selections (only MY items)
  const [donateTab, setDonateTab] = useState<'books' | 'items'>('books');
  const [donateSelectedBooks, setDonateSelectedBooks] = useState<string[]>([]);
  const [donateSelectedItems, setDonateSelectedItems] = useState<string[]>([]);

  // Safety Banner States
  const [showSafetyBanner, setShowSafetyBanner] = useState(false);
  const [dontShowFor7Days, setDontShowFor7Days] = useState(false);

  // Exchange selections
  const [exchangeTab, setExchangeTab] = useState<'books' | 'items'>('books');
  const [exchangeInventoryView, setExchangeInventoryView] = useState<'mine' | 'theirs'>('mine');
  const [exchangeMyBooks, setExchangeMyBooks] = useState<string[]>([]);
  const [exchangeMyItems, setExchangeMyItems] = useState<string[]>([]);
  const [exchangeTheirBooks, setExchangeTheirBooks] = useState<string[]>([]);
  const [exchangeTheirItems, setExchangeTheirItems] = useState<string[]>([]);

  // Transaction statuses keyed by transaction_id
  const [transactionStatuses, setTransactionStatuses] = useState<Record<string, string>>({});
  // Expiry timestamps keyed by transaction_id (ms epoch)
  const [transactionExpiry, setTransactionExpiry] = useState<Record<string, number>>({});
  // Countdown timers for display keyed by transaction_id
  const [countdown, setCountdown] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  useEffect(() => { setTimeout(scrollToBottom, 100); }, [messages]);

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

  useMessageNotifications({ currentUserId, onNewMessage: markMessagesAsRead });

  const conversationId = currentUserId && otherUserId
    ? [currentUserId, otherUserId].sort().join("-") : null;
  const { otherUserTyping, setTyping } = useTypingIndicator(conversationId, currentUserId);

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (currentUserId) { fetchAllUsers(); fetchUserInventory(); }
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

  // Countdown ticker — runs every second, checks all pending transactions
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const newCountdown: Record<string, string> = {};
      const toExpire: string[] = [];

      Object.entries(transactionExpiry).forEach(([txId, expiresAt]) => {
        if (transactionStatuses[txId] !== 'pending') return;
        const remaining = expiresAt - now;
        if (remaining <= 0) {
          toExpire.push(txId);
        } else {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          newCountdown[txId] = `${m}:${s.toString().padStart(2, '0')}`;
        }
      });

      setCountdown(newCountdown);

      // Auto-expire any transactions past their deadline
      if (toExpire.length > 0) {
        toExpire.forEach(txId => autoExpireTransaction(txId));
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [transactionExpiry, transactionStatuses]);

  const autoExpireTransaction = async (txId: string) => {
    try {
      // Avoid double-processing
      if (transactionStatuses[txId] === 'expired') return;

      await supabase.from("transactions")
        .update({ status: "declined", resolved_at: new Date().toISOString() })
        .eq("id", txId);

      // Free up the items
      const { data: txBooks } = await supabase.from("transaction_books").select("book_id").eq("transaction_id", txId);
      const { data: txItems } = await supabase.from("transaction_items").select("item_id").eq("transaction_id", txId);
      const bookIds = (txBooks || []).map(r => r.book_id);
      const itemIds = (txItems || []).map(r => r.item_id);
      if (bookIds.length > 0) await supabase.from("books").update({ status: "available", is_available: true }).in("id", bookIds);
      if (itemIds.length > 0) await supabase.from("items").update({ status: "available", is_available: true }).in("id", itemIds);

      setTransactionStatuses(prev => ({ ...prev, [txId]: "expired" }));
      fetchUserInventory();
    } catch (err) {
      console.error("Auto-expire failed:", err);
    }
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    setCurrentUserId(session.user.id);
  };

  const fetchAllUsers = async () => {
    const { data, error } = await supabase.from("profiles").select("*").neq("id", currentUserId);
    if (!error) setUsers(data || []);
  };

  const fetchOtherUser = async () => {
    if (!otherUserId) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", otherUserId).single();
    if (data) setOtherUser(data);
  };

  const fetchMessages = async () => {
    if (!currentUserId || !otherUserId) return;

    const [messagesRes, transactionsRes] = await Promise.all([
      supabase.from("user_messages").select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
        .order("created_at", { ascending: true }),
      supabase.from("transactions").select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
    ]);

    if (messagesRes.error) return;
    const allTx = transactionsRes.data || [];

    const enrichedMessages = (messagesRes.data || []).map(msg => {
      const linkedTx = allTx.find(tx => tx.message_id === msg.id);
      return { ...msg, transaction_id: linkedTx ? linkedTx.id : null };
    });

    setMessages(enrichedMessages);

    const statusMap = allTx.reduce((acc, tx) => ({ ...acc, [tx.id]: tx.status }), {} as Record<string, string>);
    setTransactionStatuses(statusMap);

    // Build expiry map from created_at
    const expiryMap = allTx.reduce((acc, tx) => {
      if (tx.status === 'pending' && tx.created_at) {
        const createdAt = new Date(tx.created_at).getTime();
        acc[tx.id] = createdAt + OFFER_TIMEOUT_MS;
      }
      return acc;
    }, {} as Record<string, number>);
    setTransactionExpiry(expiryMap);
  };

  async function markMessagesAsRead() {
    if (!currentUserId || !otherUserId) return;
    await supabase.from("user_messages")
      .update({ read: true })
      .eq("sender_id", otherUserId)
      .eq("receiver_id", currentUserId)
      .eq("read", false);
  }

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
            const { data: txData } = await supabase.from("transactions").select("id, status, created_at")
              .eq("message_id", newMsg.id).maybeSingle();

            const enrichedMsg = { ...newMsg, transaction_id: txData ? txData.id : null };

            setMessages(prev => {
              if (prev.some(m => m.id === enrichedMsg.id)) return prev;
              return [...prev, enrichedMsg];
            });

            if (txData) {
              setTransactionStatuses(prev => ({ ...prev, [txData.id]: txData.status }));
              if (txData.status === 'pending' && txData.created_at) {
                const expiresAt = new Date(txData.created_at).getTime() + OFFER_TIMEOUT_MS;
                setTransactionExpiry(prev => ({ ...prev, [txData.id]: expiresAt }));
              }
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
      sender_id: currentUserId, receiver_id: otherUserId, text: newMessage.trim(),
    }]);
    if (error) toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    else { setNewMessage(""); setTyping(false); }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    setTyping(!!value.trim());
  };

  const startEditMessage = (message: Message) => { setEditingMessageId(message.id); setEditedText(message.text); };
  const cancelEdit = () => { setEditingMessageId(null); setEditedText(""); };

  const saveEdit = async (messageId: string, originalText: string) => {
    if (!editedText.trim() || editedText === originalText) { cancelEdit(); return; }
    try {
      const { data: currentMessage } = await supabase.from("user_messages").select("edit_history").eq("id", messageId).single();
      const existingHistory = Array.isArray(currentMessage?.edit_history) ? currentMessage.edit_history : [];
      const newHistory = [...existingHistory, { text: originalText, edited_at: new Date().toISOString() }];
      const { error } = await supabase.from("user_messages")
        .update({ text: editedText.trim(), edited_at: new Date().toISOString(), edit_history: newHistory as any })
        .eq("id", messageId);
      if (error) throw error;
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, text: editedText.trim(), edited_at: new Date().toISOString(), edit_history: newHistory as any } : msg
      ));
      toast({ title: "Success", description: "Message updated" });
      cancelEdit();
    } catch {
      toast({ title: "Error", description: "Failed to edit message", variant: "destructive" });
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await supabase.from("user_messages").delete().eq("id", messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast({ title: "Success", description: "Message deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete message", variant: "destructive" });
    } finally { setDeletingMessageId(null); }
  };

  const fetchUserInventory = async () => {
    if (!currentUserId || !otherUserId) return;

    const TYPE_COLUMN = "type" as const;

    const [myDB, myDI, myEB, myEI, theirEB, theirEI] = await Promise.all([
      // My donate books
      supabase.from("books").select("id, title")
        .eq("owner_id", currentUserId).eq("is_available", true)
        .eq(TYPE_COLUMN, "donate"),
      // My donate items
      supabase.from("items").select("id, name")
        .eq("owner_id", currentUserId).eq("is_available", true)
        .eq(TYPE_COLUMN, "donate"),
      // My exchange books
      supabase.from("books").select("id, title")
        .eq("owner_id", currentUserId).eq("is_available", true)
        .eq(TYPE_COLUMN, "exchange"),
      // My exchange items
      supabase.from("items").select("id, name")
        .eq("owner_id", currentUserId).eq("is_available", true)
        .eq(TYPE_COLUMN, "exchange"),
      // Their exchange books (ONLY exchange — never show their donate-only items)
      supabase.from("books").select("id, title")
        .eq("owner_id", otherUserId).eq("is_available", true)
        .eq(TYPE_COLUMN, "exchange"),
      // Their exchange items
      supabase.from("items").select("id, name")
        .eq("owner_id", otherUserId).eq("is_available", true)
        .eq(TYPE_COLUMN, "exchange"),
    ]);

    setMyDonateBooks(myDB.data || []);
    setMyDonateItems(myDI.data || []);
    setMyExchangeBooks(myEB.data || []);
    setMyExchangeItems(myEI.data || []);
    setOtherExchangeBooks(theirEB.data || []);
    setOtherExchangeItems(theirEI.data || []);
  };

  const resetModalState = () => {
    setModalStep('none');
    setDonateSelectedBooks([]);
    setDonateSelectedItems([]);
    setExchangeMyBooks([]);
    setExchangeMyItems([]);
    setExchangeTheirBooks([]);
    setExchangeTheirItems([]);
    setDonateTab('books');
    setExchangeTab('books');
    setExchangeInventoryView('mine');
  };

  // ─── SEND OFFER (shared core logic) ─────────────────────────────────────────
  const sendOffer = async (type: 'donate' | 'exchange') => {
    if (!currentUserId || !otherUserId) return;

    const offeredBookIds = type === 'donate' ? donateSelectedBooks : exchangeMyBooks;
    const offeredItemIds = type === 'donate' ? donateSelectedItems : exchangeMyItems;
    const requestedBookIds = type === 'exchange' ? exchangeTheirBooks : [];
    const requestedItemIds = type === 'exchange' ? exchangeTheirItems : [];

    if (offeredBookIds.length === 0 && offeredItemIds.length === 0 && requestedBookIds.length === 0 && requestedItemIds.length === 0) return;

    try {
      // Look up titles from the correct type-filtered list
      const myBookSource = type === 'donate' ? myDonateBooks : myExchangeBooks;
      const myItemSource = type === 'donate' ? myDonateItems : myExchangeItems;
      const myOfferedBooks = myBookSource.filter(b => offeredBookIds.includes(b.id)).map(b => b.title);
      const myOfferedItems = myItemSource.filter(i => offeredItemIds.includes(i.id)).map(i => i.name);
      // "Their" side is always exchange-only (otherExchangeBooks/Items)
      const theirRequestedBooks = otherExchangeBooks.filter(b => requestedBookIds.includes(b.id)).map(b => b.title);
      const theirRequestedItems = otherExchangeItems.filter(i => requestedItemIds.includes(i.id)).map(i => i.name);

      const offeredStr = [...myOfferedBooks, ...myOfferedItems].join(", ");
      const requestedStr = [...theirRequestedBooks, ...theirRequestedItems].join(", ");

      let messageText = "";
      if (type === 'donate') {
        messageText = `I'd like to donate: [${offeredStr}] to you. Do you accept?`;
      } else {
        if (offeredStr && requestedStr) {
          messageText = `I propose a trade: I'll give you [${offeredStr}] in exchange for your [${requestedStr}]. Do you accept?`;
        } else if (offeredStr) {
          messageText = `I'd like to offer: [${offeredStr}]. Do you accept?`;
        } else if (requestedStr) {
          messageText = `I'm requesting: [${requestedStr}]. Will you gift this to me?`;
        }
      }

      // Use a Set to ensure every ID is unique
      const allBookIds = [...new Set([...offeredBookIds, ...requestedBookIds])];
      const allItemIds = [...new Set([...offeredItemIds, ...requestedItemIds])];

      // 1. Insert the message
      const { data: newMsg, error: msgError } = await supabase.from("user_messages")
        .insert({ sender_id: currentUserId, receiver_id: otherUserId, text: messageText })
        .select().single();
      if (msgError) throw msgError;

      // 2. Create transaction with status 'initializing'
      // This prevents the trigger from firing before we link the items.
      const { data: transaction, error: txError } = await supabase.from("transactions")
        .insert({
          sender_id: currentUserId,
          receiver_id: otherUserId,
          status: "initializing",
          message_id: newMsg.id,
        })
        .select().single();
      if (txError) throw txError;

      // console.log("Linking Books:", allBookIds.map(id => ({ transaction_id: transaction.id, book_id: id })));

      // if (allBookIds.length > 0) {
      //   const { error } = await supabase.from("transaction_books")
      //     .insert(allBookIds.map(book_id => ({ transaction_id: transaction.id, book_id })));
      //   if (error) {
      //     console.error("Link Error Detail:", error); // This will tell us if it's a PK or FK issue
      //     throw error;
      //   }
      // }

      // 3. Link books + items to transaction (Junction Tables)
      if (allBookIds.length > 0) {
        const { error } = await supabase.from("transaction_books")
          .insert(allBookIds.map(book_id => ({ transaction_id: transaction.id, book_id })));
        if (error) throw error;
      }
      if (allItemIds.length > 0) {
        const { error } = await supabase.from("transaction_items")
          .insert(allItemIds.map(item_id => ({ transaction_id: transaction.id, item_id })));
        if (error) throw error;
      }

      // 4. ACTIVATE THE TRIGGER
      // By updating the status to 'pending', the SQL trigger we created 
      // will now find the linked items and update their status to 'pending' automatically.
      // This happens server-side, so no 403 error!
      const { error: finalUpdateError } = await supabase.from("transactions")
        .update({ status: "pending" })
        .eq("id", transaction.id);
      if (finalUpdateError) throw finalUpdateError;

      // 5. Update local state
      const expiresAt = Date.now() + OFFER_TIMEOUT_MS;
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) {
          return prev.map(m => m.id === newMsg.id ? { ...m, transaction_id: transaction.id } : m);
        }
        return [...prev, { ...newMsg, transaction_id: transaction.id }];
      });
      setTransactionStatuses(prev => ({ ...prev, [transaction.id]: "pending" }));
      setTransactionExpiry(prev => ({ ...prev, [transaction.id]: expiresAt }));

      toast({ title: type === 'donate' ? "Donation Offer Sent!" : "Exchange Offer Sent!", description: "Waiting for the other user to respond." });
      resetModalState();
      fetchUserInventory();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to send offer", variant: "destructive" });
    }
  };

  // ─── CANCEL OFFER (sender can cancel a pending offer) ───────────────────────
  const cancelOffer = async (message: any) => {
    if (!message.transaction_id) return;
    try {
      await supabase.from("transactions")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", message.transaction_id);

      const { data: txBooks } = await supabase.from("transaction_books").select("book_id").eq("transaction_id", message.transaction_id);
      const { data: txItems } = await supabase.from("transaction_items").select("item_id").eq("transaction_id", message.transaction_id);
      const bookIds = (txBooks || []).map(r => r.book_id);
      const itemIds = (txItems || []).map(r => r.item_id);

      if (bookIds.length > 0) await supabase.from("books").update({ status: "available", is_available: true }).in("id", bookIds);
      if (itemIds.length > 0) await supabase.from("items").update({ status: "available", is_available: true }).in("id", itemIds);

      setTransactionStatuses(prev => ({ ...prev, [message.transaction_id]: "cancelled" }));
      toast({ title: "Offer Cancelled", description: "Your offer has been withdrawn." });
      fetchUserInventory();
    } catch {
      toast({ title: "Error", description: "Failed to cancel offer", variant: "destructive" });
    }
  };

  // ─── ACCEPT / DECLINE (receiver) ────────────────────────────────────────────
  const handleTransaction = async (message: any, accept: boolean) => {
    if (!message.transaction_id) return;
    try {
      await supabase.from("transactions")
        .update({ status: accept ? "accepted" : "declined", resolved_at: new Date().toISOString() })
        .eq("id", message.transaction_id);

      // const { data: txBooks } = await supabase.from("transaction_books").select("book_id").eq("transaction_id", message.transaction_id);
      // const { data: txItems } = await supabase.from("transaction_items").select("item_id").eq("transaction_id", message.transaction_id);
      // const bookIds = (txBooks || []).map(r => r.book_id);
      // const itemIds = (txItems || []).map(r => r.item_id);

      // if (bookIds.length > 0) await supabase.from("books").update({ status: accept ? "claimed" : "available", is_available: !accept }).in("id", bookIds);
      // if (itemIds.length > 0) await supabase.from("items").update({ status: accept ? "claimed" : "available", is_available: !accept }).in("id", itemIds);

      setTransactionStatuses(prev => ({ ...prev, [message.transaction_id]: accept ? "accepted" : "declined" }));
      toast({ title: accept ? "Offer Accepted" : "Offer Declined", description: accept ? "Items marked as claimed." : "Items are available again." });
      fetchUserInventory();
    } catch {
      toast({ title: "Error", description: "Failed to process transaction", variant: "destructive" });
    }
  };

  // ─── TOGGLE HELPERS ──────────────────────────────────────────────────────────
  const toggleDonate = (id: string, type: 'book' | 'item') => {
    if (type === 'book') setDonateSelectedBooks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    else setDonateSelectedItems(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };
  const toggleExchange = (id: string, type: 'book' | 'item', side: 'mine' | 'theirs') => {
    if (side === 'mine') {
      if (type === 'book') setExchangeMyBooks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
      else setExchangeMyItems(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    } else {
      if (type === 'book') setExchangeTheirBooks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
      else setExchangeTheirItems(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      accepted: { label: "ACCEPTED", className: "text-green-600 font-bold" },
      declined: { label: "DECLINED", className: "text-red-500 font-bold" },
      cancelled: { label: "CANCELLED", className: "text-gray-500 font-bold" },
      expired: { label: "EXPIRED", className: "text-orange-500 font-bold" },
    };
    const entry = map[status];
    if (!entry) return null;
    return <p className={`text-sm mt-1 ${entry.className}`}>Offer {entry.label}</p>;
  };

  // ─── USER LIST (no conversation selected) ───────────────────────────────────
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
              {users.length > 0 ? users.map(user => (
                <Button key={user.id} onClick={() => navigate(`/messages?userId=${user.id}`)} className="w-full text-left">
                  {user.name || "Unnamed User"}
                </Button>
              )) : <p className="text-center text-muted-foreground">No users available to chat with.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── CHAT VIEW ───────────────────────────────────────────────────────────────
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
                  ? (transactionStatuses[message.transaction_id] ?? "pending") : null;
                const timeLeft = message.transaction_id ? countdown[message.transaction_id] : null;
                const isPending = txStatus === 'pending';

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

                          {/* Transaction card */}
                          {!!message.transaction_id && (
                            <div className={`mt-3 p-3.5 rounded-xl border ${
                              isSentByUser 
                                ? 'bg-primary-foreground/10 border-primary-foreground/20' 
                                : 'bg-muted/50 border-border'
                            } space-y-3`}>
                              <p className="font-semibold text-sm flex items-center gap-2">
                                <Package className="h-4 w-4" /> Transaction Proposal
                              </p>

                              {/* Countdown timer */}
                              {isPending && timeLeft && (
                                <div className="flex items-center gap-1 text-xs text-amber-600">
                                  <Clock className="h-3 w-3" />
                                  <span>Expires in {timeLeft}</span>
                                </div>
                              )}

                              {isPending ? (
                                !isSentByUser ? (
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 flex-1 text-white shadow-sm" onClick={() => handleTransaction(message, true)}>Accept</Button>
                                    <Button size="sm" variant="destructive" className="h-8 flex-1 shadow-sm" onClick={() => handleTransaction(message, false)}>Decline</Button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="text-xs italic opacity-70">Waiting for response…</p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                                      onClick={() => cancelOffer(message)}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" /> Cancel Offer
                                    </Button>
                                  </div>
                                )
                              ) : statusBadge(txStatus!)}
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

              <div ref={messagesEndRef} />

              {otherUserTyping && (
                <div className="flex justify-start mt-2">
                  <div className="bg-muted px-4 py-2 rounded-lg">
                    <p className="text-sm text-muted-foreground italic">{otherUser?.name || "User"} is typing…</p>
                  </div>
                </div>
              )}
            </div>

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2 items-center">
              <Button type="button" variant="ghost" size="icon" onClick={() => setModalStep('choose-type')} className="text-primary hover:bg-primary/10">
                <PlusCircle className="h-6 w-6" />
              </Button>
              <Input type="text" value={newMessage} onChange={e => handleTyping(e.target.value)} placeholder="Type your message…" className="flex-1" />
              <Button type="submit"><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </Card>

        {/* ── Delete confirmation ── */}
        <AlertDialog open={!!deletingMessageId} onOpenChange={() => setDeletingMessageId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete message?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingMessageId && deleteMessage(deletingMessageId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── STEP 1: Choose type ── */}
        <AlertDialog open={modalStep === 'choose-type'} onOpenChange={open => { if (!open) resetModalState(); }}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>What would you like to do?</AlertDialogTitle>
              <AlertDialogDescription>Choose whether you want to donate items or propose an exchange.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                onClick={() => setModalStep('donate')}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <Gift className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Donate</p>
                  <p className="text-xs text-muted-foreground mt-1">Give items for free</p>
                </div>
              </button>

              <button
                onClick={() => setModalStep('exchange')}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <ArrowLeftRight className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Exchange</p>
                  <p className="text-xs text-muted-foreground mt-1">Trade items mutually</p>
                </div>
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={resetModalState}>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── STEP 2a: Donate modal ── */}
        <AlertDialog open={modalStep === 'donate'} onOpenChange={open => { if (!open) resetModalState(); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-green-600" />
                <AlertDialogTitle>Donate Items</AlertDialogTitle>
              </div>
              <AlertDialogDescription>Select items from your collection to donate to {otherUser?.name || "this user"}.</AlertDialogDescription>
            </AlertDialogHeader>

            {/* Tab: Books / Items — only shows items listed as donate */}
            <div className="flex gap-4 border-b mb-3">
              <button onClick={() => setDonateTab('books')} className={`pb-2 px-2 text-sm flex items-center gap-1 ${donateTab === 'books' ? 'border-b-2 border-primary font-bold' : 'opacity-50'}`}>
                <BookOpen className="h-4 w-4" /> Books ({myDonateBooks.length})
              </button>
              <button onClick={() => setDonateTab('items')} className={`pb-2 px-2 text-sm flex items-center gap-1 ${donateTab === 'items' ? 'border-b-2 border-primary font-bold' : 'opacity-50'}`}>
                <Package className="h-4 w-4" /> Items ({myDonateItems.length})
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {donateTab === 'books'
                ? myDonateBooks.map(b => {
                  const sel = donateSelectedBooks.includes(b.id);
                  return (
                    <div key={b.id} onClick={() => toggleDonate(b.id, 'book')}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${sel ? "bg-green-50 border-green-400" : "hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${sel ? "bg-green-500 border-green-500 text-white" : "bg-white"}`}>
                        {sel && <Check className="h-3 w-3" />}
                      </div>
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium flex-1">{b.title}</span>
                    </div>
                  );
                })
                : myDonateItems.map(i => {
                  const sel = donateSelectedItems.includes(i.id);
                  return (
                    <div key={i.id} onClick={() => toggleDonate(i.id, 'item')}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${sel ? "bg-green-50 border-green-400" : "hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${sel ? "bg-green-500 border-green-500 text-white" : "bg-white"}`}>
                        {sel && <Check className="h-3 w-3" />}
                      </div>
                      <Package className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium flex-1">{i.name}</span>
                    </div>
                  );
                })}
              {(donateTab === 'books' ? myDonateBooks : myDonateItems).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  No {donateTab} listed for donation in your collection.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">
                Selected: {donateSelectedBooks.length + donateSelectedItems.length} item(s)
              </span>
              <div className="flex items-center gap-1 ml-auto text-xs text-amber-600">
                <Clock className="h-3 w-3" />
                <span>Offer expires in 15 min</span>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={resetModalState}>Cancel</AlertDialogCancel>
              <Button
                onClick={() => sendOffer('donate')}
                disabled={donateSelectedBooks.length === 0 && donateSelectedItems.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Gift className="h-4 w-4 mr-1" /> Send Donation Offer
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── STEP 2b: Exchange modal ── */}
        <AlertDialog open={modalStep === 'exchange'} onOpenChange={open => { if (!open) resetModalState(); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                <AlertDialogTitle>Propose an Exchange</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Select what you'll offer and what you'd like in return.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* My Offerings / What I Want toggle */}
            <div className="flex bg-slate-100 p-1 rounded-md mb-3">
              <button
                onClick={() => setExchangeInventoryView('mine')}
                className={`flex-1 text-sm py-1.5 rounded flex items-center justify-center gap-1 transition-all ${exchangeInventoryView === 'mine' ? 'bg-white shadow font-semibold' : ''}`}>
                <Gift className="h-3.5 w-3.5" />
                My Offer
                {(exchangeMyBooks.length + exchangeMyItems.length) > 0 && (
                  <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5">{exchangeMyBooks.length + exchangeMyItems.length}</span>
                )}
              </button>
              <button
                onClick={() => setExchangeInventoryView('theirs')}
                className={`flex-1 text-sm py-1.5 rounded flex items-center justify-center gap-1 transition-all ${exchangeInventoryView === 'theirs' ? 'bg-white shadow font-semibold' : ''}`}>
                <ArrowLeftRight className="h-3.5 w-3.5" />
                I Want
                {(exchangeTheirBooks.length + exchangeTheirItems.length) > 0 && (
                  <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5">{exchangeTheirBooks.length + exchangeTheirItems.length}</span>
                )}
              </button>
            </div>

            {/* Books / Items tab — only exchange-listed items shown on both sides */}
            <div className="flex gap-4 border-b mb-3">
              <button onClick={() => setExchangeTab('books')} className={`pb-2 px-2 text-sm flex items-center gap-1 ${exchangeTab === 'books' ? 'border-b-2 border-primary font-bold' : 'opacity-50'}`}>
                <BookOpen className="h-4 w-4" />
                Books ({exchangeInventoryView === 'mine' ? myExchangeBooks.length : otherExchangeBooks.length})
              </button>
              <button onClick={() => setExchangeTab('items')} className={`pb-2 px-2 text-sm flex items-center gap-1 ${exchangeTab === 'items' ? 'border-b-2 border-primary font-bold' : 'opacity-50'}`}>
                <Package className="h-4 w-4" />
                Items ({exchangeInventoryView === 'mine' ? myExchangeItems.length : otherExchangeItems.length})
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {exchangeTab === 'books'
                ? (exchangeInventoryView === 'mine' ? myExchangeBooks : otherExchangeBooks).map(b => {
                  const sel = exchangeInventoryView === 'mine' ? exchangeMyBooks.includes(b.id) : exchangeTheirBooks.includes(b.id);
                  return (
                    <div key={b.id} onClick={() => toggleExchange(b.id, 'book', exchangeInventoryView)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${sel ? "bg-blue-50 border-blue-400" : "hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${sel ? "bg-blue-500 border-blue-500 text-white" : "bg-white"}`}>
                        {sel && <Check className="h-3 w-3" />}
                      </div>
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium flex-1">{b.title}</span>
                    </div>
                  );
                })
                : (exchangeInventoryView === 'mine' ? myExchangeItems : otherExchangeItems).map(i => {
                  const sel = exchangeInventoryView === 'mine' ? exchangeMyItems.includes(i.id) : exchangeTheirItems.includes(i.id);
                  return (
                    <div key={i.id} onClick={() => toggleExchange(i.id, 'item', exchangeInventoryView)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${sel ? "bg-blue-50 border-blue-400" : "hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${sel ? "bg-blue-500 border-blue-500 text-white" : "bg-white"}`}>
                        {sel && <Check className="h-3 w-3" />}
                      </div>
                      <Package className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium flex-1">{i.name}</span>
                    </div>
                  );
                })}
              {((exchangeTab === 'books'
                ? (exchangeInventoryView === 'mine' ? myExchangeBooks : otherExchangeBooks)
                : (exchangeInventoryView === 'mine' ? myExchangeItems : otherExchangeItems)
              ).length === 0) && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    No {exchangeTab} listed for exchange {exchangeInventoryView === 'mine' ? 'in your collection' : `by ${otherUser?.name || 'this user'}`}.
                  </p>
                )}
            </div>

            {/* Summary row */}
            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">You offer:</span>
                <span className="font-medium">{exchangeMyBooks.length + exchangeMyItems.length} item(s)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">You want:</span>
                <span className="font-medium">{exchangeTheirBooks.length + exchangeTheirItems.length} item(s)</span>
              </div>
              <div className="flex items-center gap-1 text-amber-600 pt-1">
                <Clock className="h-3 w-3" />
                <span>Offer expires in 15 min after sending</span>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={resetModalState}>Cancel</AlertDialogCancel>
              <Button
                onClick={() => sendOffer('exchange')}
                disabled={(exchangeMyBooks.length === 0 && exchangeMyItems.length === 0) || (exchangeTheirBooks.length === 0 && exchangeTheirItems.length === 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ArrowLeftRight className="h-4 w-4 mr-1" /> Send Exchange Offer
              </Button>
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