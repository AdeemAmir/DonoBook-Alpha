import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, BookOpen, Package, RefreshCw, Gift, Badge, MessageSquare, Settings, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EditItemDialog from "@/components/EditItemDialog";
import type { Database } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewModal } from "@/components/ReviewModal";
import ComplaintsTab from "@/components/ComplaintsTab";
import EditProfile from "@/components/EditProfile";

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

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Book | Item | null>(null);
  const [editType, setEditType] = useState<'book' | 'item'>('book');

  // To track items/books sent by owners
  const [givenAway, setGivenAway] = useState<any[]>([]);
  const [receivedItems, setReceivedItems] = useState<any[]>([]);

  // State to control visibility
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // State to keep track of WHICH book/item is being reviewed
  const [selectedItemForReview, setSelectedItemForReview] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchUserProfile();
    fetchUserListings();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Profile, Role, and Verification in ONE go
      const { data, error } = await supabase
        .from("profiles")
        .select(`
        *,
        admins (role),
        welfare_verifications (status)
      `)
        .eq("id", user.id)
        .single();

      if (error) throw error;

      // Flatten the data for easier use in your state
      const profileWithRole = {
        ...data,
        // Check if it's an array or an object
        role: Array.isArray(data.admins)
          ? data.admins[0]?.role
          : data.admins?.role || 'user',
      };

      setUserProfile(profileWithRole);

      // If they are welfare, the status is already here!
      if (data.user_type === "welfare") {
        // Access directly if it's an object, or use [0] if it's an array
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

    // If it's already an array
    if (Array.isArray(urlData)) return urlData[0];

    // If it's a stringified array (common with JSONB columns)
    if (typeof urlData === 'string' && urlData.startsWith('[')) {
      try {
        const parsed = JSON.parse(urlData);
        return parsed[0];
      } catch (e) {
        return urlData;
      }
    }

    return urlData;
  };

  const fetchUserListings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [booksRes, itemsRes, givenBooksRes, givenItemsRes, receivedBooksRes, receivedItemsRes] = await Promise.all([
        // 1. Currently Owned & Available/Pending
        supabase.from("books").select("*").eq("owner_id", user.id).neq("status", "claimed"),
        supabase.from("items").select("*").eq("owner_id", user.id).neq("status", "claimed"),

        // 2. Given Away (Owned by me, but status is claimed)

        /* The profiles!receiver_id(name) syntax tells Supabase: "Look at the receiver_id column, 
         find that person in the profiles table, and just give me their name." */
        supabase.from("books").select(`*, receiver:profiles!books_receiver_id_fkey(name)`).eq("owner_id", user.id).eq("status", "claimed"),
        supabase.from("items").select(`*, receiver:profiles!items_receiver_id_fkey(name)`).eq("owner_id", user.id).eq("status", "claimed"),

        // 3. Received (Owned by others, but receiver_id is me)
        supabase.from("books").select(`*, owner:profiles!books_owner_id_fkey(name), reviews(id)`).eq("receiver_id", user.id),
        supabase.from("items").select(`*, owner:profiles!items_owner_id_fkey(name), reviews(id)`).eq("receiver_id", user.id)
      ]);

      if (booksRes.error) throw booksRes.error;
      if (itemsRes.error) throw itemsRes.error;
      setBooks(booksRes.data || []);
      setItems(itemsRes.data || []);

      setGivenAway([
        ...(givenBooksRes.data || []),
        ...(givenItemsRes.data || [])
      ]);

      setReceivedItems([
        ...(receivedBooksRes.data || []),
        ...(receivedItemsRes.data || [])
      ]);

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
          try {
            urlsToDelete = imageUrls.startsWith('[') ? JSON.parse(imageUrls) : [imageUrls];
          } catch (e) {
            urlsToDelete = [imageUrls];
          }
        } else if (Array.isArray(imageUrls)) {
          urlsToDelete = imageUrls;
        }

        const filePaths = urlsToDelete.map(url => {
          try {
            const urlObj = new URL(url);
            const pathWithParams = urlObj.pathname.split('/book-images/')[1];
            return decodeURIComponent(pathWithParams.split('?')[0]);
          } catch (e) {
            return null;
          }
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          // verify session before attempting delete
          const { data: { session } } = await supabase.auth.getSession();

          const { data, error: storageError } = await supabase.storage
            .from("book-images")
            .remove(filePaths);
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
          try {
            urlsToDelete = imageUrls.startsWith('[') ? JSON.parse(imageUrls) : [imageUrls];
          } catch (e) {
            urlsToDelete = [imageUrls];
          }
        } else if (Array.isArray(imageUrls)) {
          urlsToDelete = imageUrls;
        }

        const filePaths = urlsToDelete.map(url => {
          try {
            const urlObj = new URL(url);
            const pathWithParams = urlObj.pathname.split('/item-images/')[1];
            return decodeURIComponent(pathWithParams.split('?')[0]);
          } catch (e) {
            return null;
          }
        }).filter(Boolean) as string[];

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("item-images")
            .remove(filePaths);

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

  const handleConfirmHandover = async (item: any, table: 'books' | 'items') => {
    const { error } = await supabase
      .from(table)
      .update({ handover_confirmed: true, status: 'claimed', is_available: false })
      .eq('id', item.id);

    if (error) throw error;

    toast({
      title: "Handover Confirmed!",
      description: "Thanks for confirming. Please leave a review for the owner!"
    });

    // THIS TRIGGERS THE MODAL
    setSelectedItemForReview(item);
    setIsReviewModalOpen(true);

    // Refresh the list so the "Confirm" button turns into "Leave Review"
    await fetchUserListings();
  };

  // To resubmit verification request after rejection
  const handleResubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (e.g., max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/resubmit_${Date.now()}.${fileExt}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('verification-proofs')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get the new Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('verification-proofs')
        .getPublicUrl(filePath);

      // 3. Update the existing verification record
      // We reset status to 'pending' so admin sees it again
      const { error: updateError } = await supabase
        .from("welfare_verifications")
        .update({
          proof_image_url: publicUrl,
          status: 'pending',
          created_at: new Date().toISOString() // Optional: move to top of admin queue
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Documents Resubmitted",
        description: "Your verification request has been sent back for review.",
      });

      // Refresh the profile and status states
      await fetchUserProfile();

    } catch (error: any) {
      toast({
        title: "Resubmit failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      textbook: "Textbook",
      reading_book: "Reading Book",
      other_book: "Other Book",
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
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
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
                {/* Resubmit Button Logic */}
                {(verificationStatus === "rejected") && (
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
            <Plus className="h-4 w-4" />
            Upload Item
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your inventory...</p>
          </div>
        ) : (
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
              {userProfile?.role !== "admin" &&
                <TabsTrigger value="support" className="gap-2">
                  <MessageSquare className="h-4 w-4" /> Support
                </TabsTrigger>}
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" /> Settings
              </TabsTrigger>
            </TabsList>

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
                        <div className="mt-2">
                          <StatusBadge status={book.status} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/book/${book.id}`)} className="flex-1">
                            View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(book, 'book')}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteBook(book.id, book.image_url)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

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
                        <CardDescription>
                          {getCategoryLabel(item.category)} • {item.condition} • {item.type}
                        </CardDescription>
                        <div className="mt-2">
                          <StatusBadge status={item.status} />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/item/${item.id}`)} className="flex-1">
                            View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(item, 'item')}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id, item.image_url)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="history">
              <div className="space-y-8">
                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" /> Given Away
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {givenAway.map((item) => (
                      <Card key={item.id} className="opacity-80 grayscale-[0.3]">
                        <CardHeader className="p-4">
                          <img src={getImageUrl(item.image_url)} className="h-32 w-full object-cover rounded-md mb-2" />
                          <CardTitle className="text-sm">{item.title || item.name}</CardTitle>
                          {/* Conditional Status Display */}
                          <div className="flex items-center gap-2">
                            {item.handover_confirmed ? (
                              <StatusBadge status="claimed" />
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                                Awaiting Confirmation
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 font-medium">
                            🎁 {item.handover_confirmed ? "Given to:" : "Sent to:"} <span className="text-foreground">{item.receiver?.name || "Unknown"}</span>
                          </p>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-green-600" /> Received
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {receivedItems.map((item) => {
                      // Check if a review already exists for this specific item
                      const alreadyReviewed = item.reviews && item.reviews.length > 0;
                      return (
                        <Card key={item.id} className="border-green-200 bg-green-50/30">
                          <CardHeader className="p-4">
                            <img src={getImageUrl(item.image_url)} className="h-32 w-full object-cover rounded-md mb-2" />
                            <CardTitle className="text-sm">{item.title || item.name}</CardTitle>
                            <div className="flex items-center gap-2">

                              {item.handover_confirmed ? (
                                <StatusBadge status="claimed" />
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                                  Awaiting Confirmation
                                </span>
                              )}
                            </div>
                            <div className="mt-4 space-y-2">
                              {!item.handover_confirmed ? (
                                <Button
                                  size="sm"
                                  className="w-full bg-green-600 hover:bg-green-700"
                                  onClick={() => handleConfirmHandover(item, item.title ? 'books' : 'items')}
                                >
                                  Confirm I Received This
                                </Button>
                              ) : !alreadyReviewed ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full border-primary text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setSelectedItemForReview(item); // Ensure this is set
                                    setIsReviewModalOpen(true);   // Then open
                                  }}
                                >
                                  Leave a Review
                                </Button>
                              ) : (
                                <div className="text-center py-2 px-3 bg-green-100 rounded-md text-green-700 text-xs font-medium flex items-center justify-center gap-1">
                                  Review Submitted
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                              📩 {item.handover_confirmed ? "Received from: " : "Delivering by: "} <span className="text-foreground">{item.owner?.name || "Unknown"}</span>
                            </p>
                          </CardHeader>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              </div>
            </TabsContent>
            {/* ONLY RENDER SUPPORT CONTENT IF USER IS NOT AN ADMIN */}
            {userProfile?.role !== "admin" && (
              <TabsContent value="support">
                <ComplaintsTab />
              </TabsContent>
            )}
            <TabsContent value="settings">
              <div className="max-w-4xl mx-auto">
                <EditProfile
                  profile={userProfile}
                  onSave={fetchUserProfile}
                />

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
        )}
        {/* THE MODAL COMPONENT */}
        {selectedItemForReview && (
          <ReviewModal
            open={isReviewModalOpen}
            onOpenChange={setIsReviewModalOpen}
            targetItem={selectedItemForReview}
            currentUserId={userProfile?.id}
            onSuccess={fetchUserListings} // Refresh UI after review is saved
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
