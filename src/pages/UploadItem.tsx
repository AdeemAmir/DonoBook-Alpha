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
import { Upload, BookOpen, Package } from "lucide-react";
import { X } from 'lucide-react';
import { scanBookImage } from "@/utils/geminiScanner";

type UploadType = "book" | "item";

const UploadItem = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploadType, setUploadType] = useState<UploadType>("book");
  const [isScanning, setIsScanning] = useState(false); // State for UI feedback

  // Book-specific form data
  const [bookFormData, setBookFormData] = useState({
    title: "",
    grade: "",
    category: "",
    type: "",
    condition: "",
    description: "",
  });

  // Item-specific form data
  const [itemFormData, setItemFormData] = useState({
    name: "",
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
    if (!session) {
      navigate("/auth");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      const maxAllowed = uploadType === "book" ? 4 : 2;

      // Check if adding these files exceeds the limit
      if (images.length + fileArray.length > maxAllowed) {
        toast({
          title: "Limit exceeded",
          description: `You can only upload up to ${maxAllowed} images for this type.`,
          variant: "destructive",
        });
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
        toast({ title: "AI Scanning...", description: "Analyzing book cover..." });

        const aiResult = await scanBookImage(base64Data, file.type);

        // Map the AI result to your bookFormData
        setBookFormData(prev => ({
          ...prev,
          title: aiResult.title || prev.title,
          grade: aiResult.grade === "None" ? "" : aiResult.grade,
          // Match the "new" or "used" value expected by your <Select>
          category: aiResult.category.toLowerCase().includes("textbook")
            ? "textbook"
            : aiResult.category.toLowerCase().includes("other")
              ? "other_book"
              : "reading_book",
          condition: aiResult.condition.toLowerCase().includes("new") ? "new" : "used",
          description: aiResult.description || prev.description,
        }));

        toast({ title: "Scan Complete", description: "Details auto-filled!" });
      } catch (error) {
        console.error("AI Scan failed", error);
        toast({
          title: "Scan Failed",
          description: "Could not read book details. Please enter them manually.",
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
      URL.revokeObjectURL(newImages[index].preview); // Clean up memory
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const uploadAllImages = async (userId: string, bucket: string) => {
    const uploadPromises = images.map(async ({ file }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic Validation: Ensure at least one image is uploaded
    if (images.length === 0) {
      toast({
        title: "Missing images",
        description: "Please upload at least one image.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Determine which bucket to use
      const bucket = uploadType === "book" ? 'book-images' : 'item-images';

      // 2. Upload all images in the array and get back an array of URLs
      // Using the function we created in the previous step
      const imageUrls = await uploadAllImages(user.id, bucket);

      // 3. Prepare the data based on uploadType
      if (uploadType === "book") {
        const { error } = await supabase.from("books").insert([
          {
            title: bookFormData.title,
            grade: bookFormData.grade || null,
            category: bookFormData.category as "textbook" | "story_book" | "other_book",
            type: bookFormData.type as "donate" | "exchange",
            condition: bookFormData.condition as "new" | "used",
            description: bookFormData.description || null,
            owner_id: user.id,
            // If your DB column image_url is type text[], pass the whole array.
            // If it's still just a string column, pass imageUrls[0] or change the column type!
            image_url: imageUrls,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Success!",
          description: "Book and photos uploaded successfully",
        });
      } else {
        // Logic for Items
        const { error } = await supabase.from("items").insert([
          {
            name: itemFormData.name,
            category: itemFormData.category,
            type: itemFormData.type as "donate" | "exchange",
            condition: itemFormData.condition as "new" | "used",
            description: itemFormData.description || null,
            owner_id: user.id,
            image_url: imageUrls, // Array of max 2 images
          },
        ]);

        if (error) throw error;

        toast({
          title: "Success!",
          description: "Item and photos uploaded successfully",
        });
      }

      // 4. Redirect to dashboard on success
      navigate(uploadType === "book" ? "/dashboard?tab=books" : "/dashboard?tab=items");

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    setBookFormData({
      title: "",
      grade: "",
      category: "",
      type: "",
      condition: "",
      description: "",
    });
    setItemFormData({
      name: "",
      category: "",
      type: "",
      condition: "",
      description: "",
    });
    setImages([]);
  };

  const handleTypeChange = (type: UploadType) => {
    setUploadType(type);
    resetForms();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto shadow-card">
          <CardHeader>
            <CardTitle className="text-3xl font-heading">Upload an Item</CardTitle>
            <CardDescription>Share books or other items with the community</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload Type Selection */}
              <div className="space-y-2">
                <Label>What would you like to upload? *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={uploadType === "book" ? "default" : "outline"}
                    className={`h-20 flex flex-col gap-2 ${uploadType === "book" ? "bg-primary" : ""}`}
                    onClick={() => handleTypeChange("book")}
                  >
                    <BookOpen className="h-6 w-6" />
                    <span>Book</span>
                  </Button>
                  <Button
                    type="button"
                    variant={uploadType === "item" ? "default" : "outline"}
                    className={`h-20 flex flex-col gap-2 ${uploadType === "item" ? "bg-primary" : ""}`}
                    onClick={() => handleTypeChange("item")}
                  >
                    <Package className="h-6 w-6" />
                    <span>Other Item</span>
                  </Button>
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <Label className="text-base font-semibold">
                    {uploadType === "book" ? "Book Photos (Max 4)" : "Item Photos (Max 2)"}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {images.length} / {uploadType === "book" ? 4 : 2} uploaded
                  </span>
                </div>

                {/* Image Grid Preview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img src={img.preview} alt="preview" className="object-cover w-full h-full" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {/* Upload Trigger (only shows if under limit) */}
                  {images.length < (uploadType === "book" ? 4 : 2) && (
                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Add Photo</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </label>
                  )}
                </div>

                {/* Helpful Tooltip */}
                {uploadType === "book" && (
                  <p className="text-[10px] text-muted-foreground leading-tight italic">
                    Suggested: Front cover, back cover, inner pages (2), and spine.
                  </p>
                )}
              </div>

              {uploadType === "book" ? (
                <>
                  {/* Book Form */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Book Title *</Label>
                    <Input
                      id="title"
                      type="text"
                      value={bookFormData.title}
                      onChange={(e) => setBookFormData({ ...bookFormData, title: e.target.value })}
                      placeholder={isScanning ? "AI is reading title..." : ""}
                      disabled={isScanning}
                      className={isScanning ? "animate-pulse border-primary" : ""}
                      required
                    />
                    {isScanning && (
                      <span className="absolute right-3 top-2 text-xs text-primary animate-bounce">
                        ✨ AI
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade/Class</Label>
                    <Input
                      id="grade"
                      type="text"
                      placeholder="e.g., Grade 10"
                      value={bookFormData.grade}
                      onChange={(e) => setBookFormData({ ...bookFormData, grade: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Book Category *</Label>
                      <Select
                        value={bookFormData.category}
                        onValueChange={(value) => setBookFormData({ ...bookFormData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="textbook">Textbook</SelectItem>
                          <SelectItem value="story_book">Story Book</SelectItem>
                          <SelectItem value="other_book">Other Book</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Transaction Type *</Label>
                      <Select
                        value={bookFormData.type}
                        onValueChange={(value) => setBookFormData({ ...bookFormData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="donate">Donate</SelectItem>
                          <SelectItem value="exchange">Exchange</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Condition *</Label>
                    <Select
                      value={bookFormData.condition}
                      onValueChange={(value) => setBookFormData({ ...bookFormData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bookDescription">Description</Label>
                    <Textarea
                      id="bookDescription"
                      value={bookFormData.description}
                      onChange={(e) => setBookFormData({ ...bookFormData, description: e.target.value })}
                      placeholder="Add any additional details about the book..."
                      rows={4}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Item Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Item Category *</Label>
                      <Select
                        value={itemFormData.category}
                        onValueChange={(value) => {
                          const categoryLabels: Record<string, string> = {
                            bag: "Bag",
                            water_bottle: "Water Bottle",
                            pencil_box: "Pencil Box",
                            lunchbox: "Lunchbox",
                            stationery: "Stationery",
                          };

                          setItemFormData({
                            ...itemFormData,
                            category: value,
                            name: value === "other" ? "" : categoryLabels[value],
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bag">Bag</SelectItem>
                          <SelectItem value="water_bottle">Water Bottle</SelectItem>
                          <SelectItem value="pencil_box">Pencil Box</SelectItem>
                          <SelectItem value="lunchbox">Lunchbox</SelectItem>
                          <SelectItem value="stationery">Stationery</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Item Name *</Label>
                      <Input
                        id="name"
                        type="text"
                        value={itemFormData.name}
                        onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                        disabled={itemFormData.category !== "other"}
                        required
                      />
                    </div>


                  </div>
                  <div className="space-y-2">
                    <Label>Transaction Type *</Label>
                    <Select
                      value={itemFormData.type}
                      onValueChange={(value) => setItemFormData({ ...itemFormData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="donate">Donate</SelectItem>
                        <SelectItem value="exchange">Exchange</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Condition *</Label>
                    <Select
                      value={itemFormData.condition}
                      onValueChange={(value) => setItemFormData({ ...itemFormData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="itemDescription">Description</Label>
                    <Textarea
                      id="itemDescription"
                      value={itemFormData.description}
                      onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                      placeholder="Add any additional details about the item..."
                      rows={4}
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover"
                disabled={loading}
              >
                {loading ? "Uploading..." : `Upload ${uploadType === "book" ? "Book" : "Item"}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadItem;