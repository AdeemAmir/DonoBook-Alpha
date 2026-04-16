import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, MessageSquare, Gift, RefreshCw, MapPin, X,
  ChevronLeft, ChevronRight, BookOpen, User, Globe, BookMarked,
  Hash, FileText, Share2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import ItemLocationMap from "@/components/ItemLocationMap";
import { getListingFilter } from "@/utils/slugUtils";

type Book = Database['public']['Tables']['books']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
  used: "Used",
};

const CONDITION_COLORS: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  like_new: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  good: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300",
  fair: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  worn: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  used: "bg-muted text-muted-foreground border-border",
};

const BookDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    fetchBookDetails();
    getCurrentUser();
  }, [slug]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setLightboxIndex(i => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setLightboxIndex(i => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchBookDetails = async () => {
    if (!slug) return;
    try {
      const filter = getListingFilter(slug);
      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("*")
        .eq(filter.column, filter.value)
        .single();

      if (bookError) throw bookError;
      setBook(bookData);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", bookData.owner_id)
        .single();

      if (profileError) throw profileError;
      setOwner(profileData);
    } catch (error: any) {
      toast({ title: "Not found", description: "This listing could not be found.", variant: "destructive" });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (!currentUserId) { navigate("/auth"); return; }
    navigate(`/messages?userId=${book?.owner_id}`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: book?.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Share link has been copied to clipboard." });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "donate": return <Gift className="h-4 w-4" />;
      case "exchange": return <RefreshCw className="h-4 w-4" />;
      default: return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      textbook: "Textbook",
      story_book: "Story Book",
      other_book: "Other Book",
      reading_book: "Reading Book",
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-lg">Loading book details...</p>
        </div>
      </div>
    );
  }

  if (!book) return null;

  const isOwner = currentUserId === book.owner_id;

  const getImages = () => {
    if (!book?.image_url) return ["/placeholder.svg"];
    if (Array.isArray(book.image_url)) return book.image_url;
    if (typeof book.image_url === 'string' && book.image_url.startsWith('[')) {
      try { return JSON.parse(book.image_url); } catch { return [book.image_url]; }
    }
    return [book.image_url];
  };

  const images = getImages();
  const conditionLabel = CONDITION_LABELS[book.condition] || book.condition;
  const conditionColor = CONDITION_COLORS[book.condition] || CONDITION_COLORS.used;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Breadcrumb / back */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to listings
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2 text-muted-foreground">
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── Images panel ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <div className="rounded-2xl overflow-hidden bg-card shadow-card border border-border">
                <Carousel className="w-full">
                  <CarouselContent>
                    {images.map((url, index) => (
                      <CarouselItem key={index}>
                        <div
                          className="relative aspect-[3/4] cursor-zoom-in"
                          onClick={() => { setLightboxIndex(index); setLightboxOpen(true); }}
                        >
                          <img
                            src={url}
                            alt={`${book.title} — image ${index + 1}`}
                            className={`w-full h-full object-cover transition-all duration-300 ${book.status !== "available" ? "grayscale opacity-60" : ""}`}
                          />
                          {book.status !== "available" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-full uppercase tracking-wide">
                                Not Available
                              </span>
                            </div>
                          )}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-3 bg-background/80 backdrop-blur-sm" />
                      <CarouselNext className="right-3 bg-background/80 backdrop-blur-sm" />
                    </>
                  )}
                </Carousel>
                {images.length > 1 && (
                  <div className="flex gap-1.5 justify-center p-3 bg-muted/30">
                    {images.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                        className="w-12 h-12 rounded-md overflow-hidden border-2 transition-all"
                        style={{ borderColor: i === lightboxIndex ? "hsl(var(--primary))" : "transparent" }}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Tap image to zoom in
              </p>
            </div>
          </div>

          {/* ── Details panel ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Status + Title */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusBadge status={book.status} />
                <Badge variant="outline" className={`gap-1.5 ${conditionColor}`}>
                  {conditionLabel}
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-1">
                {book.title}
              </h1>
              <p className="text-muted-foreground flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Posted by <span className="font-medium text-foreground ml-1">{owner?.name}</span>
                {owner?.verified && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-1">✓ Verified</span>
                )}
              </p>
            </div>

            {/* Type badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                className={`gap-1.5 text-sm py-1.5 px-3 ${book.type === "donate"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300"
                  }`}
                variant="outline"
              >
                {getTypeIcon(book.type)}
                <span className="capitalize">{book.type}</span>
              </Badge>
              <Badge variant="outline" className="gap-1.5 text-sm py-1.5 px-3">
                <BookOpen className="h-3.5 w-3.5" />
                {getCategoryLabel(book.category)}
              </Badge>
              {book.grade && (
                <Badge variant="outline" className="gap-1.5 text-sm py-1.5 px-3">
                  <Hash className="h-3.5 w-3.5" />
                  {book.grade}
                </Badge>
              )}
            </div>

            {/* Book metadata */}
            {(book.author || book.publisher || book.language || book.edition) && (
              <Card className="shadow-card border-border">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Book Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {book.author && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Author</p>
                          <p className="text-sm font-medium">{book.author}</p>
                        </div>
                      </div>
                    )}
                    {book.publisher && (
                      <div className="flex items-start gap-2">
                        <BookMarked className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Publisher / Board</p>
                          <p className="text-sm font-medium">{book.publisher}</p>
                        </div>
                      </div>
                    )}
                    {book.language && (
                      <div className="flex items-start gap-2">
                        <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Language</p>
                          <p className="text-sm font-medium">{book.language}</p>
                        </div>
                      </div>
                    )}
                    {book.edition && (
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Edition</p>
                          <p className="text-sm font-medium">{book.edition}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {book.description && (
              <div>
                <h3 className="font-heading font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Description
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{book.description}</p>
              </div>
            )}

            <Separator />

            {/* Location (non-owner only) */}
            {owner?.address && !isOwner && (
              <div>
                <h3 className="font-heading font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location
                </h3>
                <p className="text-sm text-muted-foreground">{owner.address}</p>
              </div>
            )}

            {/* CTA — contact or owner notice */}
            {!isOwner ? (
              <Button
                onClick={handleContact}
                disabled={book.status !== "available"}
                size="lg"
                className={`w-full gap-2 h-12 text-base font-semibold btn-glow transition-smooth ${book.status === "available"
                  ? "bg-primary hover:bg-primary-hover"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
              >
                <MessageSquare className="h-5 w-5" />
                {book.status === "available" ? "Contact Owner" : "Currently Unavailable"}
              </Button>
            ) : (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-3">This is your listing</p>
                <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
                  Manage in Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Map section (non-owner only) */}
        {owner?.address && !isOwner && (
          <div className="mt-10 max-w-4xl mx-auto">
            <Card className="shadow-card overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Approximate Location
                </CardTitle>
                {owner.user_type === "user" && (
                  <CardDescription>
                    Exact address is kept private. Arrange meetup details via chat.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-64 w-full">
                  <ItemLocationMap address={owner.address} ownerName={owner.name} />
                </div>
                <div className="px-4 py-3 bg-muted/40 border-t flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">{owner.address}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <button
              className="absolute left-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + images.length) % images.length); }}
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}

          <img
            src={images[lightboxIndex]}
            alt={`${book.title} — full view`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              className="absolute right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % images.length); }}
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-6 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition ${i === lightboxIndex ? "bg-white scale-125" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}

          <div className="absolute bottom-12 left-0 right-0 text-center">
            <span className="text-white/60 text-sm">{lightboxIndex + 1} / {images.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookDetails;
