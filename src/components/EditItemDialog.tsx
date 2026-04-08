import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Book = Database['public']['Tables']['books']['Row'];
type Item = Database['public']['Tables']['items']['Row'];

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Book | Item | null;
  itemType: 'book' | 'item';
  onSaved: () => void;
}

const EditItemDialog = ({ open, onOpenChange, item, itemType, onSaved }: EditItemDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const book = itemType === 'book' ? (item as Book) : null;
  const generalItem = itemType === 'item' ? (item as Item) : null;

  const [formData, setFormData] = useState({
    title: "", grade: "", category: "", type: "", condition: "", description: ""
  });

  // Runs every time the dialog opens or the item changes
  useEffect(() => {
    if (!open || !item) return;

    if (itemType === 'book') {
      const book = item as Book;
      setFormData({
        title: book.title || "",
        grade: book.grade || "",
        category: book.category || "",
        type: book.type || "",
        condition: book.condition || "",
        description: book.description || "",
      });
    } else {
      const generalItem = item as Item;
      setFormData({
        title: generalItem.name || "",
        grade: "",
        category: generalItem.category || "",
        type: generalItem.type || "",
        condition: generalItem.condition || "",
        description: generalItem.description || "",
      });
    }
  }, [open, item, itemType]); // re-runs whenever dialog opens or item switches

  // Reset form when item changes
  const resetForm = () => {
    if (itemType === 'book' && book) {
      setFormData({
        title: book.title,
        grade: book.grade || "",
        category: book.category,
        type: book.type,
        condition: book.condition,
        description: book.description || "",
      });
    } else if (itemType === 'item' && generalItem) {
      setFormData({
        title: generalItem.name,
        grade: "",
        category: generalItem.category,
        type: generalItem.type,
        condition: generalItem.condition,
        description: generalItem.description || "",
      });
    }
  };

  const handleSave = async () => {
    if (!item) return;
    setLoading(true);

    try {
      if (itemType === 'book') {
        const { error } = await supabase
          .from("books")
          .update({
            title: formData.title,
            grade: formData.grade || null,
            category: formData.category as "textbook" | "story_book" | "other_book",
            type: formData.type as "donate" | "exchange",
            condition: formData.condition as "new" | "used",
            description: formData.description || null,
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("items")
          .update({
            name: formData.title,
            category: formData.category as "bag" | "water_bottle" | "pencil_box" | "lunchbox" | "stationery" | "other",
            type: formData.type as "donate" | "exchange",
            condition: formData.condition as "new" | "used",
            description: formData.description || null,
          })
          .eq("id", item.id);
        if (error) throw error;
      }

      toast({ title: "Success", description: "Item updated successfully" });
      onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit {itemType === 'book' ? 'Book' : 'Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{itemType === 'book' ? 'Title' : 'Name'}</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {itemType === 'book' && (
            <div className="space-y-2">
              <Label>Grade</Label>
              <Input
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                placeholder="e.g., Grade 10"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {itemType === 'book' ? (
                    <>
                      <SelectItem value="textbook">Textbook</SelectItem>
                      <SelectItem value="story_book">Story Book</SelectItem>
                      <SelectItem value="other_book">Other Book</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="bag">Bag</SelectItem>
                      <SelectItem value="water_bottle">Water Bottle</SelectItem>
                      <SelectItem value="pencil_box">Pencil Box</SelectItem>
                      <SelectItem value="lunchbox">Lunchbox</SelectItem>
                      <SelectItem value="stationery">Stationery</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="donate">Donate</SelectItem>
                  <SelectItem value="exchange">Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={formData.condition} onValueChange={(v) => setFormData({ ...formData, condition: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="used">Used</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-primary-hover">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditItemDialog;
