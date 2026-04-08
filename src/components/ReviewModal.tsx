import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetItem: any; // The book or item being reviewed
  currentUserId: string;
  onSuccess: () => void;
}

export const ReviewModal = ({ open, onOpenChange, targetItem, currentUserId, onSuccess }: ReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        reviewer_id: currentUserId,
        reviewee_id: targetItem.owner_id, // The person who gave the item
        book_id: targetItem.title ? targetItem.id : null,
        item_id: targetItem.name ? targetItem.id : null,
        rating,
        comment,
      });

      if (error) throw error;

      toast({ title: "Review submitted!", description: "Thanks for helping the community stay safe." });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rate your experience</DialogTitle>
          <p className="text-sm text-muted-foreground">How was your exchange with {targetItem?.owner?.name}?</p>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-6 space-y-4">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-8 w-8 cursor-pointer transition-colors ${
                  star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => setRating(star)}
              />
            ))}
          </div>
          <Textarea
            placeholder="Write a short comment about the handover..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-4"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Posting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};