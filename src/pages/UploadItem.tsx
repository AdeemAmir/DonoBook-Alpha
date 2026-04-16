import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, BookOpen, Package, Sparkles, Loader2, X, AlertCircle } from "lucide-react";
import { scanBookImage, validateScanResult } from "@/utils/geminiScanner";
import { validateBookListing, validateItemListing } from "@/utils/contentFilter";
import { generateSlug } from "@/utils/slugUtils";

type UploadType = "book" | "item";

const CONDITION_OPTIONS = [
  { value: "new", label: "New — Unused, pristine condition" },
  { value: "like_new", label: "Like New — Minimal use, no damage" },
  { value: "good", label: "Good — Normal wear, fully usable" },
  { value: "fair", label: "Fair — Visible wear, still readable" },
  { value: "worn", label: "Worn — Heavy use, some damage" },
];

const UploadItem = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploadType, setUploadType] = useState<UploadType>("book");
  const [isScanning, setIsScanning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [bookFormData, setBookFormData] = useState({
    title: "",
    author: "",
    publisher: "",
    language: "Urdu",
    edition: "",
    grade: "",
    category: "",
    type: "",
    condition: "",
    description: "",
  });

  const [itemFormData, setItemFormData] = useState({
    name: "",
    brand: "",
    color: "",
    size: "",
    category: "",
    type: "",
    condition: "",
    description: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      const maxAllowed = uploadType === "book" ? 4 : 2;

      if (images.length + fileArray.length > maxAllowed) {
        toast({
          title: "Image limit exceeded",
          description: `You can upload up to ${maxAllowed} images for this type.`,
          variant: "destructive",
        });
        return;
      }

      // Validate file sizes (max 8MB each)
      const oversized = fileArray.filter(f => f.size > 8 * 1024 * 1024);
      if (oversized.length > 0) {
        toast({ title: "File too large", description: "Each image must be under 8MB.", variant: "destructive" });
        return;
      }

      const newImages = fileArray.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));

      setImages((prev) => [...prev, ...newImages]);

      if (uploadType === "book" && images.length === 0 && fileArray.length > 0) {
        handleAIScan(fileArray[0]);
      }
    }
  };

  const handleAIScan = async (file: File) => {
    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = (reader.result as string).split(",")[1];
        toast({ title: "AI Scanning…", description: "Reading book cover, please wait…" });

        const aiResult = await scanBookImage(base64Data, file.type);
        const safe = validateScanResult(aiResult);

        setBookFormData(prev => ({
          ...prev,
          title: safe.title || prev.title,
          grade: safe.grade === "None" ? "" : (safe.grade || prev.grade),
          category: safe.category || prev.category,
          condition: safe.condition || prev.condition,
          description: safe.description || prev.description,
          author: safe.author || prev.author,
          publisher: safe.publisher || prev.publisher,
          language: safe.language || prev.language,
        }));

        toast({ title: "Scan Complete ✨", description: "Book details have been auto-filled. Please review and adjust." });
      } catch (error) {
        console.error("AI Scan failed:", error);
        toast({
          title: "Scan Failed",
          description: "Could not read book details. Please fill them in manually.",
          variant: "destructive"
        });
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const uploadAllImages = async (userId: string, bucket: string) => {
    const uploadPromises = images.map(async ({ file }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (images.length === 0) {
      toast({ title: "No images", description: "Please upload at least one photo.", variant: "destructive" });
      return;
    }

    // Content validation
    if (uploadType === "book") {
      const validation = validateBookListing({
        title: bookFormData.title,
        description: bookFormData.description,
        author: bookFormData.author,
      });
      if (!validation.valid) {
        setFieldErrors(validation.errors);
        toast({ title: "Please fix the errors", description: Object.values(validation.errors)[0], variant: "destructive" });
        return;
      }
    } else {
      const validation = validateItemListing({
        name: itemFormData.name,
        description: itemFormData.description,
      });
      if (!validation.valid) {
        setFieldErrors(validation.errors);
        toast({ title: "Please fix the errors", description: Object.values(validation.errors)[0], variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const bucket = uploadType === "book" ? "book-images" : "item-images";
      const imageUrls = await uploadAllImages(user.id, bucket);

      if (uploadType === "book") {
        // Generate a temporary UUID to create the slug client-side
        const tempId = crypto.randomUUID();
        const slug = generateSlug(bookFormData.title, tempId);

        const { error } = await supabase.from("books").insert([{
          title: bookFormData.title.trim(),
          author: bookFormData.author?.trim() || null,
          publisher: bookFormData.publisher?.trim() || null,
          language: bookFormData.language || null,
          edition: bookFormData.edition?.trim() || null,
          grade: bookFormData.grade?.trim() || null,
          category: bookFormData.category as "textbook" | "story_book" | "other_book",
          type: bookFormData.type as "donate" | "exchange",
          condition: bookFormData.condition as any,
          description: bookFormData.description?.trim() || null,
          owner_id: user.id,
          image_url: imageUrls,
          slug,
        }]);
        if (error) throw error;
        toast({ title: "Book uploaded!", description: "Your book listing is now live." });
      } else {
        const tempId = crypto.randomUUID();
        const slug = generateSlug(itemFormData.name, tempId);

        const { error } = await supabase.from("items").insert([{
          name: itemFormData.name.trim(),
          brand: itemFormData.brand?.trim() || null,
          color: itemFormData.color?.trim() || null,
          size: itemFormData.size?.trim() || null,
          category: itemFormData.category as any,
          type: itemFormData.type as "donate" | "exchange",
          condition: itemFormData.condition as any,
          description: itemFormData.description?.trim() || null,
          owner_id: user.id,
          image_url: imageUrls,
          slug,
        }]);
        if (error) throw error;
        toast({ title: "Item uploaded!", description: "Your item listing is now live." });
      }

      navigate(uploadType === "book" ? "/dashboard?tab=books" : "/dashboard?tab=items");
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    setBookFormData({ title: "", author: "", publisher: "", language: "Urdu", edition: "", grade: "", category: "", type: "", condition: "", description: "" });
    setItemFormData({ name: "", brand: "", color: "", size: "", category: "", type: "", condition: "", description: "" });
    setImages([]);
    setFieldErrors({});
  };

  const handleTypeChange = (type: UploadType) => {
    setUploadType(type);
    resetForms();
  };

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto shadow-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Upload a Listing</CardTitle>
            <CardDescription>Share books or items with your community</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-7">

              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange("book")}
                  className={`h-20 rounded-xl flex flex-col items-center justify-center gap-2 text-sm font-medium border-2 transition-all ${uploadType === "book"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                >
                  <BookOpen className="h-6 w-6" />
                  Book
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("item")}
                  className={`h-20 rounded-xl flex flex-col items-center justify-center gap-2 text-sm font-medium border-2 transition-all ${uploadType === "item"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                >
                  <Package className="h-6 w-6" />
                  Other Item
                </button>
              </div>

              {/* Image Upload */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <Label className="text-base font-semibold">
                    {uploadType === "book" ? "Book Photos (Max 4)" : "Item Photos (Max 2)"}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {images.length} / {uploadType === "book" ? 4 : 2}
                  </span>
                </div>

                {uploadType === "book" && images.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>Upload the front cover first — AI will auto-fill book details</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.map((img, index) => (
                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-border bg-muted">
                      <img src={img.preview} alt="preview" className="object-cover w-full h-full" />
                      {index === 0 && uploadType === "book" && (
                        <span className="absolute bottom-1 left-1 text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-medium">Cover</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {images.length < (uploadType === "book" ? 4 : 2) && (
                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                      <Upload className="h-7 w-7 text-muted-foreground mb-1.5" />
                      <p className="text-xs text-muted-foreground text-center leading-tight">
                        {isScanning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Add Photo"}
                      </p>
                      <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageChange} />
                    </label>
                  )}
                </div>
              </div>

              {/* ── BOOK FORM ── */}
              {uploadType === "book" ? (
                <div className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Book Title *</Label>
                    <Input
                      id="title"
                      value={bookFormData.title}
                      onChange={(e) => setBookFormData({ ...bookFormData, title: e.target.value })}
                      placeholder={isScanning ? "AI is reading title…" : "e.g., Mathematics Class 9"}
                      disabled={isScanning}
                      className={`${isScanning ? "animate-pulse border-primary" : ""} ${fieldErrors.title ? "border-destructive" : ""}`}
                      required
                    />
                    <FieldError field="title" />
                  </div>

                  {/* Author + Publisher */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="author">Author</Label>
                      <Input
                        id="author"
                        value={bookFormData.author}
                        onChange={(e) => setBookFormData({ ...bookFormData, author: e.target.value })}
                        placeholder={isScanning ? "Reading…" : "e.g., Dr. Abdul Salam"}
                        disabled={isScanning}
                        className={isScanning ? "animate-pulse" : ""}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="publisher">Publisher / Board</Label>
                      <Input
                        id="publisher"
                        value={bookFormData.publisher}
                        onChange={(e) => setBookFormData({ ...bookFormData, publisher: e.target.value })}
                        placeholder={isScanning ? "Reading…" : "e.g., Punjab Textbook Board"}
                        disabled={isScanning}
                        className={isScanning ? "animate-pulse" : ""}
                      />
                    </div>
                  </div>

                  {/* Language + Edition + Grade */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Language</Label>
                      <Select value={bookFormData.language} onValueChange={(v) => setBookFormData({ ...bookFormData, language: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Urdu">Urdu</SelectItem>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Sindhi">Sindhi</SelectItem>
                          <SelectItem value="Pashto">Pashto</SelectItem>
                          <SelectItem value="Punjabi">Punjabi</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edition">Edition / Year</Label>
                      <Input
                        id="edition"
                        value={bookFormData.edition}
                        onChange={(e) => setBookFormData({ ...bookFormData, edition: e.target.value })}
                        placeholder="e.g., 2024"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="grade">Grade / Class</Label>
                      <Input
                        id="grade"
                        value={bookFormData.grade}
                        onChange={(e) => setBookFormData({ ...bookFormData, grade: e.target.value })}
                        placeholder={isScanning ? "Reading…" : "e.g., Class 9"}
                        disabled={isScanning}
                        className={isScanning ? "animate-pulse" : ""}
                      />
                    </div>
                  </div>

                  {/* Category + Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Book Category *</Label>
                      <Select value={bookFormData.category} onValueChange={(v) => setBookFormData({ ...bookFormData, category: v })}>
                        <SelectTrigger className={isScanning ? "animate-pulse border-primary" : ""}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="textbook">📚 Textbook (School Curriculum)</SelectItem>
                          <SelectItem value="story_book">📖 Story / Fiction Book</SelectItem>
                          <SelectItem value="other_book">📗 Other Book (Religious, Reference…)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Listing Type *</Label>
                      <Select value={bookFormData.type} onValueChange={(v) => setBookFormData({ ...bookFormData, type: v })}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="donate">🎁 Donate (Free)</SelectItem>
                          <SelectItem value="exchange">🔄 Exchange (Swap)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="space-y-1.5">
                    <Label>Condition *</Label>
                    <Select value={bookFormData.condition} onValueChange={(v) => setBookFormData({ ...bookFormData, condition: v })}>
                      <SelectTrigger className={isScanning ? "animate-pulse border-primary" : ""}>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bookDescription">Description</Label>
                    <Textarea
                      id="bookDescription"
                      value={bookFormData.description}
                      onChange={(e) => setBookFormData({ ...bookFormData, description: e.target.value })}
                      placeholder={isScanning ? "AI is writing description…" : "Additional details about the book, its contents, any damage, etc."}
                      rows={3}
                      disabled={isScanning}
                      className={`${isScanning ? "animate-pulse border-primary" : ""} ${fieldErrors.description ? "border-destructive" : ""}`}
                    />
                    <FieldError field="description" />
                    <p className="text-xs text-muted-foreground text-right">{bookFormData.description.length}/1000</p>
                  </div>
                </div>
              ) : (
                /* ── ITEM FORM ── */
                <div className="space-y-4">
                  {/* Category + Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Item Category *</Label>
                      <Select
                        value={itemFormData.category}
                        onValueChange={(value) => {
                          const categoryLabels: Record<string, string> = {
                            bag: "Bag", water_bottle: "Water Bottle", pencil_box: "Pencil Box",
                            lunchbox: "Lunchbox", stationery: "Stationery",
                          };
                          setItemFormData({ ...itemFormData, category: value, name: value === "other" ? "" : categoryLabels[value] || "" });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bag">🎒 Bag / Backpack</SelectItem>
                          <SelectItem value="water_bottle">🍶 Water Bottle</SelectItem>
                          <SelectItem value="pencil_box">✏️ Pencil Box / Case</SelectItem>
                          <SelectItem value="lunchbox">🍱 Lunchbox / Tiffin</SelectItem>
                          <SelectItem value="stationery">📏 Stationery Set</SelectItem>
                          <SelectItem value="other">📦 Other Item</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Item Name *</Label>
                      <Input
                        id="name"
                        value={itemFormData.name}
                        onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                        placeholder="e.g., Nike School Bag"
                        disabled={itemFormData.category !== "other" && itemFormData.category !== ""}
                        className={fieldErrors.name ? "border-destructive" : ""}
                        required
                      />
                      <FieldError field="name" />
                    </div>
                  </div>

                  {/* Brand + Color */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="brand">Brand</Label>
                      <Input
                        id="brand"
                        value={itemFormData.brand}
                        onChange={(e) => setItemFormData({ ...itemFormData, brand: e.target.value })}
                        placeholder="e.g., Nike, Puma, Generic"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="color">Color</Label>
                      <Input
                        id="color"
                        value={itemFormData.color}
                        onChange={(e) => setItemFormData({ ...itemFormData, color: e.target.value })}
                        placeholder="e.g., Navy Blue, Black"
                      />
                    </div>
                  </div>

                  {/* Size + Listing Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="size">Size</Label>
                      <Input
                        id="size"
                        value={itemFormData.size}
                        onChange={(e) => setItemFormData({ ...itemFormData, size: e.target.value })}
                        placeholder="e.g., Medium, 30x20cm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Listing Type *</Label>
                      <Select value={itemFormData.type} onValueChange={(v) => setItemFormData({ ...itemFormData, type: v })}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="donate">🎁 Donate (Free)</SelectItem>
                          <SelectItem value="exchange">🔄 Exchange (Swap)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="space-y-1.5">
                    <Label>Condition *</Label>
                    <Select value={itemFormData.condition} onValueChange={(v) => setItemFormData({ ...itemFormData, condition: v })}>
                      <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="itemDescription">Description</Label>
                    <Textarea
                      id="itemDescription"
                      value={itemFormData.description}
                      onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                      placeholder="Additional details, dimensions, any defects, etc."
                      rows={3}
                      className={fieldErrors.description ? "border-destructive" : ""}
                    />
                    <FieldError field="description" />
                    <p className="text-xs text-muted-foreground text-right">{itemFormData.description.length}/1000</p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-primary hover:bg-primary-hover h-12 text-base font-semibold btn-glow"
                disabled={loading || isScanning}
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Uploading…</>
                ) : (
                  `Upload ${uploadType === "book" ? "Book" : "Item"}`
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By uploading, you confirm this listing follows our community guidelines.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadItem;
