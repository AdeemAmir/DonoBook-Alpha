import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import AlphaNotice from "@/components/AlphaNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, Backpack, BookOpen, BookOpenText, Gift, RefreshCw,
  Package, PencilRuler, ShoppingBag, Loader2, BadgeCheck,
  MapPin, X, SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";
import { UserReputation } from '@/components/UserReputation';
import { useToast } from "@/hooks/use-toast";

type Book = Database['public']['Tables']['books']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

type ListingItem = {
  id: string;
  name: string;
  type: string;
  condition: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  itemType: 'book' | 'item';
  grade?: string | null;
  category: string;
  owner?: {
    name: string;
    verified: boolean;
    received_reviews: { rating: number }[];
    address: string;
  };
};

const PAGE_SIZE = 12;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const CATEGORY_FILTERS = [
  { value: "books", label: "All Books", icon: BookOpen },
  { value: "textbook", label: "Textbooks", icon: BookOpenText },
  { value: "story_book", label: "Story Books", icon: BookOpenText },
  { value: "other_book", label: "Other Books", icon: BookOpenText },
  { value: "items", label: "All Items", icon: Package },
  { value: "bag", label: "Bags", icon: Backpack },
  { value: "stationery", label: "Stationery", icon: PencilRuler },
  { value: "pencil_box", label: "Pencil Boxes", icon: PencilRuler },
  { value: "lunchbox", label: "Lunchboxes", icon: ShoppingBag },
  { value: "water_bottle", label: "Water Bottles", icon: Package },
];

const TYPE_FILTERS = [
  { value: "donate", label: "Donate", icon: Gift },
  { value: "exchange", label: "Exchange", icon: RefreshCw },
];

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreBooks, setHasMoreBooks] = useState(true);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [booksOffset, setBooksOffset] = useState(0);
  const [itemsOffset, setItemsOffset] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const listingsSectionRef = useRef<HTMLElement>(null);

  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchInitial(); }, []);

  const fetchInitial = async () => {
    try {
      const bookSelect = `*, owner:profiles!books_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;
      const itemSelect = `*, owner:profiles!items_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;

      const [booksResult, itemsResult] = await Promise.all([
        supabase.from("books").select(bookSelect).order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1).eq('is_available', true),
        supabase.from("items").select(itemSelect).order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1).eq('is_available', true),
      ]);

      if (booksResult.error) throw booksResult.error;
      if (itemsResult.error) throw itemsResult.error;

      const bData = booksResult.data || [];
      const iData = itemsResult.data || [];

      setBooks(bData as any);
      setItems(iData as any);
      setBooksOffset(bData.length);
      setItemsOffset(iData.length);
      setHasMoreBooks(bData.length === PAGE_SIZE);
      setHasMoreItems(iData.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || (!hasMoreBooks && !hasMoreItems)) return;
    setLoadingMore(true);
    try {
      const bookSelect = `*, owner:profiles!books_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;
      const itemSelect = `*, owner:profiles!items_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;

      let newBooks: any[] = [];
      let newItems: any[] = [];

      if (hasMoreBooks) {
        const { data } = await supabase.from("books").select(bookSelect).order("created_at", { ascending: false }).range(booksOffset, booksOffset + PAGE_SIZE - 1).eq('is_available', true);
        newBooks = data || [];
      }
      if (hasMoreItems) {
        const { data } = await supabase.from("items").select(itemSelect).order("created_at", { ascending: false }).range(itemsOffset, itemsOffset + PAGE_SIZE - 1).eq('is_available', true);
        newItems = data || [];
      }

      if (newBooks.length > 0) { setBooks(prev => [...prev, ...newBooks]); setBooksOffset(prev => prev + newBooks.length); }
      if (newBooks.length < PAGE_SIZE) setHasMoreBooks(false);
      if (newItems.length > 0) { setItems(prev => [...prev, ...newItems]); setItemsOffset(prev => prev + newItems.length); }
      if (newItems.length < PAGE_SIZE) setHasMoreItems(false);
    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreBooks, hasMoreItems, booksOffset, itemsOffset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const toggleCategory = (value: string) => {
    setActiveCategories(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleType = (value: string) => {
    setActiveTypes(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const clearAllFilters = () => {
    setActiveCategories([]);
    setActiveTypes([]);
    setLocationQuery("");
    setSearchQuery("");
  };

  const activeFilterCount = activeCategories.length + activeTypes.length + (locationQuery ? 1 : 0);

  const getCombinedListings = (): ListingItem[] => {
    const bookListings: ListingItem[] = books.map(book => ({
      id: book.id, name: book.title, type: book.type, condition: book.condition,
      description: book.description, image_url: book.image_url, created_at: book.created_at,
      itemType: 'book', grade: book.grade, category: book.category,
      owner: (book as any).owner
    }));
    const itemListings: ListingItem[] = items.map(item => ({
      id: item.id, name: item.name, type: item.type, condition: item.condition,
      description: item.description, image_url: item.image_url, created_at: item.created_at,
      itemType: 'item', category: item.category,
      owner: (item as any).owner
    }));
    return [...bookListings, ...itemListings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const getFilteredListings = () => {
    let listings = getCombinedListings();
    if (activeCategories.length > 0) {
      listings = listings.filter(item => {
        return activeCategories.some(cat => {
          if (cat === "books") return item.itemType === 'book';
          if (cat === "items") return item.itemType === 'item';
          if (cat === "textbook" || cat === "story_book" || cat === "other_book") return item.itemType === 'book' && item.category === cat;
          return item.itemType === 'item' && item.category === cat;
        });
      });
    }
    if (activeTypes.length > 0) {
      listings = listings.filter(item => activeTypes.includes(item.type));
    }
    if (locationQuery.trim()) {
      const loc = locationQuery.toLowerCase();
      listings = listings.filter(item =>
        item.owner?.address?.toLowerCase().includes(loc)
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      listings = listings.filter(item => item.name.toLowerCase().includes(q));
    }
    return listings;
  };

  const filteredListings = getFilteredListings();

  // --- Search Logic Integration ---
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!searchQuery.trim()) return;

      if (filteredListings.length > 0) {
        listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        toast({
          title: "No items found",
          description: `We couldn't find any listings matching "${searchQuery}".`,
          variant: "destructive",
        });
      }
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "donate": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      case "exchange": return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800";
      default: return "";
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
      bag: "Bag", water_bottle: "Water Bottle", pencil_box: "Pencil Box",
      lunchbox: "Lunchbox", stationery: "Stationery", other: "Other",
      textbook: "Textbook", story_book: "Reading Book", other_book: "Other Book"
    };
    return labels[category] || category;
  };

  const handleItemClick = (item: ListingItem) => {
    navigate(item.itemType === 'book' ? `/book/${item.id}` : `/item/${item.id}`);
  };

  const getThumbnail = (imageUrl: string | null) => {
    if (!imageUrl) return "/placeholder.svg";
    if (imageUrl.startsWith('[')) {
      try {
        const parsed = JSON.parse(imageUrl);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : "/placeholder.svg";
      } catch (e) { return imageUrl; }
    }
    return imageUrl;
  };

  const hasMore = hasMoreBooks || hasMoreItems;
  const filterKey = [...activeCategories, ...activeTypes, locationQuery, searchQuery].join("|");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary-light/20 to-background">
      <Navbar />
      <AlphaNotice />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <motion.div className="max-w-3xl mx-auto space-y-6" initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.h1 variants={fadeUp} transition={{ duration: 0.6 }} className="text-5xl md:text-6xl font-heading font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Share & Exchange
          </motion.h1>
      
          <motion.p variants={fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Beyond just books—our platform is a complete ecosystem for school essentials.
            Whether it's a sturdy backpack, a complete stationary set, or a much-needed textbook,
            we connect students to ensure no resource goes to waste.
          </motion.p>
          <motion.div variants={fadeUp} transition={{ duration: 0.5, delay: 0.2 }} className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="Search for books or items and press Enter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="pl-12 h-14 text-lg shadow-card focus-visible:ring-primary"
            />
          </motion.div>
          <motion.div variants={fadeUp} transition={{ duration: 0.5, delay: 0.3 }} className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/upload")} className="bg-primary hover:bg-primary-hover shadow-soft">Upload an Item</Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/assistant")} className="shadow-soft">Get Help from AI</Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Categories at a Glance */}
      <div className="container mx-auto py-20 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-heading font-bold mb-4">Categories at a Glance</h2>
          <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
        </div>
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
          {[
            { icon: BookOpenText, title: "Academic Gear", desc: "Textbooks, story books, and other educational books.", color: "text-primary" },
            { icon: Backpack, title: "Daily Essentials", desc: "School bags, lunch boxes, and water bottles.", color: "text-secondary" },
            { icon: PencilRuler, title: "Writing & Tools", desc: "Pencil boxes, geometry sets, and calculators.", color: "text-primary" },
            { icon: ShoppingBag, title: "Add-ons", desc: "School uniforms, and other required items.", color: "text-secondary" }
          ].map((cat) => (
            <motion.div key={cat.title} variants={fadeUp} transition={{ duration: 0.5 }}>
              <Card className="hover:shadow-lg transition-all hover:-translate-y-1 h-full">
                <CardHeader className="text-center">
                  <cat.icon className={`h-10 w-10 mx-auto mb-4 ${cat.color}`} />
                  <CardTitle>{cat.title}</CardTitle>
                  <CardDescription>{cat.desc}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Listings Section */}
      <section ref={listingsSectionRef} className="container mx-auto px-4 pb-16 scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-heading font-bold">Available Items</h2>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card className="mb-6 border-primary/20">
                <CardContent className="pt-5 pb-4 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Location</p>
                    <div className="relative max-w-sm">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. Karachi, Gulshan..."
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                      {locationQuery && (
                        <button onClick={() => setLocationQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_FILTERS.map(({ value, label, icon: Icon }) => {
                        const active = activeCategories.includes(value);
                        return (
                          <button
                            key={value}
                            onClick={() => toggleCategory(value)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
                              }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Listing type</p>
                      <div className="flex gap-2">
                        {TYPE_FILTERS.map(({ value, label, icon: Icon }) => {
                          const active = activeTypes.includes(value);
                          return (
                            <button
                              key={value}
                              onClick={() => toggleType(value)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${active
                                  ? value === "donate"
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-violet-600 text-white border-violet-600"
                                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
                                }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3 mr-1" /> Clear all
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20 flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading the latest contributions...</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-20 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-xl font-bold mb-2">No matching items</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchQuery
                  ? `We couldn't find anything matching "${searchQuery}". Try a different term or browse categories.`
                  : "No items available in this category yet. Be the first to share something!"}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={clearAllFilters}>Reset Filters</Button>
                <Button onClick={() => navigate("/upload")} className="bg-primary">Upload Item</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} key={filterKey}
            >
              {filteredListings.map((item) => (
                <motion.div key={`${item.itemType}-${item.id}`} variants={fadeUp} transition={{ duration: 0.4 }}>
                  <Card
                    className="shadow-card hover:shadow-soft transition-smooth cursor-pointer group h-full flex flex-col"
                    onClick={() => handleItemClick(item)}
                  >
                    <CardHeader className="p-0 overflow-hidden rounded-t-lg">
                      <img
                        src={getThumbnail(item.image_url)}
                        alt={item.name}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </CardHeader>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <CardTitle className="font-heading text-lg mb-2 group-hover:text-primary transition-smooth line-clamp-1">
                        {item.name}
                      </CardTitle>

                      <div className="space-y-3 flex-1">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className={getTypeColor(item.type)}>
                            {getTypeIcon(item.type)}<span className="ml-1 capitalize">{item.type}</span>
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {getCategoryLabel(item.category)}
                          </Badge>
                        </div>

                        <div className="pt-3 border-t mt-auto">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                {item.owner?.name?.[0] || 'U'}
                              </div>
                              <span className="text-xs font-medium truncate">{item.owner?.name || 'User'}</span>
                              {item.owner?.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                            </div>
                            <UserReputation reviews={item.owner?.received_reviews} />
                          </div>
                          <div className="flex items-start gap-1.5 opacity-70">
                            <MapPin className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            <p className="text-[11px] line-clamp-1">{item.owner?.address || 'Location shared on chat'}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            <div ref={sentinelRef} className="py-12 text-center">
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 text-primary font-medium">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking for more...</span>
                </div>
              )}
              {!hasMore && filteredListings.length > 0 && (
                <div className="pt-8">
                  <p className="text-muted-foreground text-sm bg-muted/30 py-2 px-4 rounded-full inline-block">
                    You've seen everything we have for now!
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Home;