import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, BookOpen, Package, RefreshCw, Gift, MessageSquare, Settings, User, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EditItemDialog from "@/components/EditItemDialog";
import type { Database } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewModal } from "@/components/ReviewModal";
import ComplaintsTab from "@/components/ComplaintsTab";
import EditProfile from "@/components/EditProfile";
import { requestNotificationPermission, setupForegroundMessageListener } from "@/utils/notificationSetup";

type Book = Database['public']['Tables']['books']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") || "books";
  });
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [notiStatus, setNotiStatus] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Book | Item | null>(null);
  const [editType, setEditType] = useState<'book' | 'item'>('book');

  // History state
  const [givenAway, setGivenAway] = useState<any[]>([]);
  const [receivedItems, setReceivedItems] = useState<any[]>([]);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedItemForReview, setSelectedItemForReview] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchUserProfile();
    fetchUserListings();
  }, []);

  useEffect(() => {
    if (!userProfile?.id) return; // Wait until the profile and user ID are loaded

    const handleNotificationsInit = async () => {
      // 1. Listen for foreground alerts while app is open
      setupForegroundMessageListener();

      // 2. Grab the fresh token silently and update Supabase if it changed
      const freshToken = await requestNotificationPermission(userProfile.id);
      if (freshToken) {
        console.log("FCM Token synchronized on boot.");
        await supabase
          .from('profiles')
          .update({ fcm_token: freshToken })
          .eq('id', userProfile.id);
      }
    };

    handleNotificationsInit();
  }, [userProfile?.id]); // Fires automatically as soon as userProfile is resolved

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select(`*, admins (role), welfare_verifications (status)`)
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const profileWithRole = {
        ...data,
        role: Array.isArray(data.admins)
          ? data.admins[0]?.role
          : data.admins?.role || 'user',
      };

      setUserProfile(profileWithRole);

      if (data.user_type === "welfare") {
        const vData = data.welfare_verifications;
        const status = Array.isArray(vData) ? vData[0]?.status : vData?.status;
        setVerificationStatus(status || null);
      }
    } catch (error: any) {
      console.error("Error loading profile:", error.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const getImageUrl = (urlData: any) => {
    if (!urlData) return "/placeholder.svg";
    if (Array.isArray(urlData)) return urlData[0];
    if (typeof urlData === 'string' && urlData.startsWith('[')) {
      try { return JSON.parse(urlData)[0]; } catch { return urlData; }
    }
    return urlData;
  };

  const fetchUserListings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        booksRes,
        itemsRes,
        givenBooksRes,
        givenItemsRes,
        receivedBooksAsSender,
        receivedBooksAsReceiver,
        receivedItemsAsSender,
        receivedItemsAsReceiver,
      ] = await Promise.all([
        // 1. My active listings (exclude claimed)
        supabase.from("books").select("*").eq("owner_id", user.id).neq("status", "claimed"),
        supabase.from("items").select("*").eq("owner_id", user.id).neq("status", "claimed"),

        // 2. Given away (I own, status = claimed)
        supabase.from("books")
          .select(`*, transaction_books!inner(transactions!inner(status, sender_id, receiver_id, sender:profiles!sender_id(name), receiver:profiles!receiver_id(name)))`)
          .eq("owner_id", user.id)
          .eq("status", "claimed"),

        supabase.from("items")
          .select(`*, transaction_items!inner(transactions!inner(status, sender_id, receiver_id, sender:profiles!sender_id(name), receiver:profiles!receiver_id(name)))`)
          .eq("owner_id", user.id)
          .eq("status", "claimed"),

        // ─── Received items (4 queries, 2 per type) ─────────────────────────────
        // RLS on transactions may only expose rows where the user is receiver_id.
        // To guarantee User A (sender) also sees items they're receiving in an
        // exchange, we run two separate queries per type — one as sender, one as
        // receiver — and merge them. The owner_id !== user.id filter then keeps
        // only items that truly came TO the user.
        supabase.from("transactions")
          .select(`
            id, status, sender_id, receiver_id,
            transaction_books(books(*, owner:profiles!books_owner_id_fkey(name), reviews(id)))
          `)
          .eq("sender_id", user.id)
          .in("status", ["accepted", "successful"]),

        supabase.from("transactions")
          .select(`
            id, status, sender_id, receiver_id,
            transaction_books(books(*, owner:profiles!books_owner_id_fkey(name), reviews(id)))
          `)
          .eq("receiver_id", user.id)
          .in("status", ["accepted", "successful"]),

        supabase.from("transactions")
          .select(`
            id, status, sender_id, receiver_id,
            transaction_items(items(*, owner:profiles!items_owner_id_fkey(name), reviews(id)))
          `)
          .eq("sender_id", user.id)
          .in("status", ["accepted", "successful"]),

        supabase.from("transactions")
          .select(`
            id, status, sender_id, receiver_id,
            transaction_items(items(*, owner:profiles!items_owner_id_fkey(name), reviews(id)))
          `)
          .eq("receiver_id", user.id)
          .in("status", ["accepted", "successful"]),
      ]);

      if (booksRes.error) throw booksRes.error;
      if (itemsRes.error) throw itemsRes.error;

      // Process given-away books/items
      const processedGivenBooks = (givenBooksRes.data || []).map((book: any) => {
        const winningTx = book.transaction_books?.find(
          (tb: any) => tb.transactions?.status === 'accepted' || tb.transactions?.status === 'successful'
        );
        const tx = winningTx?.transactions;
        // The receiver is whoever is NOT the current user
        const receiverName = tx
          ? (tx.receiver_id === user.id ? tx.sender?.name : tx.receiver?.name) ?? "Unknown"
          : "Unknown";
        return { ...book, receiver: { name: receiverName } };
      });

      const processedGivenItems = (givenItemsRes.data || []).map((item: any) => {
        const winningTx = item.transaction_items?.find(
          (ti: any) => ti.transactions?.status === 'accepted' || ti.transactions?.status === 'successful'
        );
        const tx = winningTx?.transactions;
        const receiverName = tx
          ? (tx.receiver_id === user.id ? tx.sender?.name : tx.receiver?.name) ?? "Unknown"
          : "Unknown";
        return { ...item, receiver: { name: receiverName } };
      });

      // Merge sender + receiver results, deduplicate by transaction id,
      // then keep only items NOT owned by the current user.
      // Deduplication is needed because in a donate the user may appear as
      // both sender (of the item) and receiver (of the transaction record),
      // which would cause the same item to appear twice without it.
      const allBookTxs = [
        ...(receivedBooksAsSender.data || []),
        ...(receivedBooksAsReceiver.data || []),
      ].filter((tx: any, idx: number, arr: any[]) =>
        arr.findIndex((t: any) => t.id === tx.id) === idx   // deduplicate
      );

      const allItemTxs = [
        ...(receivedItemsAsSender.data || []),
        ...(receivedItemsAsReceiver.data || []),
      ].filter((tx: any, idx: number, arr: any[]) =>
        arr.findIndex((t: any) => t.id === tx.id) === idx   // deduplicate
      );

      const receivedBooks = allBookTxs.flatMap((tx: any) =>
        (tx.transaction_books || [])
          .map((tb: any) => tb.books)
          .filter((book: any) => book && book.owner_id !== user.id)
          .map((book: any) => ({
            ...book,
            _transaction_id: tx.id,
            _transaction_status: tx.status,
          }))
      ).filter(Boolean);

      const receivedItemsList = allItemTxs.flatMap((tx: any) =>
        (tx.transaction_items || [])
          .map((ti: any) => ti.items)
          .filter((item: any) => item && item.owner_id !== user.id)
          .map((item: any) => ({
            ...item,
            _transaction_id: tx.id,
            _transaction_status: tx.status,
          }))
      ).filter(Boolean);

      setBooks(booksRes.data || []);
      setItems(itemsRes.data || []);
      setGivenAway([...processedGivenBooks, ...processedGivenItems]);
      setReceivedItems([...receivedBooks, ...receivedItemsList]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (id: string, imageUrls: string | string[] | null) => {
    try {
      if (imageUrls) {
        let urlsToDelete: string[] = [];
        if (typeof imageUrls === 'string') {
          try { urlsToDelete = imageUrls.startsWith('[') ? JSON.parse(imageUrls) : [imageUrls]; }
          catch { urlsToDelete = [imageUrls]; }
        } else if (Array.isArray(imageUrls)) {
          urlsToDelete = imageUrls;
        }

        const filePaths = urlsToDelete.map(url => {
          try {
            const urlObj = new URL(url);
            const pathWithParams = urlObj.pathname.split('/book-images/')[1];
            return decodeURIComponent(pathWithParams.split('?')[0]);
          } catch { return null; }
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.auth.getSession();
          await supabase.storage.from("book-images").remove(filePaths);
        }
      }

      const { error: dbError } = await supabase.from("books").delete().eq("id", id);
      if (dbError) throw dbError;

      toast({ title: "Success", description: "Listing deleted" });
      fetchUserListings();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id: string, imageUrls: string | string[] | null) => {
    try {
      if (imageUrls) {
        let urlsToDelete: string[] = [];
        if (typeof imageUrls === 'string') {
          try { urlsToDelete = imageUrls.startsWith('[') ? JSON.parse(imageUrls) : [imageUrls]; }
          catch { urlsToDelete = [imageUrls]; }
        } else if (Array.isArray(imageUrls)) {
          urlsToDelete = imageUrls;
        }

        const filePaths = urlsToDelete.map(url => {
          try {
            const urlObj = new URL(url);
            const pathWithParams = urlObj.pathname.split('/item-images/')[1];
            return decodeURIComponent(pathWithParams.split('?')[0]);
          } catch { return null; }
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.storage.from("item-images").remove(filePaths);
        }
      }

      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Success", description: "Item deleted successfully" });
      fetchUserListings();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEdit = (item: Book | Item, type: 'book' | 'item') => {
    setEditItem(item);
    setEditType(type);
    setEditOpen(true);
  };

  /**
   * handleConfirmHandover
   *
   * The DB trigger `sync_item_statuses_with_transaction` handles ALL status
   * updates on books/items automatically. So all we need to do here is update
   * the transaction status to 'successful'. The trigger will then:
   *   - Set books/items status = 'claimed'
   *   - Set books/items handover_confirmed = true
   *   - Set books/items is_available = false
   */
  const handleConfirmHandover = async (item: any) => {
    try {
      const txId = item._transaction_id;
      if (!txId) {
        toast({ title: "Error", description: "Transaction not found for this item.", variant: "destructive" });
        return;
      }

      const { error: txUpdateError } = await supabase
        .from("transactions")
        .update({ status: "successful" })
        .eq("id", txId);

      if (txUpdateError) throw txUpdateError;

      toast({
        title: "Handover Confirmed!",
        description: "Thanks for confirming. Please leave a review for the owner!",
      });

      // Refresh list so handover_confirmed = true is reflected,
      // then open the review modal
      await fetchUserListings();

      setSelectedItemForReview(item);
      setIsReviewModalOpen(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleResubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a file smaller than 5MB.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/resubmit_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-proofs')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('verification-proofs').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("welfare_verifications")
        .update({ proof_image_url: publicUrl, status: 'pending', created_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      toast({ title: "Documents Resubmitted", description: "Your verification request has been sent back for review." });
      await fetchUserProfile();
    } catch (error: any) {
      toast({ title: "Resubmit failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      textbook: "Textbook", story_book: "Story Book", reading_book: "Reading Book",
      other_book: "Other Book", bag: "Bag", water_bottle: "Water Bottle",
      pencil_box: "Pencil Box", lunchbox: "Lunchbox", stationery: "Stationery", other: "Other",
    };
    return labels[category] || category;
  };

  const isUploadDisabled = userProfile?.user_type === "welfare" &&
    (verificationStatus === "pending" || verificationStatus === "rejected");

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading your inventory...</p>
        </div>
      </div>
    );
  }

  const handleEnableNotifications = async () => {
    try {
      setNotiStatus("Requesting...");

      // 1. Get the current logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Request permission IMMEDIATELY on click (Mobile will allow this!)
      const fcmToken = await requestNotificationPermission(user.id);

      // 3. Save it to Supabase
      if (fcmToken) {
        await supabase
          .from("profiles")
          .update({ fcm_token: fcmToken })
          .eq("id", user.id);

        setNotiStatus("✅ Notifications Enabled!");
      } else {
        setNotiStatus("❌ Permission Denied by Browser");
      }
    } catch (error: any) {
      setNotiStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">

      {/* Push Notifications */}
      <Card className="mb-8 shadow-card">
        <CardContent className="py-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell size={18} />
            </div>

            <div>
              <h3 className="font-heading font-semibold text-foreground">
                Stay Updated
              </h3>

              <p className="text-sm text-muted-foreground">
                Enable push notifications for new messages.
              </p>

              {notiStatus && (
                <p className="mt-2 text-xs font-mono text-primary break-all">
                  {notiStatus}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleEnableNotifications}
            className="shrink-0"
          >
            Enable
          </Button>
        </CardContent>
      </Card>

        {/* Welfare verification banner */}
        {userProfile?.user_type === "welfare" && verificationStatus !== "approved" && (
          <Card className="shadow-card mb-8 border-amber-500/50 bg-amber-50/50">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="text-amber-600">
                  {verificationStatus === "pending" && "⏳"}
                  {verificationStatus === "rejected" && "❌"}
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-foreground mb-1">
                    {verificationStatus === "pending" && "Verification Pending"}
                    {verificationStatus === "rejected" && "Verification Rejected"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {verificationStatus === "pending" && "Your welfare verification is under review."}
                    {verificationStatus === "rejected" && "Your verification request was rejected. Please contact support."}
                  </p>
                </div>
                {verificationStatus === "rejected" && (
                  <div className="flex flex-col items-center gap-2">
                    <Button className="relative bg-primary hover:bg-primary-hover overflow-hidden">
                      {loading ? "Uploading..." : "Upload Document"}
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        accept="image/*,.pdf"
                        onChange={handleResubmit}
                        disabled={loading}
                      />
                    </Button>
                    <p className="text-[10px] text-muted-foreground italic">PDF or Image (Max 5MB)</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-heading font-bold text-foreground">My Inventory</h1>
          <Button
            onClick={() => navigate("/upload")}
            className="bg-primary hover:bg-primary-hover gap-2"
            disabled={isUploadDisabled}
          >
            <Plus className="h-4 w-4" /> Upload Product
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="books" className="gap-2">
              <BookOpen className="h-4 w-4" /> Books ({books.length})
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <Package className="h-4 w-4" /> Items ({items.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <RefreshCw className="h-4 w-4" /> History ({givenAway.length + receivedItems.length})
            </TabsTrigger>
            {userProfile?.role !== "admin" && (
              <TabsTrigger value="support" className="gap-2">
                <MessageSquare className="h-4 w-4" /> Support
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* ── Books Tab ── */}
          <TabsContent value="books">
            {books.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No books uploaded yet.</p>
                  <Button disabled={isUploadDisabled} onClick={() => navigate("/upload")} className="bg-primary hover:bg-primary-hover">
                    Upload Your First Book
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.map((book) => (
                  <Card key={book.id} className="shadow-card hover:shadow-soft transition-smooth">
                    <CardHeader>
                      <img src={getImageUrl(book.image_url)} className={`w-full h-48 object-cover rounded-lg transition-all ${book.status !== "available" ? "grayscale opacity-60" : ""}`} />
                      <CardTitle className="font-heading">{book.title}</CardTitle>
                      <CardDescription>
                        {book.grade && `Grade: ${book.grade} • `}{getCategoryLabel(book.category)} • {book.condition}
                      </CardDescription>
                      <div className="mt-2"><StatusBadge status={book.status} /></div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/book/${(book as any).slug || book.id}`)} className="flex-1">View</Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(book, 'book')}><Edit className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteBook(book.id, book.image_url)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Items Tab ── */}
          <TabsContent value="items">
            {items.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No items uploaded yet.</p>
                  <Button disabled={isUploadDisabled} onClick={() => navigate("/upload")} className="bg-primary hover:bg-primary-hover">
                    Upload Your First Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item) => (
                  <Card key={item.id} className="shadow-card hover:shadow-soft transition-smooth">
                    <CardHeader>
                      <img src={getImageUrl(item.image_url)} className={`w-full h-48 object-cover rounded-lg transition-all ${item.status !== "available" ? "grayscale opacity-60" : ""}`} />
                      <CardTitle className="font-heading">{item.name}</CardTitle>
                      <CardDescription>{getCategoryLabel(item.category)} • {item.condition} • {item.type}</CardDescription>
                      <div className="mt-2"><StatusBadge status={item.status} /></div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/item/${(item as any).slug || item.id}`)} className="flex-1">View</Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(item, 'item')}><Edit className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id, item.image_url)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history">
            <div className="space-y-8">

              {/* Given Away */}
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" /> Given Away
                </h2>
                {givenAway.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing given away yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {givenAway.map((item) => (
                      <Card key={item.id} className="opacity-80 grayscale-[0.3]">
                        <CardHeader className="p-4">
                          <img src={getImageUrl(item.image_url)} className="h-32 w-full object-cover rounded-md mb-2" />
                          <CardTitle className="text-sm text-foreground">{item.title || item.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            {item.handover_confirmed ? (
                              <StatusBadge status="claimed" />
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-900/50">
                                Awaiting Confirmation
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 font-medium">
                            {item.handover_confirmed ? "Given to:" : "Sent to:"}{" "}
                            <span className="text-foreground">{item.receiver?.name || "Unknown"}</span>
                          </p>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {/* Received */}
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-500" /> Received
                </h2>
                {receivedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing received yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {receivedItems.map((item) => {
                      const handoverDone = item.handover_confirmed === true;
                      const alreadyReviewed = item.reviews && item.reviews.length > 0;

                      return (
                        <Card key={`${item.id}-${item._transaction_id}`} className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20 shadow-sm">
                          <CardHeader className="p-4">
                            <img src={getImageUrl(item.image_url)} className="h-32 w-full object-cover rounded-md mb-2" />
                            <CardTitle className="text-sm text-foreground">{item.title || item.name}</CardTitle>

                            <div className="flex items-center gap-2">
                              {handoverDone ? (
                                <StatusBadge status="claimed" />
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-900/50">
                                  Awaiting Confirmation
                                </span>
                              )}
                            </div>

                            <div className="mt-4 space-y-2">
                              {!handoverDone ? (
                                // Transaction is 'accepted' but not yet confirmed
                                <Button
                                  size="sm"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600"
                                  onClick={() => handleConfirmHandover(item)}
                                >
                                  Confirm I Received This
                                </Button>
                              ) : !alreadyReviewed ? (
                                // Confirmed but no review yet
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full border-primary text-primary hover:bg-primary/10 dark:hover:bg-primary/20"
                                  onClick={() => {
                                    setSelectedItemForReview(item);
                                    setIsReviewModalOpen(true);
                                  }}
                                >
                                  Leave a Review
                                </Button>
                              ) : (
                                // Review submitted
                                <div className="text-center py-2 px-3 bg-emerald-100 rounded-md text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-medium flex items-center justify-center gap-1">
                                  ✓ Review Submitted
                                </div>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                              {handoverDone ? "Received from: " : "Delivering by: "}
                              <span className="text-foreground">{item.owner?.name || "Unknown"}</span>
                            </p>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          {/* ── Support Tab ── */}
          {userProfile?.role !== "admin" && (
            <TabsContent value="support">
              <ComplaintsTab />
            </TabsContent>
          )}

          {/* ── Settings Tab ── */}
          <TabsContent value="settings">
            <div className="max-w-4xl mx-auto">
              <EditProfile profile={userProfile} onSave={fetchUserProfile} />
              <Card className="mt-6 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" /> Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>Member since: {new Date(userProfile?.created_at).toLocaleDateString()}</p>
                  <p>Account Type: <span className="capitalize font-semibold text-primary">{userProfile?.user_type}</span></p>
                  <p>User ID: <span className="font-mono">{userProfile?.id}</span></p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Review Modal */}
        {selectedItemForReview && (
          <ReviewModal
            open={isReviewModalOpen}
            onOpenChange={setIsReviewModalOpen}
            targetItem={selectedItemForReview}
            currentUserId={userProfile?.id}
            onSuccess={fetchUserListings}
          />
        )}
      </div>

      <EditItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={editItem}
        itemType={editType}
        onSaved={fetchUserListings}
      />
    </div>
  );
};

export default Dashboard;