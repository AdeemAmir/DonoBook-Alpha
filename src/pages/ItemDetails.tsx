import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Gift, RefreshCw, Package, MapPin, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { Rating } from "@/components/ui/rating";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import ItemLocationMap from "@/components/ItemLocationMap"

export type Item = Database['public']['Tables']['items']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const ItemDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    fetchItemDetails();
    getCurrentUser();
  }, [id]);


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

  const fetchItemDetails = async () => {
    try {
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("*")
        .eq("id", id!)
        .single();

      if (itemError) throw itemError;
      setItem(itemData);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", itemData.owner_id)
        .single();

      if (profileError) throw profileError;
      setOwner(profileData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (!currentUserId) {
      navigate("/auth");
      return;
    }
    navigate(`/messages?userId=${item?.owner_id}`);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "donate":
        return <Gift className="h-5 w-5" />;
      case "exchange":
        return <RefreshCw className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bag: "Bag",
      water_bottle: "Water Bottle",
      pencil_box: "Pencil Box",
      lunchbox: "Lunchbox",
      stationery: "Stationery",
      other: "Other",
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  const isOwner = currentUserId === item.owner_id;

  const getImages = () => {
    if (!item?.image_url) return ["/placeholder.svg"];

    // If it's already an array, we're good
    if (Array.isArray(item.image_url)) return item.image_url;

    // If it's a string, check if it's a stringified JSON array
    if (typeof item.image_url === 'string' && item.image_url.startsWith('[')) {
      try {
        return JSON.parse(item.image_url);
      } catch (e) {
        return [item.image_url];
      }
    }

    // Default: it's a single string URL
    return [item.image_url];
  };

  const images = getImages();


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-card overflow-hidden">
            <CardContent className="p-6">
              <Carousel className="w-full max-w-xl mx-auto">
                <CarouselContent>
                  {images.map((url, index) => (
                    <CarouselItem key={index}>
                      <div className="p-1">
                        {/* Clicking the image opens the lightbox */}
                        <img
                          src={url}
                          alt={`${item.title} - image ${index + 1}`}
                          onClick={() => { setLightboxIndex(index); setLightboxOpen(true); }}
                          className={`w-full h-96 object-cover rounded-lg transition-all cursor-zoom-in ${item.status !== "available" ? "grayscale opacity-60" : ""
                            }`}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {/* Only show arrows if there's more than one image */}
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </>
                )}
              </Carousel>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Click image to view full size
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex flex-col items-start">
                  <StatusBadge status={item.status} />
                  <CardTitle className="text-3xl font-heading">{item.name}</CardTitle>
                </div>
                <CardDescription>
                  Posted by {owner?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-base py-2 px-4">
                    {getTypeIcon(item.type)}
                    <span className="ml-2 capitalize">{item.type}</span>
                  </Badge>
                  <Badge variant="outline" className="text-base py-2 px-4">
                    {item.condition === "new" ? "New" : "Used"}
                  </Badge>
                  <Badge variant="outline" className="text-base py-2 px-4">
                    <Package className="h-4 w-4 mr-2" />
                    {getCategoryLabel(item.category)}
                  </Badge>
                </div>

                {/* ── OWNER ADDRESS ── */}
                {owner?.address && !isOwner && (
                  <div className="pt-4 border-t">
                    <h3 className="font-heading font-semibold mb-2">Location</h3>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">{owner.address}</p>
                      </div>
                    </div>
                  </div>
                )}

                {item.description && (
                  <div className="pt-4 border-t">
                    <h3 className="font-heading font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                )}

                {!isOwner && (
                  <Button
                    onClick={handleContact}
                    // DISABLE BUTTON IF NOT AVAILABLE
                    disabled={item.status !== "available"}
                    className={`w-full gap-2 text-lg py-6 ${item.status === "available"
                      ? "bg-primary hover:bg-primary-hover"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    <MessageSquare className="h-5 w-5" />
                    {item.status === "available" ? "Contact Owner" : "Currently Unavailable"}
                  </Button>
                )}

                {isOwner && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      This is your listing. Go to your dashboard to edit or delete it.
                    </p>
                    <Button
                      onClick={() => navigate("/dashboard")}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        {owner?.address && !isOwner && (
          <div className="mt-8 max-w-4xl mx-auto">
            <Card className="shadow-card overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Map View
                </CardTitle>
                {owner.user_type === "user" && (
                  <CardDescription>
                    Exact address is kept private. Arrange meetup details via chat.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {/* Taller map with no side padding */}
                <div className="h-72 w-full">
                  <ItemLocationMap
                    address={owner.address}
                    ownerName={owner.name}
                  />
                </div>
                {/* Footer strip */}
                <div className="px-4 py-3 bg-muted/40 border-t flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">{owner.address}, Karachi</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* ── LIGHTBOX ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Prev arrow */}
          {images.length > 1 && (
            <button
              className="absolute left-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + images.length) % images.length); }}
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}

          {/* Full image — stops click from closing when clicking the image itself */}
          <img
            src={images[lightboxIndex]}
            alt={`${item.title} - full view`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next arrow */}
          {images.length > 1 && (
            <button
              className="absolute right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % images.length); }}
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          )}

          {/* Dot indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-6 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition ${i === lightboxIndex ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ItemDetails;