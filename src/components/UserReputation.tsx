import { Star } from "lucide-react";

export const UserReputation = ({ reviews }: { reviews: any[] }) => {
  if (!reviews || reviews.length === 0) {
    return <span className="text-xs italic">New Member (No ratings)</span>;
  }

  const totalRating = reviews.reduce((acc, curr) => acc + curr.rating, 0);
  const average = totalRating / reviews.length;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center bg-amber-100 px-2 py-0.5 rounded-full">
        <Star className="h-3 w-3 fill-amber-500 text-amber-500 mr-1" />
        <span className="text-xs font-bold text-amber-700">{average.toFixed(1)}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">
        {reviews.length} {reviews.length === 1 ? 'handover' : 'handovers'}
      </span>
    </div>
  );
};