import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, Backpack, BookOpen, BookOpenText, Gift, RefreshCw,
  Package, PencilRuler, ShoppingBag, Loader2, BadgeCheck,
  MapPin, X, SlidersHorizontal, ArrowRight, Sparkles,
  Users, BookMarked, Shield, Download, Smartphone, Share, PlusSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { UserReputation } from "@/components/UserReputation";

type ListingItem = {
  id: string;
  slug?: string | null;
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

const PAGE_SIZE = 24;

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

const FEATURES = [
  {
    icon: Gift,
    title: "Free to Use",
    desc: "No fees. Donate or exchange school essentials completely free.",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: Shield,
    title: "Verified Donors",
    desc: "Welfare organizations are verified for safe, trusted exchanges.",
    color: "text-primary bg-primary/10",
  },
  {
    icon: Sparkles,
    title: "AI-Powered",
    desc: "Scan any book cover and our AI instantly fills in all details.",
    color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  },
  {
    icon: Users,
    title: "Community First",
    desc: "Built for students to help each other succeed.",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  },
];

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreBooks, setHasMoreBooks] = useState(true);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  
  const [userProfile, setUserProfile] = useState<any>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const listingsSectionRef = useRef<HTMLElement>(null);
  
  const booksOffsetRef = useRef(0);
  const itemsOffsetRef = useRef(0);
  const fetchingRef = useRef(false);

  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [recommendedCategory, setRecommendedCategory] = useState<string | null>(null);

  // PWA Install State
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [pwaStep, setPwaStep] = useState<'initial' | 'fallback'>('initial');
  const [isIOS, setIsIOS] = useState(false);
  const [dontShowFor24Hours, setDontShowFor24Hours] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session?.user) {
        supabase.from("profiles").select("name").eq("id", session.user.id).single()
          .then(({ data, error }) => { if (!error && data) setUserProfile(data); });
      }
    });

    const lastViewed = localStorage.getItem("donobook_last_category");
    if (lastViewed) setRecommendedCategory(lastViewed);

    fetchInitial(lastViewed);
  }, []);

  // ─── PWA INSTALLATION LOGIC ───
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || window.innerWidth < 768;
    const isAppleMobile = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleMobile);
    
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    
    const dismissedForever = localStorage.getItem("pwa_prompt_dismissed");
    const snoozedUntil = localStorage.getItem("pwa_prompt_snooze");
    const isSnoozed = snoozedUntil && new Date(snoozedUntil) > new Date();

    if (isMobileDevice && !isStandalone && !dismissedForever && !isSnoozed) {
      const timer = setTimeout(() => setShowPwaPrompt(true), 3500);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleClosePwaPrompt = () => {
    if (dontShowFor24Hours) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      localStorage.setItem('pwa_prompt_snooze', tomorrow.toISOString());
    }
    setShowPwaPrompt(false);
  };

  const handlePwaInstalledYes = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setShowPwaPrompt(false);
  };

  const handlePwaInstallNo = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_prompt_dismissed', 'true');
        setShowPwaPrompt(false);
      }
      (window as any).deferredPrompt = null;
    } else {
      setPwaStep('fallback');
    }
  };

  const formatAndSortBatch = (bData: any[], iData: any[], recCat: string | null): ListingItem[] => {
    const bList: ListingItem[] = bData.map(book => ({
      id: book.id, slug: book.slug, name: book.title, type: book.type, condition: book.condition,
      description: book.description, image_url: book.image_url, created_at: book.created_at,
      itemType: 'book', grade: book.grade, category: book.category, owner: book.owner
    }));
    const iList: ListingItem[] = iData.map(item => ({
      id: item.id, slug: item.slug, name: item.name, type: item.type, condition: item.condition,
      description: item.description, image_url: item.image_url, created_at: item.created_at,
      itemType: 'item', category: item.category, owner: item.owner
    }));

    let combined = [...bList, ...iList];
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (recCat) {
      combined = [
        ...combined.filter(i => (recCat === "books" && i.itemType === "book") || (recCat === "items" && i.itemType === "item") || i.category === recCat),
        ...combined.filter(i => !(recCat === "books" && i.itemType === "book") && !(recCat === "items" && i.itemType === "item") && i.category !== recCat),
      ];
    }
    return combined;
  };

  const fetchInitial = async (recCat: string | null) => {
    try {
      fetchingRef.current = true;
      const bookSelect = `*, owner:profiles!books_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;
      const itemSelect = `*, owner:profiles!items_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;

      const [booksResult, itemsResult] = await Promise.all([
        supabase.from("books").select(bookSelect).order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1).eq('is_available', true),
        supabase.from("items").select(itemSelect).order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1).eq('is_available', true),
      ]);

      const bData = booksResult.data || [];
      const iData = itemsResult.data || [];

      setListings(formatAndSortBatch(bData, iData, recCat));
      
      booksOffsetRef.current = bData.length;
      itemsOffsetRef.current = iData.length;
      setHasMoreBooks(bData.length === PAGE_SIZE);
      setHasMoreItems(iData.length === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || (!hasMoreBooks && !hasMoreItems)) return;
    
    fetchingRef.current = true;
    setLoadingMore(true);
    
    try {
      const bookSelect = `*, owner:profiles!books_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;
      const itemSelect = `*, owner:profiles!items_owner_id_fkey(name, verified, address, received_reviews:reviews!reviewee_id(rating))`;

      let newBooks: any[] = [];
      let newItems: any[] = [];

      if (hasMoreBooks) {
        const currentOffset = booksOffsetRef.current;
        const { data } = await supabase.from("books").select(bookSelect)
          .order("created_at", { ascending: false }).range(currentOffset, currentOffset + PAGE_SIZE - 1).eq('is_available', true);
        newBooks = data || [];
        booksOffsetRef.current += newBooks.length;
        if (newBooks.length < PAGE_SIZE) setHasMoreBooks(false);
      }
      if (hasMoreItems) {
        const currentOffset = itemsOffsetRef.current;
        const { data } = await supabase.from("items").select(itemSelect)
          .order("created_at", { ascending: false }).range(currentOffset, currentOffset + PAGE_SIZE - 1).eq('is_available', true);
        newItems = data || [];
        itemsOffsetRef.current += newItems.length;
        if (newItems.length < PAGE_SIZE) setHasMoreItems(false);
      }

      const batch = formatAndSortBatch(newBooks, newItems, recommendedCategory);
      
      setListings(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const uniqueNew = batch.filter(i => !existingIds.has(i.id));
        return [...prev, ...uniqueNew];
      });

    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMoreBooks, hasMoreItems, recommendedCategory]);

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
    setActiveCategories(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    localStorage.setItem("donobook_last_category", value);
  };

  const toggleType = (value: string) => {
    setActiveTypes(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const clearAllFilters = () => {
    setActiveCategories([]);
    setActiveTypes([]);
    setLocationQuery("");
    setSearchQuery("");
  };

  const clearRecommendation = () => {
    setRecommendedCategory(null);
    localStorage.removeItem("donobook_last_category");
    setListings(prev => [...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const activeFilterCount = activeCategories.length + activeTypes.length + (locationQuery ? 1 : 0);

  const getFilteredListings = () => {
    let filtered = listings;
    if (activeCategories.length > 0) {
      filtered = filtered.filter(item => {
        return activeCategories.some(cat => {
          if (cat === "books") return item.itemType === 'book';
          if (cat === "items") return item.itemType === 'item';
          if (["textbook", "story_book", "other_book"].includes(cat)) return item.itemType === 'book' && item.category === cat;
          return item.itemType === 'item' && item.category === cat;
        });
      });
    }
    if (activeTypes.length > 0) filtered = filtered.filter(item => activeTypes.includes(item.type));
    if (locationQuery.trim()) filtered = filtered.filter(item => item.owner?.address?.toLowerCase().includes(locationQuery.toLowerCase()));
    if (searchQuery.trim()) filtered = filtered.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return filtered;
  };

  const filteredListings = getFilteredListings();

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (!searchQuery.trim()) return;
      if (filteredListings.length > 0) {
        listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        toast({ title: "No results", description: `Nothing found for "${searchQuery}".`, variant: "destructive" });
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
      case "donate": return <Gift className="h-3.5 w-3.5" />;
      case "exchange": return <RefreshCw className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bag: "Bag", water_bottle: "Water Bottle", pencil_box: "Pencil Box",
      lunchbox: "Lunchbox", stationery: "Stationery", other: "Other",
      textbook: "Textbook", story_book: "Story Book", other_book: "Other Book", reading_book: "Reading Book",
    };
    return labels[category] || category;
  };

  const handleItemClick = (item: ListingItem) => {
    const urlParam = item.slug || item.id;
    navigate(item.itemType === 'book' ? `/book/${urlParam}` : `/item/${urlParam}`);
    localStorage.setItem("donobook_last_category", item.category);
  };

  const getThumbnail = (imageUrl: string | null) => {
    if (!imageUrl) return "/placeholder.svg";
    if (imageUrl.startsWith('[')) {
      try {
        const parsed = JSON.parse(imageUrl);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : "/placeholder.svg";
      } catch { return imageUrl; }
    }
    return imageUrl;
  };

  const hasMore = hasMoreBooks || hasMoreItems;
  const filterKey = [...activeCategories, ...activeTypes, locationQuery, searchQuery].join("|");

  return (
    <div className="min-h-screen bg-background transition-colors">
      <Navbar />

      {isLoggedIn === false && (
        <>
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 gradient-hero opacity-60" />
            <div className="relative container mx-auto px-4 py-20 sm:py-15 text-center">
              <motion.div
                className="max-w-5xl mx-auto space-y-6"
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              >
                <h1 className="text-4xl sm:text-6xl font-heading font-bold leading-tight">
                  <span className="gradient-text">Share & Exchange</span>
                  <br />Build Futures.
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  Beyond just transactions - Donobook is an ecosystem for school essentials. <br />
                  Be it a sturdy backpack, or much-needed textbooks students rely on, <br />we connect students so valuable resources never go to waste. <br />
                  Give what you can. Feed the thirst for knowledge.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="bg-primary hover:bg-primary-hover shadow-glow gap-2 h-12 px-8 text-base font-semibold btn-glow text-white">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} className="h-12 px-8 text-base">
                    Browse Listings
                  </Button>
                </div>
              </motion.div>
            </div>
          </section>

          <section className="container mx-auto px-4 py-16 text-center">
            <div className="relative container text-center">
              <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-4 dark:text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Built for a better Future
                </span>
              </motion.div>
            </div>

            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold mb-3">Why DonoBook?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">Everything you need to share and find school essentials — in one place.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map((f, i) => (
                <motion.div 
                  key={f.title} 
                  initial={{ opacity: 0, y: 24 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <Card className="h-full hover:shadow-soft transition-smooth border-border hover:-translate-y-1">
                    <CardHeader>
                      <div className="flex justify-center mb-4">
                        <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${f.color}`}>
                          <f.icon className="h-7 w-7" strokeWidth={2} />
                        </div>
                      </div>
                      <CardTitle className="text-base font-semibold">{f.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">{f.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="container mx-auto px-4 pb-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-heading font-bold mb-2">What's Available</h2>
              <p className="text-muted-foreground text-sm">Browse by category to find exactly what you need</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: BookOpenText, title: "Textbooks", desc: "Class 1-12 curriculum", color: "text-primary" },
                { icon: Backpack, title: "School Bags", desc: "Backpacks & bags", color: "text-secondary" },
                { icon: PencilRuler, title: "Stationery", desc: "Pencils, pens & sets", color: "text-accent" },
                { icon: ShoppingBag, title: "Lunchboxes", desc: "Tiffins & bottles", color: "text-primary" },
              ].map((cat, i) => (
                <motion.div 
                  key={cat.title} 
                  initial={{ opacity: 0, y: 24 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                >
                  <Card
                    className="hover:shadow-soft hover:-translate-y-1 transition-smooth cursor-pointer border-border"
                    onClick={() => listingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <CardHeader className="text-center pb-4 pt-5">
                      <cat.icon className={`h-8 w-8 mx-auto mb-2 ${cat.color}`} />
                      <CardTitle className="text-sm font-semibold">{cat.title}</CardTitle>
                      <CardDescription className="text-xs">{cat.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        </>
      )}

      {isLoggedIn === true && (
        <section className="container mx-auto px-4 py-8">
          <motion.div
            className="rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border border-primary/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          >
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold mb-1 text-foreground">
                Welcome back, {userProfile?.name || "User"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {recommendedCategory
                  ? `How about a ${getCategoryLabel(recommendedCategory)} for today?`
                  : "Browse the latest donations and exchanges from your community"}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/upload")} className="bg-primary hover:bg-primary-hover gap-2 btn-glow text-white">
                <Gift className="h-4 w-4" /> Donate Item
              </Button>
              <Button variant="outline" onClick={() => navigate("/assistant")} className="gap-2 border-border">
                <Sparkles className="h-4 w-4" /> AI Help
              </Button>
            </div>
          </motion.div>
        </section>
      )}

      {isLoggedIn !== null && (
        <div className="container mx-auto px-4 pb-4">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="Search books, bags, stationery…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className="pl-12 h-12 text-base shadow-sm focus-visible:ring-primary border-border bg-card text-foreground"
            />
            {searchQuery && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <section ref={listingsSectionRef} className="container mx-auto px-4 pb-16 scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
              {recommendedCategory && activeCategories.length === 0 && !searchQuery
                ? `Recommended for You`
                : "Available Listings"}
            </h2>
            {filteredListings.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">{filteredListings.length} listings</p>
            )}
          </div>
          <Button variant="outline" className="gap-2 border-border" onClick={() => setShowFilters(v => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card className="mb-6 border-primary/20 shadow-sm">
                <CardContent className="pt-5 pb-4 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Location</p>
                    <div className="relative max-w-sm">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. Karachi, Gulshan…"
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        className="pl-9 h-9 text-sm bg-background border-border"
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
                            key={value} onClick={() => toggleCategory(value)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all ${active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                              }`}
                          >
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Listing Type</p>
                      <div className="flex gap-2">
                        {TYPE_FILTERS.map(({ value, label, icon: Icon }) => {
                          const active = activeTypes.includes(value);
                          return (
                            <button
                              key={value} onClick={() => toggleType(value)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${active
                                ? value === "donate"
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-violet-600 text-white border-violet-600"
                                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                }`}
                            >
                              <Icon className="h-3.5 w-3.5" /> {label}
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

        {loading ? (
          <div className="text-center py-20 flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading listings…</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <Card className="shadow-sm border-border">
            <CardContent className="py-20 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-xl font-bold mb-2">No listings found</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                {searchQuery
                  ? `Nothing found for "${searchQuery}". Try a different search term or browse categories.`
                  : "No items in this category yet. Be the first to donate!"}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button variant="outline" onClick={clearAllFilters} className="border-border">Reset Filters</Button>
                <Button onClick={() => navigate(isLoggedIn ? "/upload" : "/auth")} className="bg-primary text-white">
                  {isLoggedIn ? "Upload an Item" : "Join & Donate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {recommendedCategory && activeCategories.length === 0 && !searchQuery && (
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Personalized based on your browsing | <button onClick={clearRecommendation} className="text-primary hover:text-primary-hover underline underline-offset-2">show all</button></span>
              </div>
            )}
            
            {/* Parent container no longer holds the variants to prevent newly appended children from staying hidden */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" key={filterKey}>
              {filteredListings.map((item) => (
                <motion.div 
                  key={`${item.itemType}-${item.id}`} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "50px" }}
                  transition={{ duration: 0.4 }}
                >
                  <Card
                    className="shadow-sm hover:shadow-soft transition-smooth cursor-pointer group h-full flex flex-col border-border hover:-translate-y-1"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="relative overflow-hidden rounded-t-lg bg-muted/20">
                      <img
                        src={getThumbnail(item.image_url)}
                        alt={item.name}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg";
                          e.currentTarget.onerror = null;
                        }}
                        className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <h3 className="font-heading font-semibold text-base mb-1.5 group-hover:text-primary transition-smooth line-clamp-2 leading-snug">
                        {item.name}
                      </h3>
                      <div className="flex gap-1.5 flex-wrap mb-2 items-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 px-1.5 py-0 font-bold border-transparent ${getTypeColor(item.type)}`}
                        >
                          {getTypeIcon(item.type)}<span className="capitalize">{item.type}</span>
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-medium shadow-none">
                          {getCategoryLabel(item.category)}
                        </Badge>
                        {item.grade && (
                          <Badge variant="outline" className="text-[10px] shadow-none border-border">{item.grade}</Badge>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-border/50">
                        {item.owner?.verified && (
                          <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground truncate">{item.owner?.name}</span>
                        {<UserReputation reviews={item.owner?.received_reviews}/>}
                        {item.owner?.address && (
                          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-0.5 shrink-0">
                            <MapPin className="h-3 w-3" />
                            {item.owner.address.split(',')[0]}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Load more sentinel */}
            <div ref={sentinelRef} className="h-10 mt-8 flex items-center justify-center">
              {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
              {!hasMore && filteredListings.length > 0 && (
                <p className="text-sm text-muted-foreground">All listings loaded</p>
              )}
            </div>
          </>
        )}

        {/* Guest CTA below listings */}
        {isLoggedIn === false && (
          <div className="mt-16">
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 p-8 text-center">
              <BookMarked className="h-10 w-10 mx-auto text-primary mb-4" />
              <h3 className="text-xl font-heading font-bold mb-2">Ready to share?</h3>
              <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
                Join DonoBook to donate books, exchange items, and help students in your community.
              </p>
              <Button onClick={() => navigate("/auth?mode=signup")} className="bg-primary hover:bg-primary-hover gap-2 btn-glow text-white">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════
          PWA INSTALLATION MODAL
          ══════════════════════════════════════════ */}
      {showPwaPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-background dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-border dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <button
              onClick={handleClosePwaPrompt}
              className="absolute right-3 top-3 p-2 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-slate-800 transition-colors z-10"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {pwaStep === 'initial' ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground">Do you have the DonoBook app?</h3>
                <p className="text-sm text-muted-foreground pb-2">
                  Install the DonoBook app to access chats instantly, receive push notifications, and enjoy a faster experience.
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={handlePwaInstalledYes} variant="outline" className="w-full">
                    Yes, I already have it
                  </Button>
                  <Button onClick={handlePwaInstallNo} className="w-full bg-primary hover:bg-primary/90 text-white gap-2">
                    <Download className="h-4 w-4" /> No, I want to install it
                  </Button>
                </div>
                <label className="flex items-center justify-center gap-2 text-sm text-muted-foreground dark:text-slate-400 cursor-pointer select-none pt-2">
                  <input
                    type="checkbox"
                    checked={dontShowFor24Hours}
                    onChange={(e) => setDontShowFor24Hours(e.target.checked)}
                    className="h-4 w-4 rounded border-border dark:border-slate-700 dark:bg-slate-800 text-primary focus:ring-primary cursor-pointer"
                  />
                  Snooze for 24 hours
                </label>
              </div>
            ) : (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground">Install DonoBook</h3>
                
                {isIOS ? (
                  <div className="text-sm text-muted-foreground space-y-3 pb-2 text-left bg-muted/30 dark:bg-slate-800/30 p-4 rounded-lg">
                    <p>To install the app on iOS:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Tap the <strong>Share</strong> button <Share className="h-4 w-4 inline text-foreground mx-1" /> at the bottom of your screen.</li>
                      <li>Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="h-4 w-4 inline text-foreground mx-1" />.</li>
                      <li>Confirm by tapping <strong>Add</strong> in the top right.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground space-y-3 pb-2 text-left bg-muted/30 dark:bg-slate-800/30 p-4 rounded-lg">
                    <p>To install the app on Android:</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Tap the <strong>Browser Menu (⋮)</strong> in the top right.</li>
                      <li>Select <strong>Install App</strong> or <strong>Add to Home screen</strong>.</li>
                      <li>If you don't see this option, try selecting <strong>Open in System Browser</strong> first.</li>
                    </ol>
                  </div>
                )}
                
                <Button onClick={handlePwaInstalledYes} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;